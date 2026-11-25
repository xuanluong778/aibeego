"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMetaAdsOAuthConfigured = assertMetaAdsOAuthConfigured;
function assertMetaAdsOAuthConfigured() {
    // Soft check — runtime services validate credentials when used.
    if (!process.env.META_APP_ID && !process.env.FACEBOOK_APP_ID) {
        return;
    }
}
