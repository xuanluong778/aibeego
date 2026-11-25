"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_QUICK_FILTERS = exports.PROJECT_SORT_OPTIONS = exports.PROJECT_DATE_PRESETS = void 0;
exports.resolveProjectDateRange = resolveProjectDateRange;
exports.buildProjectListOrderBy = buildProjectListOrderBy;
exports.buildProjectListWhere = buildProjectListWhere;
exports.PROJECT_DATE_PRESETS = [
    'today',
    '7d',
    '30d',
    'this_month',
    'last_month',
    'this_year',
    'custom',
];
exports.PROJECT_SORT_OPTIONS = ['newest', 'oldest', 'budget', 'name'];
exports.PROJECT_QUICK_FILTERS = ['running', 'needs_approval'];
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}
/** Resolve createdAt range from preset or custom ISO dates (YYYY-MM-DD). */
function resolveProjectDateRange(preset, dateFrom, dateTo, now = new Date()) {
    if (!preset)
        return null;
    const p = preset;
    if (p === 'custom') {
        if (!dateFrom && !dateTo)
            return null;
        return {
            ...(dateFrom ? { gte: startOfDay(new Date(dateFrom)) } : {}),
            ...(dateTo ? { lte: endOfDay(new Date(dateTo)) } : {}),
        };
    }
    const todayStart = startOfDay(now);
    switch (p) {
        case 'today':
            return { gte: todayStart, lte: now };
        case '7d': {
            const gte = new Date(todayStart);
            gte.setDate(gte.getDate() - 6);
            return { gte, lte: now };
        }
        case '30d': {
            const gte = new Date(todayStart);
            gte.setDate(gte.getDate() - 29);
            return { gte, lte: now };
        }
        case 'this_month':
            return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now };
        case 'last_month': {
            const gte = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lte = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
            return { gte, lte };
        }
        case 'this_year':
            return { gte: new Date(now.getFullYear(), 0, 1), lte: now };
        default:
            return null;
    }
}
function buildProjectListOrderBy(sort) {
    const s = (sort ?? 'newest');
    switch (s) {
        case 'oldest':
            return { createdAt: 'asc' };
        case 'budget':
            return { monthlyBudget: 'desc' };
        case 'name':
            return { name: 'asc' };
        case 'newest':
        default:
            return { createdAt: 'desc' };
    }
}
function buildProjectListWhere(organizationId, query) {
    const and = [{ organizationId }];
    if (!query.includeArchived) {
        and.push({ deletedAt: null });
    }
    const q = query.q?.trim();
    if (q) {
        and.push({
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { productName: { contains: q, mode: 'insensitive' } },
            ],
        });
    }
    const dateRange = resolveProjectDateRange(query.datePreset, query.dateFrom, query.dateTo);
    if (dateRange) {
        and.push({ createdAt: dateRange });
    }
    if (query.status?.trim()) {
        and.push({ status: query.status.trim() });
    }
    if (query.product?.trim()) {
        and.push({ productName: { equals: query.product.trim(), mode: 'insensitive' } });
    }
    if (query.goal?.trim()) {
        and.push({ primaryGoal: { contains: query.goal.trim(), mode: 'insensitive' } });
    }
    if (query.budgetMin != null && query.budgetMin >= 0) {
        and.push({ monthlyBudget: { gte: query.budgetMin } });
    }
    if (query.budgetMax != null && query.budgetMax >= 0) {
        and.push({ monthlyBudget: { lte: query.budgetMax } });
    }
    if (query.quickFilter === 'running') {
        and.push({
            OR: [{ status: 'RUNNING' }, { missions: { some: { status: 'RUNNING' } } }],
        });
    }
    else if (query.quickFilter === 'needs_approval') {
        and.push({
            OR: [
                { status: 'READY_FOR_APPROVAL' },
                { missions: { some: { status: 'READY_FOR_APPROVAL' } } },
            ],
        });
    }
    return and.length === 1 ? and[0] : { AND: and };
}
