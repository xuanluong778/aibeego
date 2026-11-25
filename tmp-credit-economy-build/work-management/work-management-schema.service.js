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
var WorkManagementSchemaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkManagementSchemaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
/**
 * Idempotent ADD-only schema fixes for work management (VPS thường chạy migrate chậm hơn code).
 */
let WorkManagementSchemaService = WorkManagementSchemaService_1 = class WorkManagementSchemaService {
    prisma;
    logger = new common_1.Logger(WorkManagementSchemaService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        try {
            await this.ensureWorkManagementColumns();
        }
        catch (err) {
            this.logger.warn(`ensureWorkManagementColumns skipped: ${String(err)}`);
        }
    }
    async ensureWorkManagementColumns() {
        await this.prisma.$executeRawUnsafe(`
      ALTER TABLE "work_projects"
        ADD COLUMN IF NOT EXISTS "custom_field_defs" JSONB DEFAULT '[]'::jsonb;
    `);
        await this.prisma.$executeRawUnsafe(`
      ALTER TABLE "work_tasks"
        ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
    `);
        this.logger.log('Work management schema columns OK (custom_field_defs / custom_fields)');
    }
};
exports.WorkManagementSchemaService = WorkManagementSchemaService;
exports.WorkManagementSchemaService = WorkManagementSchemaService = WorkManagementSchemaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkManagementSchemaService);
