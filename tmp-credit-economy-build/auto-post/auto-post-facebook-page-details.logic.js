"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FANPAGE_SYNC_TIMEZONE = exports.FANPAGE_DETAILS_SAFE_POST_FIELDS = exports.FANPAGE_DETAILS_PAGE_FIELDS = exports.PERMISSION_DECLINED_MESSAGE = exports.MISSING_READ_ENGAGEMENT_MESSAGE = void 0;
exports.classifyMetaGraphError = classifyMetaGraphError;
exports.toLegacyErrorCode = toLegacyErrorCode;
exports.buildPermissionsFlags = buildPermissionsFlags;
exports.hasPagesReadEngagement = hasPagesReadEngagement;
exports.mergeConnectionScopes = mergeConnectionScopes;
exports.mapMetaPageToDetails = mapMetaPageToDetails;
exports.mapMetaPostToDetails = mapMetaPostToDetails;
exports.mapMetaPosts = mapMetaPosts;
exports.fanpageDetailsCacheKey = fanpageDetailsCacheKey;
exports.formatHoChiMinhDateTime = formatHoChiMinhDateTime;
exports.snapshotHasTokenLeak = snapshotHasTokenLeak;
exports.MISSING_READ_ENGAGEMENT_MESSAGE = 'Fanpage chưa cấp quyền đọc thông tin (pages_read_engagement). Vui lòng kết nối lại Facebook và cấp đủ quyền.';
exports.PERMISSION_DECLINED_MESSAGE = 'Bạn đã từ chối quyền pages_read_engagement trên Facebook. Vui lòng Kết nối lại và chấp nhận quyền này.';
/**
 * Phân loại lỗi Meta Graph — không gom mọi lỗi thành “chưa cấp quyền đọc thông tin”.
 * Không log token.
 */
