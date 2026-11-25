"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPromptInjection = detectPromptInjection;
exports.searchKnowledge = searchKnowledge;
exports.generateAiReply = generateAiReply;
const rag_grounded_reply_1 = require("../../rag-kb/rag-grounded-reply");
const chatbot_constants_1 = require("./chatbot-constants");
function detectPromptInjection(text) {
    const t = text.toLowerCase();
    return /(?:ignore|bypass|forget)\s+(?:all\s+)?(?:previous|above)\s+instructions|jailbreak|system\s+prompt|bạn\s+là\s+giờ\s+hãy/i.test(t);
}
function tokenize(query) {
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
}
function searchKnowledge(sources, query, limit = 5) {
    const tokens = tokenize(query);
    if (!tokens.length)
        return [];
    const scored = [];
    for (const row of sources) {
        if (!['ready', 'active'].includes(row.status))
            continue;
        const hay = `${row.title} ${row.content ?? ''} ${row.url ?? ''}`.toLowerCase();
        const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
        if (score > 0)
            scored.push({ score, row });
    }
    scored.sort((a, b) => b.score - a.score || (b.row.content?.length ?? 0) - (a.row.content?.length ?? 0));
    return scored.slice(0, limit).map(({ score, row }) => ({
        sourceId: row.id,
        title: row.title,
        sourceType: row.sourceType,
        content: (row.content ?? '').slice(0, 4000),
        score,
    }));
}
function botProfileContext(bot) {
    const parts = [];
    if (bot.businessName)
        parts.push(`Tên doanh nghiệp: ${bot.businessName}`);
    if (bot.industry)
        parts.push(`Ngành nghề: ${bot.industry}`);
    if (bot.hotline)
        parts.push(`Hotline: ${bot.hotline}`);
    if (bot.mainServices)
        parts.push(`Dịch vụ chính: ${bot.mainServices}`);
    if (bot.websiteUrl)
        parts.push(`Website: ${bot.websiteUrl}`);
    return parts.join('\n');
}
function isGreetingOnly(text) {
    const t = text.trim();
    if (!t || t.length > 40)
        return false;
    return /^(xin\s*chào|chào|hello|hi|hey)\b/i.test(t);
}
function profileMatchesQuery(profileText, query) {
    if (!profileText.trim())
        return false;
    const qlow = query.toLowerCase();
    const hints = ['liên hệ', 'hotline', 'gọi', 'sđt', 'sdt', 'zalo', 'dịch vụ', 'làm gì', 'cung cấp', 'website'];
    if (hints.some((h) => qlow.includes(h)))
        return true;
    const tokens = tokenize(query);
    const low = profileText.toLowerCase();
    return tokens.some((t) => low.includes(t));
}
function shouldShowLead(userText, reply) {
    if (reply.includes(chatbot_constants_1.NO_DATA_REPLY))
        return true;
    const low = `${userText} ${reply}`.toLowerCase();
    return chatbot_constants_1.LEAD_KEYWORDS.some((k) => low.includes(k));
}
function knowledgeContext(chunks) {
    if (!chunks.length)
        return '';
    return chunks
        .map((ch, i) => `[Nguồn ${i + 1}: ${ch.title}]\n${ch.content}`)
        .join('\n\n')
        .slice(0, 12000);
}
function buildSystemPrompt(bot, knowledgeText, profileText, customPrompt) {
    const business = (bot.businessName || bot.botName || 'doanh nghiệp').trim();
    const industry = (bot.industry || 'dịch vụ spa/thẩm mỹ').trim();
    const dataBlock = [profileText && `=== THÔNG TIN DOANH NGHIỆP ===\n${profileText}`, knowledgeText && `=== NGUỒN DỮ LIỆU ===\n${knowledgeText}`]
        .filter(Boolean)
        .join('\n\n') || '(Chưa có dữ liệu)';
    let base = `Bạn là nhân viên CSKH của ${business}.
Trả lời ngắn gọn, tối đa 4-6 câu, chỉ dựa trên dữ liệu bên dưới.
Nếu không có thông tin, trả lời chính xác: «${chatbot_constants_1.NO_DATA_REPLY}»
Không bịa giá, chính sách hay cam kết. Chủ đề: ${industry}.

DỮ LIỆU:
${dataBlock}`;
    if (customPrompt?.trim()) {
        base += `\n\nHƯỚNG DẪN BỔ SUNG:\n${customPrompt.slice(0, 2000)}`;
    }
    return base;
}
function fallbackReplyFromKnowledge(chunks, profileText) {
    const top = chunks[0];
    if (top) {
        const excerpt = top.content.slice(0, 400).trim();
        if (excerpt) {
            return `${excerpt}${top.content.length > 400 ? '…' : ''}\n\nBạn cần tư vấn thêm, vui lòng để lại số điện thoại nhé!`;
        }
    }
    if (profileText.includes('Hotline:')) {
        const line = profileText.split('\n').find((l) => l.startsWith('Hotline:'));
        if (line)
            return `${line.replace('Hotline:', 'Bạn có thể gọi hotline').trim()} hoặc để lại SĐT để được tư vấn chi tiết.`;
    }
    return chatbot_constants_1.NO_DATA_REPLY;
}
async function generateAiReply(params) {
    const { bot, userText, sources, history, settings, usageAllowed, openAiChat } = params;
    const maxRetries = Math.min(2, Math.max(0, params.maxRetries ?? 0));
    const text = userText.trim();
    if (isGreetingOnly(text)) {
        const greet = bot.greeting?.trim() ||
            (0, chatbot_constants_1.defaultGreeting)(bot.botName, bot.businessName ?? '', bot.consultationTone);
        return { reply: greet, usedAi: false, showLead: false, noData: false };
    }
    const profileText = botProfileContext(bot);
    if ((0, rag_grounded_reply_1.isLiveBusinessQuestion)(text) || params.knowledge) {
        if (!usageAllowed)
            return { reply: chatbot_constants_1.CREDIT_EXHAUSTED_MESSAGE, usedAi: false, showLead: true, noData: false, blockedCode: 'limit_exceeded' };
        return (0, rag_grounded_reply_1.replyFromRag)({ packet: params.knowledge || { mode: 'text', knowledgeBaseId: '', hits: [] }, text, history, settings, chat: openAiChat });
    }
    const chunks = searchKnowledge(sources, text);
    const hasContext = chunks.length > 0 || profileMatchesQuery(profileText, text);
    if (!hasContext) {
        return { reply: chatbot_constants_1.NO_DATA_REPLY, usedAi: false, showLead: true, noData: true };
    }
    if (!usageAllowed) {
        return {
            reply: chatbot_constants_1.CREDIT_EXHAUSTED_MESSAGE,
            usedAi: false,
            showLead: true,
            noData: false,
            blockedCode: 'limit_exceeded',
        };
    }
    const knowledgeText = knowledgeContext(chunks);
    const systemPrompt = buildSystemPrompt(bot, knowledgeText, profileText, settings.systemPrompt ?? '');
    if (openAiChat) {
        const hist = history.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.message,
        }));
        let lastErr = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const reply = await openAiChat({
                    model: settings.model || 'gpt-4o-mini',
                    systemPrompt,
                    history: hist,
                    userText: text,
                    temperature: settings.temperature ?? 0.4,
                });
                if (reply) {
                    return {
                        reply,
                        usedAi: true,
                        showLead: shouldShowLead(text, reply),
                        noData: reply.includes(chatbot_constants_1.NO_DATA_REPLY),
                    };
                }
            }
            catch (err) {
                lastErr = err;
                if (attempt < maxRetries) {
                    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                    continue;
                }
            }
        }
        const reply = fallbackReplyFromKnowledge(chunks, profileText) || chatbot_constants_1.AI_FRIENDLY_ERROR;
        return {
            reply,
            usedAi: false,
            showLead: true,
            noData: false,
            blockedCode: lastErr ? 'ai_error' : 'llm_empty',
        };
    }
    try {
        const reply = fallbackReplyFromKnowledge(chunks, profileText);
        return {
            reply,
            usedAi: false,
            showLead: shouldShowLead(text, reply),
            noData: reply === chatbot_constants_1.NO_DATA_REPLY,
            blockedCode: 'llm_unavailable',
        };
    }
    catch {
        const reply = fallbackReplyFromKnowledge(chunks, profileText) || chatbot_constants_1.AI_FRIENDLY_ERROR;
        return {
            reply,
            usedAi: false,
            showLead: true,
            noData: false,
            blockedCode: 'ai_error',
        };
    }
}
