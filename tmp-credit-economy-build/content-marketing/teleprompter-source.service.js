"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeleprompterSourceService = void 0;
/**
 * Teleprompter source snapshots — tenant-scoped by organization + user.
 */
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function mapRow(row) {
    return {
        id: row.id,
        contentId: row.id,
        sourceContentId: row.clientContentId || row.id,
        clientContentId: row.clientContentId,
        sourceType: row.sourceType,
        sourceRoute: row.sourceRoute,
        sourceTitle: row.sourceTitle,
        originalScript: row.originalScript,
        editedScript: row.editedScript,
        videoHook: row.videoHook,
        facebookPost: row.facebookPost,
        estimatedDuration: row.estimatedDuration,
        updatedAt: row.updatedAt.toISOString(),
    };
}
let TeleprompterSourceService = class TeleprompterSourceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upsert(user, dto) {
        const editedScript = (dto.editedScript || dto.originalScript || '').trim();
        if (!editedScript) {
            throw new common_1.ForbiddenException('Kịch bản trống');
        }
        const originalScript = (dto.originalScript || editedScript).trim();
        const sourceTitle = (dto.sourceTitle || 'Kịch bản quay video').trim().slice(0, 500);
        const sourceType = (dto.sourceType || 'manual').trim().slice(0, 40);
        const clientContentId = dto.clientContentId?.trim() || dto.sourceContentId?.trim() || null;
        const estimatedDuration = Number(dto.estimatedDuration) > 0
            ? Math.round(Number(dto.estimatedDuration))
            : Math.max(5, Math.round((editedScript.split(/\s+/).filter(Boolean).length / 150) * 60));
        const data = {
            sourceType,
            sourceRoute: dto.sourceRoute?.trim()?.slice(0, 500) || null,
            sourceTitle,
            originalScript,
            editedScript,
            videoHook: dto.videoHook?.trim() || null,
            facebookPost: dto.facebookPost?.trim() || null,
            estimatedDuration,
            clientContentId,
        };
        // Prefer update by explicit id (must belong to same org + user)
        if (dto.id?.trim()) {
            const existing = await this.prisma.contentTeleprompterSource.findFirst({
                where: {
                    id: dto.id.trim(),
                    organizationId: user.organizationId,
                    userId: user.id,
                },
            });
            if (!existing) {
                throw new common_1.NotFoundException('Không tìm thấy kịch bản hoặc không có quyền truy cập');
            }
            const row = await this.prisma.contentTeleprompterSource.update({
                where: { id: existing.id },
                data,
            });
            return mapRow(row);
        }
        if (clientContentId) {
            const existing = await this.prisma.contentTeleprompterSource.findFirst({
                where: {
                    organizationId: user.organizationId,
                    userId: user.id,
                    clientContentId,
                },
            });
            if (existing) {
                const row = await this.prisma.contentTeleprompterSource.update({
                    where: { id: existing.id },
                    data,
                });
                return mapRow(row);
            }
        }
        const row = await this.prisma.contentTeleprompterSource.create({
            data: {
                organizationId: user.organizationId,
                userId: user.id,
                ...data,
            },
        });
        return mapRow(row);
    }
    async getById(user, id) {
        const row = await this.prisma.contentTeleprompterSource.findFirst({
            where: {
                id,
                organizationId: user.organizationId,
                userId: user.id,
            },
        });
        if (!row) {
            // Same response whether missing or other tenant — no leak
            throw new common_1.NotFoundException('Không tìm thấy kịch bản hoặc không có quyền truy cập');
        }
        return mapRow(row);
    }
};
exports.TeleprompterSourceService = TeleprompterSourceService;
exports.TeleprompterSourceService = TeleprompterSourceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TeleprompterSourceService);
