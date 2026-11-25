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
exports.RagRetrievalService = exports.normalizeRagQuery = void 0;
exports.ragQuery = ragQuery;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const normalizeRagQuery = (text) => text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
exports.normalizeRagQuery = normalizeRagQuery;
const stop = new Set('toi minh em anh chi ban ben cho biet muon can xin duoc la va cua ve voi co khong thi nao nhe oi mot nhung cac nay do tai day giup tu van thong tin tim hieu bao nhieu hien nay vay the sao nhu gi'.split(' '));
function ragQuery(text, history = []) {
    const terms = (s) => [
        ...new Set(((0, exports.normalizeRagQuery)(s).match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !stop.has(t))),
    ];
    let tokens = terms(text);
    if (tokens.length <= 3 &&
        !/doi (?:sang|chu de)|thay (?:doi|chu de)/.test((0, exports.normalizeRagQuery)(text))) {
        const previous = [...history].reverse().find((t) => t.role === 'user' && t.message !== text);
        if (previous)
            tokens = [...new Set([...tokens, ...terms(previous.message).slice(0, 8)])];
    }
    return tokens.slice(0, 24).join(' | ');
}
let RagRetrievalService = class RagRetrievalService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async isCurrent(organizationId, botId, packet) {
        const bot = await this.prisma.chatbotBot.findFirst({
            where: { id: botId, organizationId, knowledgeBaseId: packet.knowledgeBaseId },
            select: { id: true },
        });
        if (!bot)
            return false;
        const documents = await this.prisma.ragKbDocument.findMany({
            where: {
                id: { in: packet.hits.map((h) => h.documentId) },
                organizationId,
                knowledgeBaseId: packet.knowledgeBaseId,
                status: { in: ['ready', 'active'] },
                OR: [{ sourceId: null }, { source: { is: { enabled: true, deletedAt: null } } }],
            },
            select: { id: true, updatedAt: true },
        });
        return packet.hits.every((h) => documents.some((d) => d.id === h.documentId && d.updatedAt.getTime() === h.documentVersion.getTime()));
    }
    async forBot(organizationId, botId, query, history = []) {
        const bot = await this.prisma.chatbotBot.findFirst({
            where: { id: botId, organizationId },
            select: { knowledgeBaseId: true },
        });
        if (!bot)
            throw new common_1.NotFoundException('Không tìm thấy chatbot trong tổ chức.');
        if (!bot.knowledgeBaseId)
            return undefined;
        return {
            mode: 'text',
            knowledgeBaseId: bot.knowledgeBaseId,
            hits: await this.search(organizationId, query, bot.knowledgeBaseId, history),
        };
    }
    async search(organizationId, query, kbId, history = []) {
        const q = ragQuery(query, history);
        if (!q)
            return [];
        const rows = await this.prisma.$queryRaw `
      SELECT c.id AS "chunkId", d.id AS "documentId", k.id AS "knowledgeBaseId", k.name AS "knowledgeBaseName", d.title,
        substring(d.content FROM greatest(1,c.start_offset-250) FOR 2100) AS content, COALESCE(page.url,d.url) AS url,
        COALESCE(d.source_updated_at,d.synced_at,d.updated_at) AS "updatedAt", d.updated_at AS "documentVersion",
        ts_rank_cd(c.search_vector,to_tsquery('simple',${q}))::float8 AS score
      FROM rag_kb_chunks c JOIN rag_kb_documents d ON d.id=c.document_id AND d.organization_id=c.organization_id AND d.knowledge_base_id=c.knowledge_base_id
      JOIN rag_knowledge_bases k ON k.id=d.knowledge_base_id AND k.organization_id=d.organization_id
      LEFT JOIN rag_kb_sources s ON s.id=d.source_id AND s.organization_id=d.organization_id AND s.knowledge_base_id=d.knowledge_base_id
      LEFT JOIN LATERAL (
        SELECT p->>'url' AS url FROM jsonb_array_elements(COALESCE(s.website_pages,'[]'::jsonb)) p
        WHERE d.external_id='website:summary' AND d.manual_edited_at IS NULL AND (p->>'startOffset')::integer<=c.start_offset
        ORDER BY (p->>'startOffset')::integer DESC LIMIT 1
      ) page ON true
      WHERE c.organization_id=${organizationId} AND (${kbId || null}::text IS NULL OR c.knowledge_base_id=${kbId || null})
        AND d.status IN ('ready','active') AND (d.source_id IS NULL OR (s.enabled=true AND s.deleted_at IS NULL))
        AND c.search_vector @@ to_tsquery('simple',${q})
      ORDER BY score DESC,d.updated_at DESC,c.chunk_index ASC LIMIT 24`;
        const selected = [], counts = new Map();
        for (const hit of rows) {
            if ((counts.get(hit.documentId) || 0) >= 2)
                continue;
            if (selected.some((h) => h.documentId === hit.documentId && h.content === hit.content))
                continue;
            selected.push(hit);
            counts.set(hit.documentId, (counts.get(hit.documentId) || 0) + 1);
            if (selected.length >= 5)
                break;
        }
        return selected;
    }
};
exports.RagRetrievalService = RagRetrievalService;
exports.RagRetrievalService = RagRetrievalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RagRetrievalService);
