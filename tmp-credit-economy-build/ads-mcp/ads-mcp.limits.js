"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampMcpLimit = clampMcpLimit;
exports.assertMcpDateRange = assertMcpDateRange;
exports.withMcpTimeout = withMcpTimeout;
exports.previousPeriod = previousPeriod;
exports.pctChange = pctChange;
const shared_1 = require("@marketingspa/shared");
function clampMcpLimit(limit) {
    const parsed = shared_1.adsMcpLimitSchema.safeParse(limit ?? shared_1.ADS_MCP_LIMITS.defaultLimit);
    if (!parsed.success)
        return shared_1.ADS_MCP_LIMITS.defaultLimit;
    return Math.min(parsed.data, shared_1.ADS_MCP_LIMITS.maxRows);
}
function assertMcpDateRange(dateFrom, dateTo) {
    return shared_1.adsMcpDateRangeSchema.parse({ dateFrom, dateTo });
}
/** Timeout cứng — MCP không được treo khi query DB. */
async function withMcpTimeout(promise, ms = shared_1.ADS_MCP_LIMITS.timeoutMs, label = 'AdsMcpTool') {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(`${label} timeout sau ${ms}ms`));
                }, ms);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function previousPeriod(dateFrom, dateTo) {
    const from = new Date(dateFrom + 'T00:00:00.000Z');
    const to = new Date(dateTo + 'T00:00:00.000Z');
    const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
    const prevTo = new Date(from);
    prevTo.setUTCDate(prevTo.getUTCDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - (span - 1));
    return {
        dateFrom: prevFrom.toISOString().slice(0, 10),
        dateTo: prevTo.toISOString().slice(0, 10),
    };
}
function pctChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous))
        return null;
    if (previous === 0)
        return current === 0 ? 0 : null;
    return ((current - previous) / Math.abs(previous)) * 100;
}
