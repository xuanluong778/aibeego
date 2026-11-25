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
exports.AppointmentConflictService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const BLOCKING = [
    database_1.AppointmentStatus.SCHEDULED,
    database_1.AppointmentStatus.CONFIRMED,
    database_1.AppointmentStatus.ARRIVED,
];
let AppointmentConflictService = class AppointmentConflictService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertNoConflict(organizationId, input) {
        const start = input.scheduledAt;
        const end = new Date(start.getTime() + input.durationMinutes * 60_000);
        const candidates = await this.prisma.appointment.findMany({
            where: {
                organizationId,
                status: { in: BLOCKING },
                ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
                OR: [
                    ...(input.employeeId ? [{ employeeId: input.employeeId }] : []),
                    ...(input.roomId ? [{ roomId: input.roomId }] : []),
                    ...(input.bedId ? [{ bedId: input.bedId }] : []),
                    ...(input.equipmentId ? [{ equipmentId: input.equipmentId }] : []),
                ],
                scheduledAt: {
                    gte: new Date(start.getTime() - 12 * 3600_000),
                    lte: new Date(end.getTime() + 12 * 3600_000),
                },
            },
            select: {
                id: true,
                scheduledAt: true,
                durationMinutes: true,
                employeeId: true,
                roomId: true,
                bedId: true,
                equipmentId: true,
            },
        });
        if (!input.employeeId && !input.roomId && !input.bedId && !input.equipmentId) {
            return;
        }
        for (const c of candidates) {
            const cStart = c.scheduledAt.getTime();
            const cEnd = cStart + c.durationMinutes * 60_000;
            const overlaps = start.getTime() < cEnd && end.getTime() > cStart;
            if (!overlaps)
                continue;
            if (input.employeeId && c.employeeId === input.employeeId) {
                throw new common_1.ConflictException('Nhân viên đã có lịch trùng giờ');
            }
            if (input.roomId && c.roomId === input.roomId) {
                throw new common_1.ConflictException('Phòng đã được đặt trùng giờ');
            }
            if (input.bedId && c.bedId === input.bedId) {
                throw new common_1.ConflictException('Giường đã được đặt trùng giờ');
            }
            if (input.equipmentId && c.equipmentId === input.equipmentId) {
                throw new common_1.ConflictException('Thiết bị đang được dùng trùng giờ');
            }
        }
    }
};
exports.AppointmentConflictService = AppointmentConflictService;
exports.AppointmentConflictService = AppointmentConflictService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppointmentConflictService);
