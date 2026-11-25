"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_POST_OAUTH_STATE_TTL_MS = void 0;
exports.createOAuthStateRecord = createOAuthStateRecord;
exports.verifyOAuthState = verifyOAuthState;
exports.consumeOAuthStateRecord = consumeOAuthStateRecord;
exports.oauthCallbackConnect = oauthCallbackConnect;
exports.listOAuthManagedPages = listOAuthManagedPages;
exports.selectOAuthPages = selectOAuthPages;
exports.selectOAuthPage = selectOAuthPage;
const database_1 = require("@marketingspa/database");
const database_2 = require("@marketingspa/database");
const crypto_1 = require("crypto");
const encryption_util_1 = require("../common/utils/encryption.util");
const database_3 = require("@marketingspa/database");
exports.AUTO_POST_OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 phút
async function createOAuthStateRecord(prisma, params) {
    const ttlMs = params.ttlMs ?? exports.AUTO_POST_OAUTH_STATE_TTL_MS;
    const ts = Date.now();
    const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
    const stateHash = (0, crypto_1.createHash)('sha256').update(nonce).digest('hex');
    const payload = `${params.userId}:${params.organizationId}:${ts}:${nonce}`;
    const sig = (0, crypto_1.createHmac)('sha256', params.encryptionKey).update(payload).digest('hex');
    const expiresAt = new Date(ts + ttlMs);
    const state = Buffer.from(`${payload}:${sig}`).toString('base64url');
    await prisma.autoPostFacebookOAuthState.create({
        data: {
            stateHash,
            userId: params.userId,
            organizationId: params.organizationId,
            nonce,
            expiresAt,
        },
    });
    return { state };
}
function verifyOAuthState(state, params) {
    const ttlMs = params.ttlMs ?? exports.AUTO_POST_OAUTH_STATE_TTL_MS;
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5)
        throw new Error('invalid_state');
    const [userId, organizationId, tsStr, nonce, sig] = parts;
    const ts = Number(tsStr);
    if (!userId || !organizationId || !nonce || !Number.isFinite(ts) || !sig) {
        throw new Error('invalid_state');
    }
    if (Date.now() - ts > ttlMs)
        throw new Error('oauth_state_expired');
    const payload = `${userId}:${organizationId}:${tsStr}:${nonce}`;
    const expected = (0, crypto_1.createHmac)('sha256', params.encryptionKey).update(payload).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b))
        throw new Error('invalid_state');
    const stateHash = (0, crypto_1.createHash)('sha256').update(nonce).digest('hex');
    return { userId, organizationId, nonce, ts, stateHash };
}
async function consumeOAuthStateRecord(prisma, params) {
    const now = params.now ?? new Date();
    const info = verifyOAuthState(params.state, { encryptionKey: params.encryptionKey, ttlMs: params.ttlMs });
    const consumed = await prisma.autoPostFacebookOAuthState.updateMany({
        where: { stateHash: info.stateHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
    });
    if (consumed.count !== 1) {
        throw new Error('oauth_state_used_or_expired');
    }
    return info;
}
async function oauthCallbackConnect(prisma, params) {
    const encryptionKey = params.encryptionKey;
    const info = await consumeOAuthStateRecord(prisma, { state: params.state, encryptionKey });
    try {
        const short = await params.meta.exchangeCodeForToken(params.code);
        const longLived = await params.meta.exchangeForLongLivedToken(short.access_token);
        const accessToken = longLived.access_token;
        const me = await params.meta.getMe(accessToken);
        const grantedScopes = params.meta.resolveGrantedScopes
            ? await params.meta.resolveGrantedScopes(accessToken)
            : params.meta.getGrantedPermissions
                ? await params.meta.getGrantedPermissions(accessToken)
                : params.meta.getOAuthScopes();
        const expiresAt = longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null;
        const encryptedAccessToken = (0, encryption_util_1.encryptSecret)(accessToken, encryptionKey);
        // Phase 3: chỉ lưu pending, không ghi đè active connection/page.
        await prisma.autoPostFacebookOAuthPendingConnection.upsert({
            where: { userId_organizationId: { userId: info.userId, organizationId: info.organizationId } },
            create: {
                userId: info.userId,
                organizationId: info.organizationId,
                encryptedAccessToken,
                tokenExpiresAt: expiresAt,
                facebookUserId: me.id,
                facebookUserName: me.name ?? null,
                scopes: grantedScopes,
                lastError: null,
            },
            update: {
                encryptedAccessToken,
                tokenExpiresAt: expiresAt,
                facebookUserId: me.id,
                facebookUserName: me.name ?? null,
                scopes: grantedScopes,
                lastError: null,
            },
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'oauth_failed';
        // Callback lỗi: không ghi đè active connection/page (giữ trạng thái cũ).
        throw new Error(msg);
    }
}
async function listOAuthManagedPages(prisma, params) {
    const pending = await prisma.autoPostFacebookOAuthPendingConnection.findUnique({
        where: { userId_organizationId: { userId: params.userId, organizationId: params.organizationId } },
    });
    if (!pending)
        throw new Error('Chưa có OAuth pending — vui lòng kết nối lại');
    if (pending.tokenExpiresAt && pending.tokenExpiresAt.getTime() < Date.now()) {
        throw new Error('Token Facebook đã hết hạn — vui lòng kết nối lại');
    }
    const accessToken = (0, encryption_util_1.decryptSecret)(pending.encryptedAccessToken, params.encryptionKey);
    const pages = await params.meta.getManagedPages(accessToken);
    return pages.map((p) => ({
        id: p.id,
        pageId: p.id,
        pageName: p.name,
        pagePictureUrl: p.picture?.data?.url ?? null,
    }));
}
async function selectOAuthPages(prisma, params) {
    const pageIds = [
        ...new Set((params.pageIds ?? []).map((id) => String(id || '').trim()).filter(Boolean)),
    ];
    if (pageIds.length === 0)
        throw new Error('pageIds is required');
    const pending = await prisma.autoPostFacebookOAuthPendingConnection.findUnique({
        where: {
            userId_organizationId: { userId: params.userId, organizationId: params.organizationId },
        },
    });
    if (!pending)
        throw new Error('Chưa có OAuth pending — vui lòng kết nối lại');
    if (pending.tokenExpiresAt && pending.tokenExpiresAt.getTime() < Date.now()) {
        throw new Error('Token Facebook đã hết hạn — vui lòng kết nối lại');
    }
    const accessToken = (0, encryption_util_1.decryptSecret)(pending.encryptedAccessToken, params.encryptionKey);
    const managed = await params.meta.getManagedPages(accessToken);
    const managedById = new Map(managed.map((p) => [p.id, p]));
    const failed = [];
    const accepted = [];
    for (const pageId of pageIds) {
        const chosen = managedById.get(pageId);
        if (!chosen) {
            failed.push({ pageId, reason: 'Fanpage không thuộc quyền của bạn' });
            continue;
        }
        try {
            const debug = await params.meta.debugToken(chosen.access_token);
            const grantedScopes = debug.scopes ?? [];
            if (!debug.is_valid) {
                failed.push({ pageId, reason: 'Token Facebook đã hết hạn' });
                continue;
            }
            if (debug.expires_at && debug.expires_at * 1000 < Date.now()) {
                failed.push({ pageId, reason: 'Token Facebook đã hết hạn' });
                continue;
            }
            if (!grantedScopes.includes('pages_manage_posts')) {
                failed.push({ pageId, reason: 'MISSING_PERMISSION' });
                continue;
            }
            if (!chosen.access_token?.trim()) {
                failed.push({ pageId, reason: 'missing_page_access_token' });
                continue;
            }
            accepted.push({
                page: chosen,
                scopes: grantedScopes,
                tokenExpiresAt: debug.expires_at
                    ? new Date(debug.expires_at * 1000)
                    : pending.tokenExpiresAt,
                encryptedPageAccessToken: (0, encryption_util_1.encryptSecret)(chosen.access_token, params.encryptionKey),
            });
        }
        catch (e) {
            failed.push({
                pageId,
                reason: e instanceof Error ? e.message : 'verify_failed',
            });
        }
    }
    if (accepted.length === 0) {
        const first = failed[0];
        throw new Error(first?.reason === 'MISSING_PERMISSION' ? 'MISSING_PERMISSION' : first?.reason || 'select_failed');
    }
    // Union scopes from accepted pages (connection-level)
    const unionScopes = [...new Set(accepted.flatMap((a) => a.scopes))];
    const latestExpiry = accepted.reduce((acc, a) => {
        if (!a.tokenExpiresAt)
            return acc;
        if (!acc || a.tokenExpiresAt.getTime() > acc.getTime())
            return a.tokenExpiresAt;
        return acc;
    }, pending.tokenExpiresAt ?? null);
    await prisma.$transaction(async (tx) => {
        const newConn = await tx.autoPostFacebookConnection.upsert({
            where: {
                userId_organizationId: { userId: params.userId, organizationId: params.organizationId },
            },
            create: {
                userId: params.userId,
                organizationId: params.organizationId,
                encryptedAccessToken: pending.encryptedAccessToken,
                tokenExpiresAt: latestExpiry,
                facebookUserId: pending.facebookUserId,
                facebookUserName: pending.facebookUserName,
                status: database_3.AutoPostFacebookConnectionStatus.CONNECTED,
                scopes: unionScopes,
                lastError: null,
            },
            update: {
                encryptedAccessToken: pending.encryptedAccessToken,
                tokenExpiresAt: latestExpiry,
                facebookUserId: pending.facebookUserId,
                facebookUserName: pending.facebookUserName,
                status: database_3.AutoPostFacebookConnectionStatus.CONNECTED,
                scopes: unionScopes,
                lastError: null,
            },
        });
        // Upsert only selected pages — do NOT delete pages user still keeps / previously connected
        for (const item of accepted) {
            await (0, database_2.assertPlanResource)(tx, params.organizationId, 'fanpages', async () => {
                const ids = await (0, database_1.planFanpageIds)(tx, params.organizationId);
                return ids.size - (ids.has(item.page.id) ? 1 : 0);
            });
            await tx.autoPostFacebookPage.upsert({
                where: {
                    connectionId_pageId: { connectionId: newConn.id, pageId: item.page.id },
                },
                create: {
                    userId: params.userId,
                    connectionId: newConn.id,
                    pageId: item.page.id,
                    pageName: item.page.name,
                    pagePictureUrl: item.page.picture?.data?.url ?? null,
                    encryptedPageAccessToken: item.encryptedPageAccessToken,
                },
                update: {
                    pageName: item.page.name,
                    pagePictureUrl: item.page.picture?.data?.url ?? null,
                    encryptedPageAccessToken: item.encryptedPageAccessToken,
                },
            });
        }
        await tx.autoPostFacebookOAuthPendingConnection.delete({
            where: {
                userId_organizationId: { userId: params.userId, organizationId: params.organizationId },
            },
        });
    });
    return { selected: accepted.map((a) => a.page.id), failed };
}
/** @deprecated Dùng selectOAuthPages({ pageIds: [pageId] }) */
async function selectOAuthPage(prisma, params) {
    await selectOAuthPages(prisma, {
        userId: params.userId,
        organizationId: params.organizationId,
        pageIds: [params.pageId],
        encryptionKey: params.encryptionKey,
        meta: params.meta,
    });
}
