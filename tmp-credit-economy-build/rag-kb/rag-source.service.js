"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagSourceService = exports.RAG_SOURCE_QUEUE_TOKEN = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const ssrf_fetch_1 = require("@marketingspa/shared/dist/ssrf-fetch");
const rag_source_collect_1 = require("@marketingspa/shared/dist/rag-source-collect");
exports.RAG_SOURCE_QUEUE_TOKEN = 'RAG_SOURCE_QUEUE';
async function queueDeadline(operation) {
    let timer;
    try {
        return await Promise.race([
            operation,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('QUEUE_TIMEOUT')), 5000);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
let RagSourceService = class RagSourceService {
    prisma;
    queue;
    constructor(prisma, queue) {
        this.prisma = prisma;
        this.queue = queue;
    }
    async kb(organizationId, id) {
        const row = await this.prisma.ragKnowledgeBase.findFirst({
            where: { id, organizationId },
            select: { id: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy kho tri thức.');
    }
    async source(organizationId, knowledgeBaseId, id) {
        await this.kb(organizationId, knowledgeBaseId);
        const row = await this.prisma.ragKbSource.findFirst({
            where: { id, organizationId, knowledgeBaseId, deletedAt: null },
            omit: { websitePages: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy nguồn tri thức.');
        return row;
    }
    async pages(organizationId) {
        return this.prisma.autoPostFacebookPage.findMany({
            where: { connection: { organizationId } },
            select: { id: true, pageId: true, pageName: true, connection: { select: { status: true } } },
            orderBy: { pageName: 'asc' },
        });
    }
    async list(organizationId, knowledgeBaseId) {
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
                const job = await queueDeadline(this.queue.getJob(source.runId));
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
            }
            catch {
                /* Preserve state while Redis is unavailable. */
            }
        }
        return this.prisma.ragKbSource.findMany({
            where: { organizationId, knowledgeBaseId, deletedAt: null },
            omit: { websitePages: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(organizationId, knowledgeBaseId, dto) {
        await this.kb(organizationId, knowledgeBaseId);
        let url = null, facebookPageId = null, sourceKey;
        if (dto.kind === 'WEBSITE') {
            try {
                url = (0, rag_source_collect_1.canonicalRagUrl)(dto.url || '');
                await (0, ssrf_fetch_1.assertPublicHttpUrl)(url);
            }
            catch {
                throw new common_1.BadRequestException('URL website không hợp lệ hoặc không phải địa chỉ công khai được phép.');
            }
            sourceKey = `website:${url}`;
        }
        else {
            const page = await this.prisma.autoPostFacebookPage.findFirst({
                where: { id: dto.facebookPageId || '', connection: { organizationId } },
                select: { id: true, pageId: true },
            });
            if (!page)
                throw new common_1.NotFoundException('Fanpage không thuộc tổ chức hoặc chưa kết nối.');
            facebookPageId = page.id;
            sourceKey = `facebook:${page.pageId}`;
        }
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM rag_knowledge_bases WHERE id=${knowledgeBaseId} AND organization_id=${organizationId} FOR UPDATE`;
            const existing = await tx.ragKbSource.findUnique({
                where: {
                    organizationId_knowledgeBaseId_sourceKey: { organizationId, knowledgeBaseId, sourceKey },
                },
            });
            if ((!existing || existing.deletedAt) &&
                (await tx.ragKbSource.count({
                    where: { organizationId, knowledgeBaseId, deletedAt: null },
                })) >= 20)
                throw new common_1.BadRequestException('Tối đa 20 nguồn Website/Fanpage mỗi kho.');
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
    async sync(organizationId, knowledgeBaseId, id) {
        const row = await this.source(organizationId, knowledgeBaseId, id);
        if (!row.enabled)
            throw new common_1.BadRequestException('Bật nguồn trước khi đồng bộ.');
        if (['queued', 'running'].includes(row.status) && row.runId) {
            try {
                const job = await queueDeadline(this.queue.getJob(row.runId));
                if (job && ['active', 'waiting', 'delayed'].includes(await queueDeadline(job.getState())))
                    return row;
            }
            catch {
                throw new common_1.BadRequestException('Không kết nối được hàng đợi. Hãy thử lại sau.');
            }
        }
        const runId = (0, node_crypto_1.randomUUID)();
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
        if (!claimed.count)
            throw new common_1.ConflictException('Nguồn vừa thay đổi. Vui lòng tải lại.');
        try {
            await queueDeadline(this.queue.add('sync', { organizationId, knowledgeBaseId, sourceId: id, runId }, {
                jobId: runId,
                attempts: 1,
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 100 },
            }));
        }
        catch {
            await this.prisma.ragKbSource.updateMany({
                where: { id, organizationId, knowledgeBaseId, runId },
                data: {
                    status: 'error',
                    runId: null,
                    lastError: 'Không đưa được vào hàng đợi. Hãy đồng bộ lại.',
                },
            });
            throw new common_1.BadRequestException('Hàng đợi chưa sẵn sàng. Hãy thử đồng bộ lại.');
        }
        return this.source(organizationId, knowledgeBaseId, id);
    }
    async toggle(organizationId, knowledgeBaseId, id, enabled) {
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
    async remove(organizationId, knowledgeBaseId, id) {
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
};
exports.RagSourceService = RagSourceService;
exports.RagSourceService = RagSourceService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(exports.RAG_SOURCE_QUEUE_TOKEN)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Function])
], RagSourceService);
