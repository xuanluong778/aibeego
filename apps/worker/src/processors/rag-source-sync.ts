import type { Job } from 'bullmq';
import { prisma, type PrismaClient } from '@marketingspa/database';
import {
  collectRagWebsite,
  collectRagFacebook,
  normalizeRagContent,
  ragContentHash,
  ragFacebookError,
  RagFacebookError,
  type RagCollectedItem,
  type RagCollectSink,
} from '@marketingspa/shared/dist/rag-source-collect';
import { decryptSecret } from '../lib/encryption';
import { mergeWebsiteSummary } from './rag-website-summary';

export type RagSourceJob = {
  organizationId: string;
  knowledgeBaseId: string;
  sourceId: string;
  runId: string;
};
export class RagSourceCancelled extends Error {}
/** Exported for integration tests using an isolated database and synthetic collectors. */
export async function runRagSourceSync(
  db: PrismaClient,
  data: RagSourceJob,
  deps: {
    website?: typeof collectRagWebsite;
    facebook?: typeof collectRagFacebook;
  } = {},
) {
  if (
    ![data.organizationId, data.knowledgeBaseId, data.sourceId, data.runId].every(
      (v) => typeof v === 'string' && v.length > 0,
    )
  )
    return { skipped: true };
  const where = {
    id: data.sourceId,
    organizationId: data.organizationId,
    knowledgeBaseId: data.knowledgeBaseId,
    runId: data.runId,
    enabled: true,
    deletedAt: null,
  };
  const source = await db.ragKbSource.findFirst({ where });
  if (!source) return { skipped: true };
  // A completed job replay is harmless. A stalled running job may resume idempotently.
  if (!['queued', 'running'].includes(source.status)) return { skipped: true };
  await db.ragKbSource.updateMany({ where, data: { status: 'running' } });
  let processed = 0,
    succeeded = 0,
    failed = 0;
  const errors: string[] = [];
  const sink: RagCollectSink = async (item, error) => {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM rag_kb_sources WHERE id=${data.sourceId} FOR UPDATE`;
      if (!(await tx.ragKbSource.findFirst({ where }))) throw new RagSourceCancelled();
      processed++;
      if (error || !item) {
        failed++;
        if (errors.length < 10) errors.push(error || 'Không đọc được nội dung.');
      } else {
        const content = normalizeRagContent(item.content),
          hash = ragContentHash(content);
        const scope = {
          organizationId: data.organizationId,
          knowledgeBaseId: data.knowledgeBaseId,
          sourceId: data.sourceId,
        };
        if (source.kind === 'WEBSITE') {
          await mergeWebsiteSummary(tx, scope, item);
        } else {
          const old = await tx.ragKbDocument.findFirst({
            where: { ...scope, externalId: item.externalId },
          });
          if (old) {
            // CAS protects concurrent manual edits even if the editor starts after this read.
            if (!old.manualEditedAt) {
              await tx.ragKbDocument.updateMany({
                where: { id: old.id, ...scope, manualEditedAt: null },
                data:
                  old.contentHash !== hash || old.title !== item.title.slice(0, 200)
                    ? documentData(item, content, hash)
                    : {
                        syncedAt: new Date(),
                        sourceUpdatedAt: item.sourceUpdatedAt || old.sourceUpdatedAt,
                      },
              });
            }
          } else if (
            content.length >= 10 &&
            !(await tx.ragKbDocument.findFirst({ where: { ...scope, contentHash: hash } }))
          ) {
            const count = await tx.ragKbDocument.count({
              where: { organizationId: data.organizationId, knowledgeBaseId: data.knowledgeBaseId },
            });
            if (count >= 500) throw new Error('DOCUMENT_LIMIT');
            await tx.ragKbDocument.create({
              data: {
                ...scope,
                externalId: item.externalId,
                sourceType: source.kind,
                ...documentData(item, content, hash),
              },
            });
          }
        }
        succeeded++;
      }
      await tx.ragKbSource.updateMany({ where, data: { processed, succeeded, failed, errors } });
    });
  };
  try {
    if (source.kind === 'WEBSITE') {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM rag_kb_sources WHERE id=${data.sourceId} FOR UPDATE`;
        if (!(await tx.ragKbSource.findFirst({ where }))) throw new RagSourceCancelled();
        await mergeWebsiteSummary(tx, {
          sourceId: data.sourceId,
          organizationId: data.organizationId,
          knowledgeBaseId: data.knowledgeBaseId,
        });
      });
      await (deps.website || collectRagWebsite)(source.url!, sink);
    } else {
      const page = await db.autoPostFacebookPage.findFirst({
        where: {
          id: source.facebookPageId || '',
          connection: { organizationId: data.organizationId },
        },
        include: { connection: true },
      });
      if (!page)
        throw new RagFacebookError(
          'PAGE_DISCONNECTED',
          'Fanpage đã ngắt kết nối hoặc không thuộc tổ chức.',
        );
      if (
        ['DISCONNECTED', 'ERROR', 'TOKEN_EXPIRED'].includes(page.connection.status) ||
        (page.connection.tokenExpiresAt && page.connection.tokenExpiresAt < new Date())
      )
        throw ragFacebookError(190);
      let token: string;
      try {
        token = decryptSecret(page.encryptedPageAccessToken, process.env.ENCRYPTION_KEY || '');
      } catch {
        throw new RagFacebookError(
          'TOKEN_UNREADABLE',
          'Không giải mã được token. Kiểm tra khóa mã hóa hoặc kết nối lại Facebook.',
        );
      }
      const version = process.env.META_API_VERSION || 'v21.0';
      if (!/^v\d+\.\d+$/.test(version)) throw new Error('INVALID_META_VERSION');
      await (deps.facebook || collectRagFacebook)(
        page.pageId,
        async (path, params) => {
          // Do not accept arbitrary URLs/edges/cursors that redirect credentials off Graph.
          if (![page.pageId, `${page.pageId}/posts`].includes(path))
            throw new Error('INVALID_GRAPH_EDGE');
          if (!(await db.ragKbSource.findFirst({ where }))) throw new RagSourceCancelled();
          const url = new URL(`https://graph.facebook.com/${version}/${path}`);
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
          const controller = new AbortController(),
            timer = setTimeout(() => controller.abort(), 15_000);
          try {
            const response = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
              redirect: 'error',
              signal: controller.signal,
            });
            const reader = response.body?.getReader();
            if (!reader) throw ragFacebookError();
            const parts: Uint8Array[] = [];
            let bytes = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 1_000_000) {
                await reader.cancel();
                throw ragFacebookError();
              }
              parts.push(value);
            }
            const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
            if (!response.ok || body.error) throw ragFacebookError(body.error?.code);
            // Calls within one source are sequential and bounded, including pagination.
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return body;
          } finally {
            clearTimeout(timer);
          }
        },
        sink,
      );
    }
    await db.ragKbSource.updateMany({
      where,
      data: {
        status: failed ? (succeeded ? 'partial' : 'error') : 'ready',
        processed,
        succeeded,
        failed,
        errors,
        lastError: errors[0] || null,
        ...(succeeded ? { lastSyncedAt: new Date() } : {}),
      },
    });
  } catch (error) {
    if (error instanceof RagSourceCancelled) return { skipped: true };
    // Do not persist provider exception bodies, request URLs, or decrypted tokens.
    const message =
      error instanceof RagFacebookError
        ? `${error.code}: ${error.message}`
        : 'Không hoàn tất đồng bộ. Nội dung đã lưu được giữ nguyên; hãy thử lại.';
    await db.ragKbSource.updateMany({
      where,
      data: {
        status: succeeded ? 'partial' : 'error',
        processed,
        succeeded,
        failed: failed + 1,
        errors: [...errors, message].slice(0, 10),
        lastError: message,
        ...(succeeded ? { lastSyncedAt: new Date() } : {}),
      },
    });
  }
  return { processed, succeeded, failed };
}
function documentData(item: RagCollectedItem, content: string, hash: string) {
  return {
    title: item.title.slice(0, 200),
    url: item.url.slice(0, 2000),
    content,
    contentHash: hash,
    sourceUpdatedAt: item.sourceUpdatedAt || null,
    syncedAt: new Date(),
    tokenCount: Math.max(1, Math.ceil(content.length / 4)),
    chunkCount: Math.max(1, Math.ceil(content.length / 800)),
    embeddingCount: 0,
    status: 'ready',
  };
}
export async function processRagSourceSync(job: Job<RagSourceJob>) {
  return runRagSourceSync(prisma, job.data);
}
