"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_POST_META_SCOPES = exports.AUTO_POST_TYPE_LABELS = void 0;
exports.resolveMetaLoginConfigId = resolveMetaLoginConfigId;
exports.resolveMetaAppId = resolveMetaAppId;
exports.resolveMetaAppSecret = resolveMetaAppSecret;
exports.isAutoPostOAuthState = isAutoPostOAuthState;
exports.isMarketingAutoazOAuthState = isMarketingAutoazOAuthState;
exports.resolveMetaOAuthRedirectUri = resolveMetaOAuthRedirectUri;
exports.resolveAutoPostMetaScopes = resolveAutoPostMetaScopes;
exports.buildAutoPostPrompt = buildAutoPostPrompt;
exports.buildAutoPostRewritePrompt = buildAutoPostRewritePrompt;
const assert_auto_post_meta_oauth_1 = require("./assert-auto-post-meta-oauth");
exports.AUTO_POST_TYPE_LABELS = {
    SPA_SALES: 'Bài bán hàng spa',
    BRAND_BUILDING: 'Bài xây dựng thương hiệu',
    CUSTOMER_FEEDBACK: 'Bài feedback khách hàng',
    PROMOTION: 'Bài khuyến mãi',
    BEAUTY_KNOWLEDGE: 'Bài kiến thức làm đẹp',
    OLD_CUSTOMER_CARE: 'Bài chăm sóc khách cũ',
    OPENING_EVENT: 'Bài khai trương/sự kiện',
    INBOX_BOOKING: 'Bài kéo inbox/đặt lịch',
};
/** Default Facebook Login scopes (Standard Access) — include Messenger for Chatbot E2E. */
exports.AUTO_POST_META_SCOPES = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_messaging',
    'pages_manage_metadata',
];
/**
 * App Meta kiểu Business (Facebook Login for Business) phải dùng config_id
 * thay vì scope=... — nếu truyền pages_* qua scope sẽ bị "Invalid Scopes".
 */
function resolveMetaLoginConfigId(getEnv) {
    const raw = getEnv('META_LOGIN_CONFIG_ID')?.trim() ||
        getEnv('FACEBOOK_LOGIN_CONFIG_ID')?.trim() ||
        getEnv('FACEBOOK_CONFIG_ID')?.trim();
    return raw || undefined;
}
function resolveMetaAppId(getEnv) {
    return getEnv('META_APP_ID')?.trim() || getEnv('FACEBOOK_APP_ID')?.trim() || undefined;
}
function resolveMetaAppSecret(getEnv) {
    return getEnv('META_APP_SECRET')?.trim() || getEnv('FACEBOOK_APP_SECRET')?.trim() || undefined;
}
/**
 * Auto Post OAuth state: userId:organizationId:ts:nonce:sig (5 segments).
 * Ads OAuth state: userId:organizationId:returnTo:exp:nonce:sig (6 segments).
 */
function isAutoPostOAuthState(state) {
    if (!state)
        return false;
    try {
        const decoded = Buffer.from(state, 'base64url').toString('utf8');
        return decoded.split(':').length === 5;
    }
    catch {
        return false;
    }
}
/**
 * Ai Bee Go OAuth state (base64url): 5 segments = Auto Post, 6 = Ads.
 * Relay partner state là JWT (có dấu chấm) — không trùng format này.
 */
function isMarketingAutoazOAuthState(state) {
    if (!state || state.includes('.'))
        return false;
    try {
        const decoded = Buffer.from(state, 'base64url').toString('utf8');
        const n = decoded.split(':').length;
        return n === 5 || n === 6;
    }
    catch {
        return false;
    }
}
/**
 * Redirect URI Auto Post Fanpage OAuth.
 * Production Ai Bee Go: chỉ META_AUTO_POST_REDIRECT_URI (không relay seoauto).
 * @deprecated Prefer resolveAutoPostOAuthRedirectUri from assert-auto-post-meta-oauth.
 */
function resolveMetaOAuthRedirectUri(getEnv, _fallbackPath) {
    return (0, assert_auto_post_meta_oauth_1.resolveAutoPostOAuthRedirectUri)(getEnv);
}
function resolveAutoPostMetaScopes(getEnv) {
    const fromEnv = getEnv('META_AUTO_POST_SCOPES')?.trim() || getEnv('FACEBOOK_OAUTH_SCOPES')?.trim();
    if (fromEnv) {
        return fromEnv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return exports.AUTO_POST_META_SCOPES;
}
function buildAutoPostPrompt(input) {
    const typeLabel = exports.AUTO_POST_TYPE_LABELS[input.postType] ?? input.postType;
    return `Bạn là copywriter chuyên ngành spa/làm đẹp tại Việt Nam. Viết bài đăng Facebook Fanpage.

LOẠI BÀI: ${typeLabel}
CHỦ ĐỀ: ${input.topic}
DỊCH VỤ SPA: ${input.spaService?.trim() || 'spa làm đẹp/chăm sóc da'}
ĐỐI TƯỢNG: ${input.targetAudience?.trim() || 'phụ nữ quan tâm làm đẹp'}
GIỌNG VĂN: ${input.tone?.trim() || 'thân thiện, tự nhiên, gần gũi'}
ƯU ĐÃI: ${input.promotion?.trim() || 'không có ưu đãi cụ thể'}
LINK: ${input.linkUrl?.trim() || 'không có'}
HASHTAG GỢI Ý: ${input.hashtags?.trim() || 'tự chọn phù hợp'}
CTA GỢI Ý: ${input.cta?.trim() || 'inbox hoặc đặt lịch'}

YÊU CẦU:
- Hook mạnh ở 2 dòng đầu, cuốn hút scroll dừng lại
- Nội dung tự nhiên, không sáo rỗng, không lố marketing
- Phù hợp ngành spa, có lợi ích rõ cho khách
- CTA rõ ràng ở cuối bài
- Hashtag 3-8 cái ở cuối (dòng riêng)
- Không bịa cam kết "100%", "triệt để", "vĩnh viễn", "y chang", "giống hệt"
- Tránh từ vi phạm chính sách Facebook Ads: "chữa khỏi", "thay thế bác sĩ", "không tác dụng phụ", "cam kết kết quả"
- Không dùng markdown heading (# ##)
- Viết bằng tiếng Việt, văn liền mạch sẵn copy-paste lên Facebook

Trả về JSON:
{
  "caption": "nội dung bài đăng đầy đủ gồm hook + thân bài + CTA + hashtag",
  "hashtags": ["#tag1", "#tag2"],
  "cta": "câu CTA chính"
}`;
}
function buildAutoPostRewritePrompt(mode, caption, cta) {
    const action = mode === 'rewrite'
        ? 'Viết lại bài giữ ý chính, làm mới cách diễn đạt'
        : mode === 'shorten'
            ? 'Rút gọn bài còn khoảng 60-70% độ dài, giữ hook và CTA'
            : 'Làm CTA mạnh hơn, thuyết phục hơn nhưng không vi phạm chính sách Facebook';
    return `${action}. Ngành spa. Không markdown heading. Trả JSON: {"caption":"...","hashtags":["..."],"cta":"..."}

Bài hiện tại:
${caption}

CTA hiện tại: ${cta ?? 'chưa có'}`;
}
