"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MessagingProviderRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingProviderRegistry = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_1 = require("@marketingspa/database");
const GRAPH_VERSION = 'v21.0';
function safeEqualUtf8(a, b) {
    try {
        const ba = Buffer.from(a, 'utf8');
        const bb = Buffer.from(b, 'utf8');
        if (ba.length !== bb.length)
            return false;
        return (0, crypto_1.timingSafeEqual)(ba, bb);
    }
    catch {
        return false;
    }
}
/** Meta X-Hub-Signature-256: sha256=<hmac-hex> */
function verifyMetaSha256Signature(rawBody, signature, secret) {
    const expected = 'sha256=' + (0, crypto_1.createHmac)('sha256', secret).update(rawBody).digest('hex');
    return safeEqualUtf8(expected, signature.trim());
}
/** Zalo OA webhook: accept sha256=<hmac-hex> or raw hex HMAC of body */
function verifyZaloHmacSignature(rawBody, signature, secret) {
    const hex = (0, crypto_1.createHmac)('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.trim();
    if (/^sha256=/i.test(provided)) {
        return safeEqualUtf8(`sha256=${hex}`, `sha256=${provided.slice(provided.indexOf('=') + 1)}`);
    }
    return safeEqualUtf8(hex, provided.toLowerCase());
}
let MessagingProviderRegistry = MessagingProviderRegistry_1 = class MessagingProviderRegistry {
    logger = new common_1.Logger(MessagingProviderRegistry_1.name);
    get(kind) {
        switch (kind) {
            case database_1.MessagingProviderKind.MESSENGER:
                return this.messengerProvider();
            case database_1.MessagingProviderKind.ZALO_OA:
            case database_1.MessagingProviderKind.ZBS_TEMPLATE:
                return this.zaloLikeProvider(kind);
            default:
                return this.zaloLikeProvider(kind);
        }
    }
    messengerProvider() {
        return {
            validateConnection: async (params) => {
                const token = params.credentials.pageAccessToken?.trim() ||
                    params.credentials.accessToken?.trim() ||
                    '';
                if (!token) {
                    return { valid: false, message: 'Thiếu Page Access Token' };
                }
                const pageId = (params.credentials.pageId || params.accountRef || '').trim();
                if (!pageId) {
                    return { valid: false, message: 'Thiếu Page ID' };
                }
                try {
                    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}`);
                    url.searchParams.set('fields', 'id,name');
                    url.searchParams.set('access_token', token);
                    const res = await fetch(url.toString(), { method: 'GET' });
                    const body = (await res.json().catch(() => ({})));
                    if (!res.ok || body.error) {
                        const msg = body.error?.message || `Graph HTTP ${res.status}`;
                        const lower = msg.toLowerCase();
                        if (lower.includes('expired') ||
                            lower.includes('session has expired') ||
                            body.error?.code === 190) {
                            return { valid: false, message: `Token hết hạn / reauth: ${msg}` };
                        }
                        if (lower.includes('permission') || lower.includes('oauth')) {
                            return { valid: false, message: `Thiếu quyền / reauth: ${msg}` };
                        }
                        return { valid: false, message: msg };
                    }
                    return {
                        valid: true,
                        displayName: body.name || pageId,
                        permissions: ['pages_messaging'],
                    };
                }
                catch (e) {
                    this.logger.warn(`Messenger validate failed: ${e instanceof Error ? e.message : String(e)}`);
                    return {
                        valid: false,
                        message: e instanceof Error ? e.message : 'Không kiểm tra được token Messenger',
                    };
                }
            },
            verifyWebhookSignature: (rawBody, signature, secret) => verifyMetaSha256Signature(rawBody, signature, secret),
            normalizeWebhook() {
                return [];
            },
            estimateCost() {
                return 0;
            },
        };
    }
    zaloLikeProvider(kind) {
        return {
            validateConnection: async (params) => {
                const token = params.credentials.accessToken?.trim() ||
                    params.credentials.pageAccessToken?.trim() ||
                    '';
                if (!token || token.length < 10) {
                    return { valid: false, message: 'Thiếu access token Zalo' };
                }
                const accountRef = params.credentials.oaId?.trim() ||
                    params.credentials.appId?.trim() ||
                    params.accountRef?.trim() ||
                    '';
                if (!accountRef) {
                    return { valid: false, message: 'Thiếu OA ID / accountRef' };
                }
                return {
                    valid: true,
                    displayName: params.credentials.oaName || accountRef,
                    permissions: kind === database_1.MessagingProviderKind.ZBS_TEMPLATE ? ['zbs'] : ['zalo_oa'],
                };
            },
            verifyWebhookSignature: (rawBody, signature, secret) => verifyZaloHmacSignature(rawBody, signature, secret),
            normalizeWebhook() {
                return [];
            },
            estimateCost() {
                return 0;
            },
        };
    }
};
exports.MessagingProviderRegistry = MessagingProviderRegistry;
exports.MessagingProviderRegistry = MessagingProviderRegistry = MessagingProviderRegistry_1 = __decorate([
    (0, common_1.Injectable)()
], MessagingProviderRegistry);
