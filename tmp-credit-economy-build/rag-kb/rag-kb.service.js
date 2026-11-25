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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagKbService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const database_2 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const node_crypto_1 = require("node:crypto");
const rag_retrieval_service_1 = require("./rag-retrieval.service");
const rag_markdown_export_1 = require("./rag-markdown-export");
const rag_prompt_util_1 = require("./rag-prompt.util");
const website_crawl_util_1 = require("../chatbot-cskh/utils/website-crawl.util");
const MAX_KB = 30;
const MAX_DOCS_PER_KB = 100;
function estimateTokens(text) {
    return Math.max(1, Math.ceil(text.trim().length / 4));
}
function estimateChunks(text) {
    const parts = text
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 40);
    if (parts.length >= 2)
        return Math.min(200, parts.length);
    return Math.max(1, Math.ceil(text.length / 800));
}
function formatTokenCount(n) {
    if (n >= 1000)
        return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
    return String(n);
}
let RagKbService = class RagKbService {
    prisma;
    retrieval;
    constructor(prisma, retrieval) {
        this.prisma = prisma;
        this.retrieval = retrieval;
    }
    async findKbOrThrow(organizationId, id) {
        const kb = await this.prisma.ragKnowledgeBase.findFirst({
            where: { id, organizationId },
            include: { documents: { orderBy: { createdAt: 'desc' } } },
        });
        if (!kb)
            throw new common_1.NotFoundException('Không tìm thấy Knowledge Base');
        return kb;
    }
    serializeKb(kb) {
        const docs = kb.documents ?? [];
        const documentCount = docs.length;
        const chunkCount = docs.reduce((s, d) => s + d.chunkCount, 0);
        const embeddingCount = docs.reduce((s, d) => s + d.embeddingCount, 0);
        const tokenCount = docs.reduce((s, d) => s + d.tokenCount, 0);
        return {
            id: kb.id,
            name: kb.name,
            description: kb.description,
            isDefault: kb.isDefault,
            createdAt: kb.createdAt,
            updatedAt: kb.updatedAt,
            stats: {
                documentCount,
                chunkCount,
                embeddingCount,
                embeddingTotal: 0,
                retrievalMode: 'text',
                tokenCount,
                tokenLabel: formatTokenCount(tokenCount),
            },
            documents: docs.map((d) => ({
                id: d.id,
                title: d.title,
                sourceType: d.sourceType,
                url: d.url,
                chunkCount: d.chunkCount,
                tokenCount: d.tokenCount,
                embeddingCount: d.embeddingCount,
                status: d.status,
                preview: (d.content || '').slice(0, 200),
                createdAt: d.createdAt,
            })),
        };
    }
    async list(organizationId) {
        const rows = await this.prisma.ragKnowledgeBase.findMany({
            where: { organizationId },
            include: {
                documents: true,
                linkedBots: { select: { id: true, botName: true, status: true } },
            },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });
        return rows.map((kb) => ({
            ...this.serializeKb(kb),
            linkedBots: (kb.linkedBots ?? []).map((b) => ({
                id: b.id,
                name: b.botName,
                status: b.status,
            })),
        }));
    }
    async get(organizationId, id) {
        return this.serializeKb(await this.findKbOrThrow(organizationId, id));
    }
    async create(organizationId, dto) {
        const count = await this.prisma.ragKnowledgeBase.count({ where: { organizationId } });
        if (count >= MAX_KB) {
            throw new common_1.BadRequestException(`Tối đa ${MAX_KB} Knowledge Base.`);
        }
        if (dto.isDefault) {
            await this.prisma.ragKnowledgeBase.updateMany({
                where: { organizationId, isDefault: true },
                data: { isDefault: false },
            });
        }
        const kb = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'knowledgeBases', (tx) => tx.ragKnowledgeBase.count({ where: { organizationId } }), (tx) => tx.ragKnowledgeBase.create({
            data: {
                organizationId,
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
                isDefault: dto.isDefault ?? count === 0,
            },
            include: { documents: true },
        }));
        return this.serializeKb(kb);
    }
    async exportMarkdown(organizationId, kbId) {
        const kb = await this.prisma.ragKnowledgeBase.findFirst({ where: { id: kbId, organizationId }, select: { name: true } });
        if (!kb)
            throw new common_1.NotFoundException('Không tìm thấy kho tri thức.');
        const [documents, profile] = await Promise.all([
            this.prisma.ragKbDocument.findMany({ where: { organizationId, knowledgeBaseId: kbId, status: { in: ['ready', 'active'] }, OR: [{ sourceId: null }, { source: { is: { enabled: true, deletedAt: null } } }] }, orderBy: { createdAt: 'asc' } }),
            this.prisma.businessProfile.findUnique({ where: { organizationId } }),
        ]);
        return { filename: `knowledge-${kbId}.md`, body: Buffer.from((0, rag_markdown_export_1.exportRagMarkdown)(kb.name, documents, profile), 'utf8') };
    }
    async update(organizationId, id, dto) {
        await this.findKbOrThrow(organizationId, id);
        if (dto.isDefault === true) {
            await this.prisma.ragKnowledgeBase.updateMany({
                where: { organizationId, isDefault: true },
                data: { isDefault: false },
            });
        }
        const kb = await this.prisma.ragKnowledgeBase.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description.trim() || null }
                    : {}),
                ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
            },
            include: { documents: true },
        });
        return this.serializeKb(kb);
    }
    async remove(organizationId, id) {
        await this.findKbOrThrow(organizationId, id);
        await this.prisma.ragKnowledgeBase.delete({ where: { id } });
        return { success: true };
    }
    async addDocument(organizationId, knowledgeBaseId, data) {
        const docCount = await this.prisma.ragKbDocument.count({
            where: { knowledgeBaseId },
        });
        if (docCount >= MAX_DOCS_PER_KB) {
            throw new common_1.BadRequestException(`Tối đa ${MAX_DOCS_PER_KB} tài liệu / KB.`);
        }
        const content = data.content.trim().slice(0, 200_000);
        if (content.length < 10) {
            throw new common_1.BadRequestException('Nội dung tài liệu quá ngắn.');
        }
        const chunkCount = estimateChunks(content);
        const tokenCount = estimateTokens(content);
        await this.prisma.ragKbDocument.create({
            data: {
                organizationId,
                knowledgeBaseId,
                title: data.title.slice(0, 200),
                sourceType: data.sourceType,
                url: data.url?.slice(0, 2000) || null,
                content,
                chunkCount,
                tokenCount,
                embeddingCount: 0,
                status: 'ready',
            },
        });
        return this.get(organizationId, knowledgeBaseId);
    }
    async importText(organizationId, kbId, dto) {
        await this.findKbOrThrow(organizationId, kbId);
        return this.addDocument(organizationId, kbId, {
            title: dto.title,
            sourceType: 'TEXT',
            content: dto.content,
        });
    }
    async importFile(organizationId, kbId, file) {
        await this.findKbOrThrow(organizationId, kbId);
        const name = file.originalname || 'document.txt';
        if (!/\.(txt|md|markdown|csv|json)$/i.test(name)) {
            throw new common_1.BadRequestException('Chỉ hỗ trợ .txt, .md, .csv, .json');
        }
        if (!file.buffer?.length)
            throw new common_1.BadRequestException('File trống');
        if (file.buffer.length > 2 * 1024 * 1024) {
            throw new common_1.BadRequestException('File tối đa 2MB');
        }
        const content = file.buffer.toString('utf8');
        return this.addDocument(organizationId, kbId, {
            title: name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Tài liệu',
            sourceType: 'FILE',
            content,
        });
    }
    async importUrl(organizationId, kbId, dto) {
        await this.findKbOrThrow(organizationId, kbId);
        let result;
        try {
            result = await (0, website_crawl_util_1.fetchAndExtractUrl)(dto.url);
        }
        catch (e) {
            if (e instanceof website_crawl_util_1.CrawlValidationError || e instanceof website_crawl_util_1.CrawlFetchError) {
                throw new common_1.BadRequestException(e.message);
            }
            throw new common_1.BadRequestException('Không quét được website');
        }
        return this.addDocument(organizationId, kbId, {
            title: (dto.title || result.title || 'Website').slice(0, 200),
            sourceType: 'URL',
            url: result.pageUrl,
            content: result.content,
        });
    }
    async reindex(organizationId, kbId) {
        await this.findKbOrThrow(organizationId, kbId);
        // Database trigger rebuilds actual text chunks atomically; embeddings remain zero.
        await this.prisma.$executeRaw `UPDATE rag_kb_documents SET content=content WHERE organization_id=${organizationId} AND knowledge_base_id=${kbId}`;
        return this.get(organizationId, kbId);
    }
    async deleteDocument(organizationId, kbId, docId) {
        await this.findKbOrThrow(organizationId, kbId);
        const doc = await this.prisma.ragKbDocument.findFirst({
            where: { id: docId, knowledgeBaseId: kbId, organizationId },
        });
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy tài liệu');
        await this.prisma.ragKbDocument.delete({ where: { id: docId } });
        return this.get(organizationId, kbId);
    }
    async search(organizationId, dto) {
        const hits = await this.retrieval.search(organizationId, dto.query, dto.knowledgeBaseId);
        return { query: dto.query, retrievalMode: 'text', results: hits.map(h => ({ ...h, excerpt: h.content })) };
    }
    /** Build a system prompt block from KB search hits (assistant / content). */
    async getPromptBlock(organizationId, query, opts) {
        const q = String(query || '').trim();
        if (!q)
            return '';
        const { results } = await this.search(organizationId, {
            query: q,
            knowledgeBaseId: opts?.knowledgeBaseId,
        });
        const limit = Math.max(1, Math.min(opts?.limit ?? 5, 20));
        const hits = results.slice(0, limit).map((r) => ({
            title: r.title,
            content: r.excerpt,
            url: r.url || undefined,
            updatedAt: r.updatedAt.toISOString(),
            sourceType: 'rag_kb',
            score: r.score,
        }));
        return (0, rag_prompt_util_1.formatRagForPrompt)(hits, opts?.mode ?? 'chat');
    }
    async ensureBot(organizationId, botId) {
        const bot = await this.prisma.chatbotBot.findFirst({
            where: { id: botId, organizationId },
        });
        if (!bot)
            throw new common_1.NotFoundException('Không tìm thấy chatbot');
        return bot;
    }
    async importBotSourcesToKb(organizationId, botId, knowledgeBaseId) {
        const sources = await this.prisma.chatbotKnowledgeSource.findMany({
            where: {
                organizationId,
                botId,
                status: { in: ['active', 'ready'] },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (!sources.length)
            return 0;
        const existing = await this.prisma.ragKbDocument.findMany({
            where: { knowledgeBaseId, organizationId },
            select: { title: true },
        });
        const titles = new Set(existing.map((d) => d.title.trim().toLowerCase()));
        let imported = 0;
        for (const src of sources) {
            const content = (src.content || '').trim();
            if (content.length < 10)
                continue;
            const title = src.title.trim() || 'Nguồn chatbot';
            if (titles.has(title.toLowerCase()))
                continue;
            await this.addDocument(organizationId, knowledgeBaseId, {
                title,
                sourceType: String(src.sourceType || 'TEXT'),
                url: src.url,
                content,
            });
            titles.add(title.toLowerCase());
            imported += 1;
        }
        return imported;
    }
    async listChatbotsForKnowledge(organizationId) {
        const [bots, zaloChannels] = await Promise.all([
            this.prisma.chatbotBot.findMany({
                where: { organizationId },
                include: { knowledgeBase: { select: { id: true, name: true } } },
                orderBy: { updatedAt: 'desc' },
            }),
            this.prisma.chatbotChannel.findMany({
                where: { organizationId, channelType: 'ZALO', botId: { not: null } },
                select: { botId: true, config: true },
            }),
        ]);
        const zaloByBot = new Map();
        for (const ch of zaloChannels) {
            if (!ch.botId)
                continue;
            const cfg = ch.config || {};
            zaloByBot.set(ch.botId, {
                connected: true,
                autoReply: cfg.zaloAutoReply === true,
            });
        }
        const counts = await this.prisma.chatbotKnowledgeSource.groupBy({
            by: ['botId'],
            where: { organizationId, status: { in: ['active', 'ready'] } },
            _count: { _all: true },
        });
        const countByBot = new Map(counts.map((c) => [c.botId, c._count._all]));
        return bots.map((bot) => {
            const zalo = zaloByBot.get(bot.id);
            return {
                id: bot.id,
                botName: bot.botName,
                status: bot.status,
                knowledgeBaseId: bot.knowledgeBaseId,
                knowledgeBaseName: bot.knowledgeBase?.name ?? null,
                existingSourceCount: countByBot.get(bot.id) ?? 0,
                zaloConnected: Boolean(zalo?.connected),
                zaloAutoReply: Boolean(zalo?.autoReply),
            };
        });
    }
    async connectBotKnowledge(organizationId, botId, input) {
        const bot = await this.ensureBot(organizationId, botId);
        await this.findKbOrThrow(organizationId, input.knowledgeBaseId);
        let imported = 0;
        if (!bot.knowledgeBaseId) {
            imported = await this.importBotSourcesToKb(organizationId, botId, input.knowledgeBaseId);
        }
        await this.prisma.chatbotBot.update({
            where: { id: botId },
            data: { knowledgeBaseId: input.knowledgeBaseId },
        });
        if (typeof input.zaloAutoReply === 'boolean') {
            await this.setBotZaloAutoReply(organizationId, botId, input.zaloAutoReply);
        }
        return {
            botId,
            knowledgeBaseId: input.knowledgeBaseId,
            importedSourceCount: imported,
        };
    }
    async consolidateBotKnowledge(organizationId, botId) {
        const bot = await this.ensureBot(organizationId, botId);
        if (bot.knowledgeBaseId) {
            const imported = await this.importBotSourcesToKb(organizationId, botId, bot.knowledgeBaseId);
            return { botId, knowledgeBaseId: bot.knowledgeBaseId, importedSourceCount: imported };
        }
        const kb = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'knowledgeBases', (tx) => tx.ragKnowledgeBase.count({ where: { organizationId } }), (tx) => tx.ragKnowledgeBase.create({
            data: {
                organizationId,
                name: `${bot.botName} — kho tri thức`,
                description: 'Tự động gộp từ nguồn Chatbot CSKH',
                isDefault: false,
                botId: bot.id,
            },
        }));
        const imported = await this.importBotSourcesToKb(organizationId, botId, kb.id);
        await this.prisma.chatbotBot.update({
            where: { id: botId },
            data: { knowledgeBaseId: kb.id },
        });
        return { botId, knowledgeBaseId: kb.id, importedSourceCount: imported };
    }
    async setBotZaloAutoReply(organizationId, botId, enabled) {
        const channel = await this.prisma.chatbotChannel.findFirst({
            where: { organizationId, botId, channelType: 'ZALO' },
        });
        if (!channel)
            return;
        const prev = channel.config || {};
        await this.prisma.chatbotChannel.update({
            where: { id: channel.id },
            data: {
                config: { ...prev, zaloAutoReply: enabled },
            },
        });
    }
    async listZaloOasForKnowledge(organizationId) {
        const rows = await this.prisma.messagingChannelConnection.findMany({
            where: {
                organizationId,
                channel: database_2.MessageChannel.ZALO,
                providerKind: database_2.MessagingProviderKind.ZALO_OA,
            },
            orderBy: { updatedAt: 'desc' },
        });
        return rows.map((r) => {
            const meta = r.metadata || {};
            return {
                id: r.id,
                name: r.displayName || r.accountRef,
                status: r.status,
                isPaused: r.isPaused,
                botId: typeof meta.botId === 'string' ? meta.botId : null,
            };
        });
    }
    async connectZaloOaBot(organizationId, connectionId, botId) {
        const row = await this.prisma.messagingChannelConnection.findFirst({
            where: {
                id: connectionId,
                organizationId,
                channel: database_2.MessageChannel.ZALO,
                providerKind: database_2.MessagingProviderKind.ZALO_OA,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy kết nối Zalo OA');
        if (botId)
            await this.ensureBot(organizationId, botId);
        const prev = row.metadata || {};
        const nextMeta = { ...prev };
        if (botId)
            nextMeta.botId = botId;
        else
            delete nextMeta.botId;
        await this.prisma.messagingChannelConnection.update({
            where: { id: connectionId },
            data: { metadata: nextMeta },
        });
        return { connectionId, botId };
    }
    async getDocumentDetail(organizationId, kbId, docId) {
        await this.findKbOrThrow(organizationId, kbId);
        const doc = await this.prisma.ragKbDocument.findFirst({
            where: { id: docId, knowledgeBaseId: kbId, organizationId },
        });
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy tài liệu');
        const content = doc.content || '';
        const chunks = await this.prisma.ragKbChunk.findMany({ where: { documentId: docId, organizationId, knowledgeBaseId: kbId }, orderBy: { chunkIndex: 'asc' }, take: 100 });
        return {
            id: doc.id,
            title: doc.title,
            sourceType: doc.sourceType,
            url: doc.url,
            chunkCount: doc.chunkCount,
            tokenCount: doc.tokenCount,
            embeddingCount: doc.embeddingCount,
            status: doc.status,
            preview: content.slice(0, 200),
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            content,
            contentLength: content.length,
            chunks: chunks.map(chunk => ({
                index: chunk.chunkIndex,
                text: chunk.content,
                charCount: chunk.content.length,
                tokenEstimate: estimateTokens(chunk.content),
            })),
        };
    }
    async updateDocument(organizationId, kbId, docId, input) {
        await this.findKbOrThrow(organizationId, kbId);
        const doc = await this.prisma.ragKbDocument.findFirst({
            where: { id: docId, knowledgeBaseId: kbId, organizationId },
        });
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy tài liệu');
        const content = input.content.trim();
        if (content.length > 3_000_000)
            throw new common_1.BadRequestException('Nội dung tối đa 3 triệu ký tự.');
        if (content.length < 10)
            throw new common_1.BadRequestException('Nội dung tài liệu quá ngắn.');
        await this.prisma.ragKbDocument.update({
            where: { id: docId },
            data: {
                title: input.title.trim().slice(0, 200),
                content,
                manualEditedAt: new Date(),
                contentHash: (0, node_crypto_1.createHash)('sha256').update(content).digest('hex'),
                chunkCount: estimateChunks(content),
                tokenCount: estimateTokens(content),
                embeddingCount: 0,
            },
        });
        return this.getDocumentDetail(organizationId, kbId, docId);
    }
    async downloadDocument(organizationId, kbId, docId) {
        await this.findKbOrThrow(organizationId, kbId);
        const doc = await this.prisma.ragKbDocument.findFirst({
            where: { id: docId, knowledgeBaseId: kbId, organizationId },
        });
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy tài liệu');
        const safe = doc.title.replace(/[^\w\u00C0-\u1EF9.-]+/g, '_').slice(0, 80) || 'tai-lieu';
        const websiteSummary = doc.sourceType === 'WEBSITE' && doc.externalId === 'website:summary';
        return {
            filename: websiteSummary ? `website-${new URL(doc.url).hostname}.md` : `${safe}.txt`,
            contentType: websiteSummary ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
            body: doc.content,
        };
    }
};
exports.RagKbService = RagKbService;
exports.RagKbService = RagKbService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, rag_retrieval_service_1.RagRetrievalService])
], RagKbService);
