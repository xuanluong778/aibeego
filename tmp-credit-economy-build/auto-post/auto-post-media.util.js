"use strict";
/**
 * Chuẩn hóa media Auto Post trước khi gọi Meta Graph.
 * Tránh gửi URL trang HTML vào /photos (gây Invalid parameter #100/1366046).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHttpUrl = isHttpUrl;
exports.looksLikeDirectImageUrl = looksLikeDirectImageUrl;
exports.normalizePublishMedia = normalizePublishMedia;
const IMAGE_PATH_RE = /\.(jpe?g|png|gif|webp|tiff?|heic|heif)(\?|#|$)/i;
const IMAGE_HOST_RE = /(fbcdn\.net|cdninstagram\.com|scontent\.|cloudinary\.com|imgur\.com|googleusercontent\.com|twimg\.com)/i;
function isHttpUrl(value) {
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/** Heuristic: URL trỏ tới file ảnh trực tiếp (không phải trang HTML). */
function looksLikeDirectImageUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:')
            return false;
        if (IMAGE_PATH_RE.test(u.pathname))
            return true;
        if (IMAGE_HOST_RE.test(u.hostname))
            return true;
        return false;
    }
    catch {
        return false;
    }
}
/**
 * - imageUrl không phải ảnh → chuyển sang link (nếu chưa có link) hoặc báo lỗi.
 * - Có cả ảnh + link → ưu tiên ảnh, bỏ link (Meta /photos không dùng link).
 * - URL rỗng / không http(s) → bỏ hoặc lỗi rõ.
 */
function normalizePublishMedia(input) {
    let image = input.imageUrl?.trim() || undefined;
    let link = input.linkUrl?.trim() || undefined;
    let note;
    if (image) {
        if (!isHttpUrl(image)) {
            throw new Error('URL ảnh phải là đường dẫn http/https hợp lệ');
        }
        if (!looksLikeDirectImageUrl(image)) {
            if (!link) {
                link = image;
                image = undefined;
                note = 'URL không phải file ảnh — sẽ đăng dạng liên kết thay vì ảnh.';
            }
            else {
                // Có link hợp lệ sẵn → bỏ URL ảnh giả (trang HTML) thay vì fail toàn bộ
                image = undefined;
                note =
                    'URL ảnh không phải file trực tiếp — đã bỏ ảnh, đăng kèm liên kết.';
            }
        }
    }
    if (link) {
        if (!isHttpUrl(link)) {
            throw new Error('URL liên kết phải là đường dẫn http/https hợp lệ');
        }
    }
    if (image && link) {
        link = undefined;
        note = note
            ? `${note} Ưu tiên đăng ảnh (bỏ link).`
            : 'Ưu tiên đăng ảnh — link kèm theo đã được bỏ qua.';
    }
    return { imageUrl: image, linkUrl: link, note };
}
