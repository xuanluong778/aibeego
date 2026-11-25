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
exports.OpinionVoiceProfileService = void 0;
/**
 * Voice profile for “Góc nhìn & Chính kiến” — per user / organization.
 */
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const roles_1 = require("../common/constants/roles");
function cleanList(arr, max = 20, maxLen = 120) {
    if (!Array.isArray(arr))
        return [];
    return arr
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .slice(0, max)
        .map((s) => s.slice(0, maxLen));
}
function mapRow(row) {
    return {
        pronoun: row.pronoun,
        preferredWords: row.preferredWords,
        avoidWords: row.avoidWords,
        openingPhrases: row.openingPhrases,
        closingPhrases: row.closingPhrases,
        sampleParagraph: row.sampleParagraph,
        source: (row.userId ? 'user' : 'organization'),
    };
}
let OpinionVoiceProfileService = class OpinionVoiceProfileService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(user) {
        const [userRow, orgRow] = await Promise.all([
            this.prisma.contentOpinionVoiceProfile.findFirst({
                where: { organizationId: user.organizationId, userId: user.id },
            }),
            this.prisma.contentOpinionVoiceProfile.findFirst({
                where: { organizationId: user.organizationId, userId: null },
            }),
        ]);
        const resolved = userRow ?? orgRow ?? null;
        return {
            user: userRow ? mapRow(userRow) : null,
            organization: orgRow ? mapRow(orgRow) : null,
            resolved: resolved
                ? {
                    ...mapRow(resolved),
                    source: userRow ? 'user' : 'organization',
                }
                : null,
        };
    }
    async upsertProfile(user, dto) {
        const scope = dto.scope ?? 'user';
        if (scope === 'organization') {
            const can = user.role === 'SUPER_ADMIN' ||
                user.role === roles_1.SYSTEM_ROLES.OWNER ||
                user.role === roles_1.SYSTEM_ROLES.MANAGER;
            if (!can) {
                throw new common_1.ForbiddenException('Chỉ OWNER/MANAGER/SUPER_ADMIN được lưu giọng nói mặc định tổ chức');
            }
        }
        const data = {
            pronoun: dto.pronoun?.trim() || null,
            preferredWords: cleanList(dto.preferredWords),
            avoidWords: cleanList(dto.avoidWords),
            openingPhrases: cleanList(dto.openingPhrases, 10, 200),
            closingPhrases: cleanList(dto.closingPhrases, 10, 200),
            sampleParagraph: dto.sampleParagraph?.trim()?.slice(0, 4000) || null,
        };
        const whereUserId = scope === 'organization' ? null : user.id;
        const existing = await this.prisma.contentOpinionVoiceProfile.findFirst({
            where: { organizationId: user.organizationId, userId: whereUserId },
        });
        const row = existing
            ? await this.prisma.contentOpinionVoiceProfile.update({
                where: { id: existing.id },
                data,
            })
            : await this.prisma.contentOpinionVoiceProfile.create({
                data: {
                    organizationId: user.organizationId,
                    userId: whereUserId,
                    ...data,
                },
            });
        return mapRow(row);
    }
};
exports.OpinionVoiceProfileService = OpinionVoiceProfileService;
exports.OpinionVoiceProfileService = OpinionVoiceProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OpinionVoiceProfileService);
