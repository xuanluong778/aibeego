import { createHash } from 'node:crypto';
import type { Prisma } from '@marketingspa/database';
import {
  decodeRagEntities,
  normalizeRagContent,
  type RagCollectedItem,
} from '@marketingspa/shared/dist/rag-source-collect';

export const WEBSITE_SUMMARY_ID = 'website:summary';
type Page = {
  externalId: string;
  url: string;
  title: string;
  content: string;
  syncedAt: string;
  sourceUpdatedAt?: string;
  manualEditedAt?: string;
  startOffset?: number;
};
type Scope = { sourceId: string; organizationId: string; knowledgeBaseId: string };
/** Caller holds the source row lock. All page snapshots and the one document commit together. */
export async function mergeWebsiteSummary(
  tx: Prisma.TransactionClient,
  scope: Scope,
  item?: RagCollectedItem,
) {
  const source = await tx.ragKbSource.findFirst({
    where: {
      id: scope.sourceId,
      organizationId: scope.organizationId,
      knowledgeBaseId: scope.knowledgeBaseId,
      kind: 'WEBSITE',
      deletedAt: null,
    },
  });
  if (!source) return;
  const documents = await tx.ragKbDocument.findMany({
    where: scope,
    orderBy: { createdAt: 'asc' },
  });
  const pages = new Map<string, Page>();
  if (Array.isArray(source.websitePages))
    for (const raw of source.websitePages) {
      const p = raw as unknown as Page;
      if (
        p &&
        typeof p.externalId === 'string' &&
        typeof p.url === 'string' &&
        typeof p.content === 'string' &&
        typeof p.title === 'string'
      )
        pages.set(p.externalId, p);
    }
  // Convert existing per-page documents, including manually edited pages, without losing text.
  for (const doc of documents.filter((d) => d.externalId !== WEBSITE_SUMMARY_ID)) {
    const id = doc.externalId || doc.url || doc.id;
    if (!pages.has(id) || doc.manualEditedAt)
      pages.set(id, {
        externalId: id,
        url: doc.url || source.url!,
        title: decodeRagEntities(doc.title),
        content: doc.content,
        syncedAt: (doc.syncedAt || doc.updatedAt).toISOString(),
        ...(doc.sourceUpdatedAt ? { sourceUpdatedAt: doc.sourceUpdatedAt.toISOString() } : {}),
        ...(doc.manualEditedAt ? { manualEditedAt: doc.manualEditedAt.toISOString() } : {}),
      });
  }
  if (item && !pages.get(item.externalId)?.manualEditedAt)
    pages.set(item.externalId, {
      externalId: item.externalId,
      url: item.url,
      title: decodeRagEntities(item.title),
      content: normalizeRagContent(item.content),
      syncedAt: new Date().toISOString(),
      ...(item.sourceUpdatedAt ? { sourceUpdatedAt: item.sourceUpdatedAt.toISOString() } : {}),
    });
  if (!pages.size) return;
  const ordered = [...pages.values()].sort((a, b) =>
    a.url === source.url ? -1 : b.url === source.url ? 1 : a.url.localeCompare(b.url),
  );
  const host = new URL(source.url!).hostname;
  const label = (text: string) => text.replace(/[\r\n]/g, ' ').replace(/([\\`*_[\]<>])/g, '\\$1');
  let content = `# Tổng hợp tri thức website — ${host}\n\n- **Website nguồn:** ${source.url}\n- **Số trang đã thu thập:** ${ordered.length}\n\n## Mục lục nguồn\n\n`;
  content += ordered.map((p, i) => `${i + 1}. [${label(p.title)}](${p.url})`).join('\n') + '\n\n---\n\n';
  for (const [index, p] of ordered.entries()) {
    p.startOffset = Array.from(content).length + 1;
    content += `## ${index + 1}. ${label(p.title)}\n\n- **Nguồn trang:** ${p.url}\n- **Cập nhật trang:** ${p.sourceUpdatedAt || p.syncedAt}\n${p.manualEditedAt ? `- **Chỉnh sửa thủ công:** ${p.manualEditedAt}\n` : ''}\n${p.content}\n\n---\n\n`;
  }
  const summary = documents.find((d) => d.externalId === WEBSITE_SUMMARY_ID);
  const survivor = summary || documents.find((d) => d.url === source.url) || documents[0];
  const values = {
    title: `Tổng hợp website — ${host}`,
    externalId: WEBSITE_SUMMARY_ID,
    url: source.url,
    sourceType: 'WEBSITE',
    content,
    contentHash: createHash('sha256').update(content).digest('hex'),
    syncedAt: new Date(),
    tokenCount: Math.ceil(content.length / 4),
    chunkCount: Math.ceil(content.length / 1280),
    embeddingCount: 0,
    status: source.enabled ? 'ready' : 'disabled',
  };
  let documentId: string;
  if (survivor) {
    documentId = survivor.id;
    if (!summary?.manualEditedAt)
      await tx.ragKbDocument.update({
        where: { id: survivor.id },
        data: { ...values, manualEditedAt: null },
      });
  } else documentId = (await tx.ragKbDocument.create({ data: { ...scope, ...values } })).id;
  await tx.ragKbSource.update({
    where: { id: source.id },
    data: { websitePages: ordered as unknown as Prisma.InputJsonValue },
  });
  await tx.ragKbDocument.deleteMany({ where: { ...scope, id: { not: documentId } } });
  return documentId;
}
