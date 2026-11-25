"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_POST_REQUIRED_PAGE_SCOPES = void 0;
exports.missingRequiredPageScopes = missingRequiredPageScopes;
exports.mergeGrantedScopes = mergeGrantedScopes;
exports.parseMetaPageAccount = parseMetaPageAccount;
exports.pageCanManagePosts = pageCanManagePosts;
exports.toOAuthPagesListItem = toOAuthPagesListItem;
exports.fetchAllManagedPages = fetchAllManagedPages;
exports.buildOAuthPagesListResult = buildOAuthPagesListResult;
/** Quyền Pages tối thiểu cho OAuth Fanpage (Login for Business Configuration). */
exports.AUTO_POST_REQUIRED_PAGE_SCOPES = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
];
function missingRequiredPageScopes(granted) {
    const set = new Set(granted);
    return exports.AUTO_POST_REQUIRED_PAGE_SCOPES.filter((s) => !set.has(s));
}
function mergeGrantedScopes(fromPermissions, fromDebugToken) {
    return [...new Set([...fromPermissions, ...(fromDebugToken ?? [])].filter(Boolean))];
}
/** Parse Graph `/me/accounts` row — không loại Page theo Business Portfolio / New Pages Experience. */
function parseMetaPageAccount(raw) {
    const id = String(raw.id ?? '').trim();
    const name = String(raw.name ?? '').trim();
    if (!id || !name)
        return null;
    const pictureUrl = raw.picture?.data?.url ?? raw.picture?.url ?? null;
    const tasks = Array.isArray(raw.tasks)
        ? raw.tasks.map((t) => String(t)).filter(Boolean)
        : [];
    return {
        id,
        name,
        access_token: String(raw.access_token ?? ''),
        picture: pictureUrl ? { data: { url: pictureUrl } } : undefined,
        tasks,
    };
}
function pageCanManagePosts(page) {
    if (page.tasks.includes('CREATE_CONTENT') || page.tasks.includes('MANAGE')) {
        return true;
    }
    // Một số Page cũ không trả tasks — vẫn hiển thị nếu có access_token từ /me/accounts.
    return Boolean(page.access_token);
}
function toOAuthPagesListItem(page) {
    return {
        id: page.id,
        pageId: page.id,
        pageName: page.name,
        pagePictureUrl: page.picture?.data?.url ?? null,
        tasks: page.tasks,
        canManagePosts: pageCanManagePosts(page),
    };
}
async function fetchAllManagedPages(fetchPage, apiVersion) {
    const fields = 'id,name,access_token,picture{url},tasks';
    let nextUrl = `https://graph.facebook.com/${apiVersion}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100`;
    const parsed = [];
    const seen = new Set();
    while (nextUrl) {
        const body = await fetchPage(nextUrl);
        if (body.error) {
            throw new Error(body.error.message ?? 'Meta API error');
        }
        for (const row of body.data ?? []) {
            const page = parseMetaPageAccount(row);
            if (!page || seen.has(page.id))
                continue;
            seen.add(page.id);
            parsed.push(page);
        }
        nextUrl = body.paging?.next ?? null;
    }
    return parsed;
}
function buildOAuthPagesListResult(input) {
    return {
        status: input.status,
        facebookUserName: input.facebookUserName ?? null,
        grantedScopes: input.grantedScopes ?? [],
        missingScopes: input.missingScopes ?? [],
        requiredScopes: [...exports.AUTO_POST_REQUIRED_PAGE_SCOPES],
        pages: (input.pages ?? []).map(toOAuthPagesListItem),
        message: input.message ?? null,
    };
}
