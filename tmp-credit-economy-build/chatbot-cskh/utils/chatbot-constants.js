"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_KEYWORDS = exports.SOURCE_TYPES = exports.CHANNEL_TYPES = exports.CONSULTATION_TONES = exports.AI_FRIENDLY_ERROR = exports.LLM_UNAVAILABLE_MESSAGE = exports.CREDIT_EXHAUSTED_MESSAGE = exports.NO_DATA_REPLY = void 0;
exports.defaultGreeting = defaultGreeting;
exports.buildEmbedCode = buildEmbedCode;
exports.resolveEmbedApiUrl = resolveEmbedApiUrl;
exports.NO_DATA_REPLY = 'Hiện tôi chưa có đủ thông tin chính xác về nội dung này. Anh/chị vui lòng để lại số điện thoại để nhân viên tư vấn chi tiết hơn.';
exports.CREDIT_EXHAUSTED_MESSAGE = 'Đã đạt giới hạn lượt AI trả lời tháng này. Vui lòng liên hệ trực tiếp qua hotline.';
exports.LLM_UNAVAILABLE_MESSAGE = 'Chatbot chưa sẵn sàng trả lời AI. Vui lòng để lại số điện thoại để nhân viên hỗ trợ.';
exports.AI_FRIENDLY_ERROR = 'Xin lỗi, hệ thống đang bận. Bạn vui lòng thử lại sau hoặc để lại số điện thoại để được tư vấn.';
exports.CONSULTATION_TONES = ['friendly', 'professional', 'enthusiastic', 'concise'];
exports.CHANNEL_TYPES = ['WEBSITE_WIDGET', 'FACEBOOK', 'ZALO', 'TELEGRAM', 'API'];
exports.SOURCE_TYPES = ['FAQ', 'URL', 'FILE', 'MANUAL'];
exports.LEAD_KEYWORDS = [
    'giá',
    'báo giá',
    'chi phí',
    'tư vấn',
    'đặt lịch',
    'liên hệ',
    'hotline',
    'gọi',
    'sđt',
    'sdt',
    'zalo',
    'đặt hàng',
];
function defaultGreeting(botName, businessName, tone) {
    const name = (businessName || botName || 'Spa').trim();
    const t = (tone || 'friendly').toLowerCase();
    if (t === 'professional') {
        return `Xin chào, tôi là trợ lý ảo của ${name}. Tôi có thể hỗ trợ thông tin dịch vụ cho bạn.`;
    }
    if (t === 'enthusiastic') {
        return `Chào bạn! ${name} rất vui được hỗ trợ — hỏi mình bất cứ điều gì nhé!`;
    }
    if (t === 'concise') {
        return `Xin chào — ${name}. Bạn cần hỗ trợ gì?`;
    }
    return `Xin chào! Mình là chatbot của ${name}, rất vui được hỗ trợ bạn.`;
}
function buildEmbedCode(botId, apiUrl) {
    const api = (apiUrl || 'http://localhost:4000').replace(/\/$/, '');
    return (`<!-- MarketingSpa Chatbot CSKH -->\n` +
        `<script src="${api}/chatbot/widget.js?v=3" data-bot-id="${botId}" data-api-url="${api}" ` +
        `onerror="console.error('[MarketingSpa Chatbot] Không tải được widget. Cài plugin proxy WordPress (mspa-chatbot-proxy.zip) và cấu hình URL API.')"></script>`);
}
/** URL công khai cho mã nhúng — ưu tiên proxy HTTPS trên cùng domain website. */
function resolveEmbedApiUrl(websiteUrl, options = {}) {
    const explicit = options.explicitUrl?.trim();
    if (explicit)
        return explicit.replace(/\/$/, '');
    const proxySegment = (options.proxyPath || 'chatbot-api').replace(/^\/+|\/+$/g, '');
    if (websiteUrl?.trim()) {
        try {
            const site = new URL(websiteUrl.trim());
            if (site.protocol === 'https:') {
                return `${site.origin}/${proxySegment}`;
            }
            if (site.protocol === 'http:') {
                return `${site.origin}/${proxySegment}`;
            }
        }
        catch {
            /* ignore invalid url */
        }
    }
    return (options.fallbackUrl || 'http://127.0.0.1:4000').replace(/\/$/, '');
}
