"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaginationParams = getPaginationParams;
exports.buildPaginatedResult = buildPaginatedResult;
function getPaginationParams(dto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    return { page, pageSize, skip, take: pageSize };
}
function buildPaginatedResult(items, total, page, pageSize) {
    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
    };
}
