"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmailForUniqueness = normalizeEmailForUniqueness;
exports.normalizePhoneDigits = normalizePhoneDigits;
function normalizeEmailForUniqueness(email) {
    return String(email || '').trim().toLowerCase();
}
/** Chuẩn hóa số điện thoại VN về dãy số (dùng chống trial trùng thiết bị/SĐT). */
function normalizePhoneDigits(phone) {
    if (!phone)
        return null;
    const digits = String(phone).replace(/\D+/g, '');
    if (!digits)
        return null;
    // 84xxxxxxxxx → 0xxxxxxxxx
    if (digits.startsWith('84') && digits.length >= 11) {
        return `0${digits.slice(2)}`;
    }
    return digits;
}
