"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRagQuery = buildRagQuery;
exports.formatRagForPrompt = formatRagForPrompt;
exports.prependKnowledgeToMessages = prependKnowledgeToMessages;
exports.withKnowledgeOpenAi = withKnowledgeOpenAi;
const rag_grounded_reply_1 = require("./rag-grounded-reply");
/** Ghép các field DTO thành query search KB. */
function buildRagQuery(...parts) {
    return parts
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 500);
}
/** Format hits thành block đưa vào system/user prompt. */
function formatRagForPrompt(hits, mode = 'content') {
    if (!hits.length)
        return '';
    const body = hits
        .map((h, i) => `[KB ${i + 1}: ${h.title}] URL: ${h.url || 'Tài liệu nhập tay'}; Cập nhật: ${h.updatedAt || 'chưa rõ'}\n${h.content.slice(0, 2100)}`)
        .join('\n\n')
        .slice(0, 10000);
    const safety = `${rag_grounded_reply_1.RAG_DATA_RULES}\nBEGIN_UNTRUSTED_KNOWLEDGE\n${body}\nEND_UNTRUSTED_KNOWLEDGE`;
    if (mode === 'chat') {
        return `=== AI KNOWLEDGE BASE (ưu tiên tuyệt đối) ===
Chỉ dùng sự thật từ block dưới khi trả lời khách. Không bịa giá/chính sách/cam kết.
Nếu không có thông tin liên quan trong KB, nói rõ chưa có dữ liệu / dùng fallback hiện có.

${safety}`;
    }
    return `=== AI KNOWLEDGE BASE (ưu tiên sự thật doanh nghiệp) ===
Khi viết content/caption/quảng cáo/tin nhắn, ưu tiên thông tin thật từ Knowledge Base dưới đây (dịch vụ, giá, ưu đãi, chính sách, USP).
Không bịa giá, cam kết, chứng nhận hay chi tiết kỹ thuật không có trong KB.
Nếu KB không đề cập, viết chung chung và tránh khẳng định sai.

${safety}`;
}
/** Chèn knowledge block vào đầu messages (system). */
function prependKnowledgeToMessages(messages, knowledgeBlock) {
    const block = knowledgeBlock.trim();
    if (!block)
        return messages;
    return [{ role: 'system', content: block }, ...messages];
}
/**
 * Proxy OpenAiService: mọi chatCompletion / chatCompletionWithTools
 * tự gắn Knowledge Base — dùng cho content/auto-post mà không sửa từng logic file.
 */
function withKnowledgeOpenAi(openai, knowledgeBlock) {
    const block = knowledgeBlock.trim();
    if (!block)
        return openai;
    return new Proxy(openai, {
        get(target, prop, receiver) {
            if (prop === 'chatCompletion') {
                return async (params) => target.chatCompletion({
                    ...params,
                    messages: prependKnowledgeToMessages(params.messages, block),
                });
            }
            if (prop === 'chatCompletionWithTools') {
                return async (params) => target.chatCompletionWithTools({
                    ...params,
                    messages: prependKnowledgeToMessages(params.messages, block),
                });
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}
