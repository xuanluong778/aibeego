import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RagHit = {
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  title: string;
  content: string;
  url: string | null;
  updatedAt: Date;
  documentVersion: Date;
  score: number;
};
export type RagPacket = { mode: 'text'; knowledgeBaseId: string; hits: RagHit[] };
export const normalizeRagQuery = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
const stop = new Set(
  'toi minh em anh chi ban ben cho biet muon can xin duoc la va cua ve voi co khong thi nao nhe oi mot nhung cac nay do tai day giup tu van thong tin tim hieu bao nhieu hien nay vay the sao nhu gi'.split(
    ' ',
  ),
);
export function ragQuery(text: string, history: Array<{ role: string; message: string }> = []) {
  const terms = (s: string) => [
    ...new Set(
      (normalizeRagQuery(s).match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !stop.has(t)),
    ),
  ];
  let tokens = terms(text);
  if (
    tokens.length <= 3 &&
    !/doi (?:sang|chu de)|thay (?:doi|chu de)/.test(normalizeRagQuery(text))
  ) {
    const previous = [...history].reverse().find((t) => t.role === 'user' && t.message !== text);
    if (previous) tokens = [...new Set([...tokens, ...terms(previous.message).slice(0, 8)])];
  }
  return tokens.slice(0, 24).join(' | ');
}
@Injectable()
export class RagRetrievalService {
  constructor(private readonly prisma: PrismaService) {}
  async isCurrent(organizationId: string, botId: string, packet: RagPacket) {
    const bot = await this.prisma.chatbotBot.findFirst({
      where: { id: botId, organizationId, knowledgeBaseId: packet.knowledgeBaseId },
      select: { id: true },
    });
    if (!bot) return false;
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
    return packet.hits.every((h) =>
      documents.some(
        (d) => d.id === h.documentId && d.updatedAt.getTime() === h.documentVersion.getTime(),
      ),
    );
  }
  async forBot(
    organizationId: string,
    botId: string,
    query: string,
    history: Array<{ role: string; message: string }> = [],
  ): Promise<RagPacket | undefined> {
    const bot = await this.prisma.chatbotBot.findFirst({
      where: { id: botId, organizationId },
      select: { knowledgeBaseId: true },
    });
    if (!bot) throw new NotFoundException('Không tìm thấy chatbot trong tổ chức.');
    if (!bot.knowledgeBaseId) return undefined;
    return {
      mode: 'text',
      knowledgeBaseId: bot.knowledgeBaseId,
      hits: await this.search(organizationId, query, bot.knowledgeBaseId, history),
    };
  }
  async search(
    organizationId: string,
    query: string,
    kbId?: string,
    history: Array<{ role: string; message: string }> = [],
  ): Promise<RagHit[]> {
    const q = ragQuery(query, history);
    if (!q) return [];
    const rows = await this.prisma.$queryRaw<RagHit[]>`
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
    const selected: RagHit[] = [],
      counts = new Map<string, number>();
    for (const hit of rows) {
      if ((counts.get(hit.documentId) || 0) >= 2) continue;
      if (selected.some((h) => h.documentId === hit.documentId && h.content === hit.content))
        continue;
      selected.push(hit);
      counts.set(hit.documentId, (counts.get(hit.documentId) || 0) + 1);
      if (selected.length >= 5) break;
    }
    return selected;
  }
}
