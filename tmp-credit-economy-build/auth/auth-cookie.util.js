"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_COOKIE_NAME = void 0;
exports.refreshCookieOptions = refreshCookieOptions;
exports.setRefreshCookie = setRefreshCookie;
exports.clearRefreshCookie = clearRefreshCookie;
exports.REFRESH_COOKIE_NAME = 'ms_refresh_token';
function refreshCookieOptions(config) {
    const secure = config.get('NODE_ENV') === 'production' ||
        config.get('COOKIE_SECURE') === 'true';
    const sameSite = (config.get('COOKIE_SAME_SITE') ?? 'lax');
    const domain = config.get('COOKIE_DOMAIN')?.trim() || undefined;
    const maxAgeDays = parseInt(config.get('JWT_REFRESH_EXPIRES_DAYS', '7'), 10);
    return {
        httpOnly: true,
        secure,
        sameSite,
        domain,
        path: '/api/v1/auth',
        maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    };
}
function setRefreshCookie(res, token, config) {
    res.cookie(exports.REFRESH_COOKIE_NAME, token, refreshCookieOptions(config));
}
function clearRefreshCookie(res, config) {
    res.clearCookie(exports.REFRESH_COOKIE_NAME, {
        ...refreshCookieOptions(config),
        maxAge: 0,
    });
}
