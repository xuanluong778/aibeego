import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { assertPublicHttpUrl } from '@marketingspa/shared/dist/ssrf-fetch';
import { canonicalRagUrl } from '@marketingspa/shared/dist/rag-source-collect';
import { CreateRagSourceDto } from './dto/rag-kb.dto';

export const RAG_SOURCE_QUEUE_TOKEN = 'RAG_SOURCE_QUEUE';
async function queueDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('QUEUE_TIMEOUT')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
@Injectable()
export class RagSourceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RAG_SOURCE_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}
  private async kb(organizationId: string, id: string) {
    const row = await this.prisma.ragKnowledgeBase.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy kho tri thức.');
  }
  private async source(organizationId: string, knowledgeBaseId: string, id: string) {
    await this.kb(organizationId, knowledgeBaseId);
    const row = await this.prisma.ragKbSource.findFirst({
      where: { id, organizationId, knowledgeBaseId, deletedAt: null },
      omit: { websitePages: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy nguồn tri thức.');
    return row;
  }
  async pages(organizationId: string) {
    return this.prisma.autoPostFacebookPage.findMany({
      where: { connection: { organizationId } },
      select: { id: true, pageId: true, pageName: true, connection: { select: { status: true } } },
      orderBy: { pageName: 'asc' },
    });
  }
  async list(organizationId: string, knowledgeBaseId: string) {
    await this.kb(organizationId, knowledgeBaseId);
    const running = await this.prisma.ragKbSource.findMany({
      select: { id: true, runId: true, status: true },
      where: {
        organizationId,
        knowledgeBaseId,
        deletedAt: null,
        status: { in: ['queued', 'running'] },
        runId: { not: null },
      },
    });
    for (const source of running) {
      // Recover a crashed/exhausted/missing job so the user can explicitly retry.
      // Redis outages do not invalidate a still-running job or its successful content.
      try {
        const job = await queueDeadline(this.queue.getJob(source.runId!));
        const state = job ? await queueDeadline(job.getState()) : 'missing';
        if (['failed', 'completed', 'unknown', 'missing'].includes(state))
          await this.prisma.ragKbSource.updateMany({
            where: {
              id: source.id,
              organizationId,
              knowledgeBaseId,
              runId: source.runId,
              status: { in: ['queued', 'running'] },
            },
            data: {
              status: 'error',
              lastError: 'Job đã gián đoạn hoặc không còn trong hàng đợi. Hãy đồng bộ lại.',
            },
          });
      } catch {
        /* Preserve state while Redis is unavailable. */
      }
    }
    return this.prisma.ragKbSource.findMany({
      where: { organizationId, knowledgeBaseId, deletedAt: null },
      omit: { websitePages: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  async create(organizationId: string, knowledgeBaseId: string, dto: CreateRagSourceDto) {
    await this.kb(organizationId, knowledgeBaseId);
    let url: string | null = null,
      facebookPageId: string | null = null,
      sourceKey: string;
    if (dto.kind === 'WEBSITE') {
      try {
        url = canonicalRagUrl(dto.url || '');
        await assertPublicHttpUrl(url);
      } catch {
        throw new BadRequestException(
          'URL website không hợp lệ hoặc không phải địa chỉ công khai được phép.',
        );
      }
      sourceKey = `website:${url}`;
    } else {
      const page = await this.prisma.autoPostFacebookPage.findFirst({
        where: { id: dto.facebookPageId || '', connection: { organizationId } },
        select: { id: true, pageId: true },
      });
      if (!page) throw new NotFoundException('Fanpage không thuộc tổ chức hoặc chưa kết nối.');
      facebookPageId = page.id;
      sourceKey = `facebook:${page.pageId}`;
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM rag_knowledge_bases WHERE id=${knowledgeBaseId} AND organization_id=${organizationId} FOR UPDATE`;
      const existing = await tx.ragKbSource.findUnique({
        where: {
          organizationId_knowledgeBaseId_sourceKey: { organizationId, knowledgeBaseId, sourceKey },
        },
      });
      if (
        (!existing || existing.deletedAt) &&
        (await tx.ragKbSource.count({
          where: { organizationId, knowledgeBaseId, deletedAt: null },
        })) >= 20
      )
        throw new BadRequestException('Tối đa 20 nguồn Website/Fanpage mỗi kho.');
      return tx.ragKbSource.upsert({
        where: {
          organizationId_knowledgeBaseId_sourceKey: { organizationId, knowledgeBaseId, sourceKey },
        },
        create: {
          organizationId,
          knowledgeBaseId,
          sourceKey,
          url,
          facebookPageId,
          kind: dto.kind,
          status: 'idle',
        },
        update: {
          deletedAt: null,
          ...(existing?.deletedAt ? { enabled: true, status: 'idle' } : {}),
          ...(facebookPageId ? { facebookPageId } : {}),
        },
      });
    });
    return this.sync(organizationId, knowledgeBaseId, row.id);
  }
  async sync(organizationId: string, knowledgeBaseId: string, id: string) {
    const row = await this.source(organizationId, knowledgeBaseId, id);
    if (!row.enabled) throw new BadRequestException('Bật nguồn trước khi đồng bộ.');
    if (['queued', 'running'].includes(row.status) && row.runId) {
      try {
        const job = await queueDeadline(this.queue.getJob(row.runId));
        if (job && ['active', 'waiting', 'delayed'].includes(await queueDeadline(job.getState())))
          return row;
      } catch {
        throw new BadRequestException('Không kết nối được hàng đợi. Hãy thử lại sau.');
      }
    }
    const runId = randomUUID();
    const claimed = await this.prisma.ragKbSource.updateMany({
      where: {
        id,
        organizationId,
        knowledgeBaseId,
        deletedAt: null,
        enabled: true,
        runId: row.runId,
      },
      data: {
        runId,
        status: 'queued',
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        lastError: null,
        lastAttemptAt: new Date(),
      },
    });
    if (!claimed.count) throw new ConflictException('Nguồn vừa thay đổi. Vui lòng tải lại.');
    try {
      await queueDeadline(
        this.queue.add(
          'sync',
          { organizationId, knowledgeBaseId, sourceId: id, runId },
          {
            jobId: runId,
            attempts: 1,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 100 },
          },
        ),
      );
    } catch {
      await this.prisma.ragKbSource.updateMany({
        where: { id, organizationId, knowledgeBaseId, runId },
        data: {
          status: 'error',
          runId: null,
          lastError: 'Không đưa được vào hàng đợi. Hãy đồng bộ lại.',
        },
      });
      throw new BadRequestException('Hàng đợi chưa sẵn sàng. Hãy thử đồng bộ lại.');
    }
    return this.source(organizationId, knowledgeBaseId, id);
  }
  async toggle(organizationId: string, knowledgeBaseId: string, id: string, enabled: boolean) {
    await this.source(organizationId, knowledgeBaseId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.ragKbSource.updateMany({
        where: { id, organizationId, knowledgeBaseId, deletedAt: null },
        data: { enabled, runId: null, status: enabled ? 'idle' : 'paused' },
      });
      await tx.ragKbDocument.updateMany({
        where: { sourceId: id, organizationId, knowledgeBaseId },
        data: { status: enabled ? 'ready' : 'disabled' },
      });
    });
    return this.source(organizationId, knowledgeBaseId, id);
  }
  async remove(organizationId: string, knowledgeBaseId: string, id: string) {
    await this.source(organizationId, knowledgeBaseId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.ragKbSource.updateMany({
        where: { id, organizationId, knowledgeBaseId },
        data: { deletedAt: new Date(), enabled: false, runId: null, status: 'removed', websitePages: [] },
      });
      await tx.ragKbDocument.deleteMany({
        where: { sourceId: id, organizationId, knowledgeBaseId, manualEditedAt: null },
      });
      await tx.ragKbDocument.updateMany({
        where: { sourceId: id, organizationId, knowledgeBaseId },
        // Keep manual edits inspectable, but a removed source must no longer be retrieved.
        data: { status: 'disabled' },
      });
    });
    return { ok: true };
  }
}