function classifyMetaGraphError(err) {
    const msg = String(err?.message ?? '').trim();
    const lower = msg.toLowerCase();
    const code = err?.code;
    const sub = err?.error_subcode;
    if (code === 4 ||
        code === 17 ||
        code === 32 ||
        code === 613 ||
        lower.includes('rate limit') ||
        lower.includes('user request limit') ||
        lower.includes('too many calls')) {
        return {
            code: 'rate_limited',
            message: 'Facebook đang giới hạn tạm thời. Vui lòng thử lại sau vài phút.',
            httpStatus: 429,
        };
    }
    if (code === 190 ||
        sub === 463 ||
        sub === 467 ||
        lower.includes('session has expired') ||
        lower.includes('access token has expired') ||
        lower.includes('error validating access token') ||
        lower.includes('token has expired')) {
        return {
            code: 'expired_token',
            message: 'Token Facebook đã hết hạn. Vui lòng kết nối lại Facebook.',
            httpStatus: 401,
        };
    }
    if (lower.includes('invalid oauth access token') ||
        lower.includes('cannot parse access token') ||
        lower.includes('malformed access token') ||
        (code === 190 && lower.includes('invalid'))) {
        return {
            code: 'invalid_page_token',
            message: 'Page Access Token không hợp lệ. Vui lòng làm mới Fanpage hoặc kết nối lại Facebook.',
            httpStatus: 401,
        };
    }
    // Declined — chỉ khi Meta nói rõ declined / user denied
    if (lower.includes('permission declined') ||
        lower.includes('user denied') ||
        (lower.includes('has not authorized') && lower.includes('declined'))) {
        return {
            code: 'permission_declined',
            message: exports.PERMISSION_DECLINED_MESSAGE,
            httpStatus: 403,
        };
    }
    // Chỉ map permission_missing khi chắc chắn liên quan pages_read_engagement
    if (lower.includes('pages_read_engagement') ||
        (lower.includes('(#10)') && lower.includes('engagement')) ||
        (code === 10 && lower.includes('pages_read_engagement')) ||
        (code === 200 && lower.includes('pages_read_engagement'))) {
        return {
            code: 'permission_missing',
            message: exports.MISSING_READ_ENGAGEMENT_MESSAGE,
            httpStatus: 403,
        };
    }
    // Wrong page / object không tồn tại / không thuộc token
    if ((code === 100 &&
        (lower.includes('does not exist') ||
            lower.includes('unsupported get request') ||
            lower.includes('nonexisting field') ||
            lower.includes('object with id'))) ||
        lower.includes('page id is not valid') ||
        lower.includes('was not found')) {
        return {
            code: 'wrong_page_id',
            message: 'Không tìm thấy Fanpage với Page ID này trên kết nối hiện tại (sai Page ID hoặc đã mất quyền quản trị).',
            httpStatus: 403,
        };
    }
    // Quyền khác (không phải pages_read_engagement) — giữ message Meta, không gán “chưa cấp quyền đọc”
    if (code === 10 || code === 200 || code === 294) {
        const safe = msg.slice(0, 280) || 'Facebook từ chối yêu cầu do thiếu quyền hoặc hạn chế đối tượng.';
        return {
            code: 'META_API_ERROR',
            message: safe,
            httpStatus: 403,
        };
    }
    if (lower.includes('fetch failed') ||
        lower.includes('econnreset') ||
        lower.includes('etimedout') ||
        lower.includes('network') ||
        lower.includes('enotfound') ||
        lower.includes('abort')) {
        return {
            code: 'NETWORK_ERROR',
            message: 'Không kết nối được tới Facebook. Vui lòng thử lại.',
            httpStatus: 503,
        };
    }
    return {
        code: 'META_API_ERROR',
        message: msg.slice(0, 280) || 'Không thể đọc thông tin Fanpage từ Facebook lúc này.',
        httpStatus: 502,
    };
}
/** Map mã mới → alias FE cũ (nếu cần). */
function toLegacyErrorCode(code) {
    switch (code) {
        case 'permission_missing':
            return 'MISSING_PAGES_READ_ENGAGEMENT';
        case 'expired_token':
            return 'TOKEN_EXPIRED';
        case 'wrong_page_id':
        case 'invalid_page_token':
            return 'PAGE_ACCESS_REVOKED';
        case 'rate_limited':
            return 'META_RATE_LIMIT';
        default:
            return code;
    }
}
function buildPermissionsFlags(scopes) {
    const set = new Set(scopes.map((s) => s.trim()).filter(Boolean));
    const isEnv = set.has('env_page_token');
    return {
        pages_show_list: isEnv || set.has('pages_show_list'),
        pages_read_engagement: isEnv || set.has('pages_read_engagement'),
        pages_manage_posts: isEnv || set.has('pages_manage_posts'),
    };
}
function hasPagesReadEngagement(scopes) {
    return buildPermissionsFlags(scopes).pages_read_engagement;
}
/**
 * Gộp scopes DB + live — không thu hẹp quyền đã lưu trừ khi Meta báo declined tường minh.
 */
function mergeConnectionScopes(stored, liveGranted, liveDeclined = []) {
    const declined = new Set(liveDeclined.map((s) => s.trim()).filter(Boolean));
    const merged = new Set();
    for (const s of [...stored, ...liveGranted]) {
        const t = String(s ?? '').trim();
        if (!t || declined.has(t))
            continue;
        merged.add(t);
    }
    return [...merged];
}
/**
 * Fields an toàn cho /published_posts|/posts.
 * Tránh likes/comments/reactions.summary — Meta hay trả (#10) pages_read_engagement
 * / pages_read_user_content dù /me/permissions đã granted (Standard Access / thiếu Advanced).
 */
