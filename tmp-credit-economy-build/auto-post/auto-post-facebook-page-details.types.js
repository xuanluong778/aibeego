"use strict";
/** Response chuẩn “Xem thông tin Fanpage” — không chứa token. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_CACHE_OP_DETAILS = exports.FANPAGE_DETAILS_POST_LIMIT = exports.FANPAGE_DETAILS_CACHE_TTL_MS = void 0;
exports.FANPAGE_DETAILS_CACHE_TTL_MS = 4 * 60 * 1000; // 4 phút (trong khoảng 3–5)
exports.FANPAGE_DETAILS_POST_LIMIT = 10;
/** Prefix chuẩn — luôn gồm org + fanpage + operation */
exports.META_CACHE_OP_DETAILS = 'details';
