"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalish = decimalish;
exports.okTool = okTool;
exports.emptyTool = emptyTool;
exports.validationTool = validationTool;
exports.mapDomainError = mapDomainError;
exports.clampLimit = clampLimit;
exports.pick = pick;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
function decimalish(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : 0;
    if (typeof v === 'object' && v !== null && 'toNumber' in v) {
        try {
            return Number(v.toNumber());
        }
        catch {
            return Number(v);
        }
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function okTool(ctx, tool, data, options = {}) {
    const dataWithRange = options.range && data && typeof data === 'object' && !Array.isArray(data)
        ? {
            ...data,
            period: options.range.period,
            periodLabel: options.range.label,
            dateFrom: options.range.dateFrom,
            dateTo: options.range.dateTo,
        }
        : data;
    return (0, shared_1.assistantOkResult)({
        tool,
        organizationId: ctx.organizationId,
        timezone: ctx.timezone,
        data: dataWithRange,
        evidence: options.evidence,
        links: options.links,
        source: options.source ?? 'AssistantToolRegistry',
    });
}
function emptyTool(ctx, tool, message) {
    return (0, shared_1.assistantErrResult)({
        code: 'EMPTY',
        message,
        tool,
        organizationId: ctx.organizationId,
    });
}
function validationTool(ctx, tool, message) {
    return (0, shared_1.assistantErrResult)({
        code: 'VALIDATION',
        message,
        tool,
        organizationId: ctx.organizationId,
    });
}
function mapDomainError(err, ctx, tool) {
    if (err instanceof common_1.NotFoundException) {
        return (0, shared_1.assistantErrResult)({
            code: 'NOT_FOUND',
            message: err.message || 'Không tìm thấy bản ghi',
            tool,
            organizationId: ctx.organizationId,
        });
    }
    if (err instanceof common_1.ForbiddenException) {
        return (0, shared_1.assistantErrResult)({
            code: 'FORBIDDEN',
            message: err.message || 'Không có quyền',
            tool,
            organizationId: ctx.organizationId,
        });
    }
    if (err instanceof common_1.BadRequestException) {
        return (0, shared_1.assistantErrResult)({
            code: 'VALIDATION',
            message: err.message || 'Tham số không hợp lệ',
            tool,
            organizationId: ctx.organizationId,
        });
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('custom_period') ||
        msg.startsWith('invalid_date') ||
        msg.startsWith('date_')) {
        return validationTool(ctx, tool, msg);
    }
    return (0, shared_1.assistantErrResult)({
        code: 'UPSTREAM',
        message: 'Lỗi khi đọc dữ liệu domain',
        tool,
        organizationId: ctx.organizationId,
        retryable: true,
    });
}
function clampLimit(raw, fallback = 20) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(50, Math.max(1, Math.floor(n)));
}
/** Primitive snapshot for LLM (drop heavy nests). */
function pick(obj, keys) {
    if (!obj)
        return null;
    const out = {};
    for (const k of keys) {
        if (k in obj)
            out[k] = obj[k];
    }
    return out;
}
