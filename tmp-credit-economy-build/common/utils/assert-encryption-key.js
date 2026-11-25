"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertEncryptionKeyConfigured = assertEncryptionKeyConfigured;
function assertEncryptionKeyConfigured(key) {
    const value = key ?? process.env.ENCRYPTION_KEY ?? process.env.TOKEN_ENCRYPTION_KEY ?? '';
    if (!value || value.length < 16) {
        throw new Error('ENCRYPTION_KEY is not configured');
    }
    return value;
}