exports.FANPAGE_DETAILS_PAGE_FIELDS = [
    'id',
    'name',
    'about',
    'category',
    'description',
    'website',
    'link',
    'username',
    'phone',
    'emails',
    'fan_count',
    'followers_count',
    'picture.width(200).height(200){url}',
    'cover{source}',
    'location{city,country,street}',
];
exports.FANPAGE_DETAILS_SAFE_POST_FIELDS = [
    'id',
    'message',
    'story',
    'created_time',
    'permalink_url',
    'full_picture',
    'shares',
    'attachments{media_type,type,url,media}',
];
function numOrNull(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    return null;
}
function strOrNull(v) {
    if (typeof v !== 'string')
        return null;
    const t = v.trim();
    return t ? t : null;
}
function mapMetaPageToDetails(raw, local) {
    const pictureUrl = strOrNull(raw.picture?.data?.url) ??
        strOrNull(raw.picture?.url) ??
        local.pagePictureUrl;
    const loc = raw.location;
    const location = loc
        ? [loc.street, loc.city, loc.country].map((p) => strOrNull(p)).filter(Boolean).join(', ') ||
            null
        : null;
    const emails = Array.isArray(raw.emails)
        ? raw.emails.map((e) => String(e).trim()).filter(Boolean)
        : null;
    return {
        id: local.id,
        pageId: strOrNull(raw.id) ?? local.pageId,
        name: strOrNull(raw.name) ?? local.pageName,
        pictureUrl,
        coverUrl: strOrNull(raw.cover?.source),
        category: strOrNull(raw.category),
        about: strOrNull(raw.about),
        description: strOrNull(raw.description),
        website: strOrNull(raw.website),
        link: strOrNull(raw.link),
        username: strOrNull(raw.username),
        phone: strOrNull(raw.phone),
        emails: emails && emails.length ? emails : null,
        location,
        followersCount: numOrNull(raw.followers_count),
        fanCount: numOrNull(raw.fan_count),
    };
}
function mapMetaPostToDetails(raw) {
    const id = strOrNull(raw.id);
    if (!id)
        return null;
    const attachment = raw.attachments?.data?.[0];
    const thumb = strOrNull(raw.full_picture) ??
        strOrNull(attachment?.media?.image?.src) ??
        null;
    const mediaType = strOrNull(attachment?.media_type) ?? strOrNull(attachment?.type) ?? (thumb ? 'photo' : null);
    const likes = numOrNull(raw.likes?.summary?.total_count);
    const reactions = numOrNull(raw.reactions?.summary?.total_count);
    return {
        id,
        message: strOrNull(raw.message) ?? strOrNull(raw.story),
        createdTime: strOrNull(raw.created_time),
        permalinkUrl: strOrNull(raw.permalink_url),
        thumbnailUrl: thumb,
        mediaType,
        likes,
        comments: numOrNull(raw.comments?.summary?.total_count),
        shares: numOrNull(raw.shares?.count),
        reactions: reactions ?? likes,
    };
}
function mapMetaPosts(rawList, limit) {
    if (!Array.isArray(rawList))
        return [];
    const out = [];
    for (const row of rawList) {
        if (out.length >= limit)
            break;
        const mapped = mapMetaPostToDetails(row);
        if (mapped)
            out.push(mapped);
    }
    return out;
}
/** Cache key an toàn — không chứa token. */
function fanpageDetailsCacheKey(organizationId, fanpageId) {
    return `${organizationId}:${fanpageId}`;
}
exports.FANPAGE_SYNC_TIMEZONE = 'Asia/Ho_Chi_Minh';
/** HH:mm DD/MM/YYYY theo Asia/Ho_Chi_Minh — không fake timezone. */
function formatHoChiMinhDateTime(input) {
    if (input == null)
        return null;
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime()))
        return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: exports.FANPAGE_SYNC_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    const hour = get('hour');
    const minute = get('minute');
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (!hour || !minute || !day || !month || !year)
        return null;
    return `${hour}:${minute} ${day}/${month}/${year}`;
}
function snapshotHasTokenLeak(value) {
    const s = JSON.stringify(value);
    return (/encryptedPageAccessToken|access_token/i.test(s) ||
        /\b(?:EAAG|EAAD|EAA)[A-Za-z0-9_-]{20,}\b/.test(s));
}
