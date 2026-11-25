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
exports.HrmDocumentsService = void 0;
const plan_storage_1 = require("../common/uploads/plan-storage");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs_1 = require("fs");
const path_1 = require("path");
const promises_1 = require("stream/promises");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const upload_policy_1 = require("../common/uploads/upload-policy");
const upload_signed_url_1 = require("../common/uploads/upload-signed-url");
const hrm_employees_service_1 = require("./hrm-employees.service");
let HrmDocumentsService = class HrmDocumentsService {
    prisma;
    audit;
    employees;
    config;
    constructor(prisma, audit, employees, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.employees = employees;
        this.config = config;
    }
    uploadsRoot() {
        return (0, path_1.join)(process.cwd(), 'uploads', 'hrm');
    }
    signDoc(doc) {
        if (!doc?.fileUrl)
            return doc;
        return { ...doc, fileUrl: (0, upload_signed_url_1.withSignedUploadUrl)(doc.fileUrl) };
    }
    async listByEmployee(organizationId, employeeId) {
        await this.employees.ensureEmployee(organizationId, employeeId);
        const rows = await this.prisma.employeeDocument.findMany({
            where: { organizationId, employeeId, isArchived: false },
            orderBy: { createdAt: 'desc' },
        });
        return rows.map((r) => this.signDoc(r));
    }
    async create(organizationId, employeeId, dto, actor) {
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const document = await this.prisma.employeeDocument.create({
            data: {
                organizationId,
                employeeId,
                branchId: employee.branchId,
                title: dto.title,
                type: dto.type,
                fileUrl: dto.fileUrl,
                fileKey: dto.fileKey,
                mimeType: dto.mimeType,
                sizeBytes: dto.sizeBytes,
                issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
                uploadedById: actor?.userId,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.document.create',
            entityType: 'EmployeeDocument',
            entityId: document.id,
            metadata: {
                after: {
                    employeeId,
                    title: document.title,
                    type: document.type,
                    fileUrl: document.fileUrl,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return this.signDoc(document);
    }
    async upload(organizationId, employeeId, file, meta, actor) {
        if (!file?.buffer && !file?.path && !file?.stream) {
            throw new common_1.BadRequestException('Thiếu file upload');
        }
        (0, upload_policy_1.assertUploadFile)('document', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size ?? file.buffer?.length,
        });
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const dir = (0, path_1.join)(this.uploadsRoot(), organizationId);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        const { filename } = (0, upload_policy_1.randomStoredFilename)(file.originalname || 'file.pdf');
        const absPath = (0, path_1.join)(dir, filename);
        const fileKey = `hrm/${organizationId}/${filename}`;
        await (0, plan_storage_1.writePlanFile)(this.prisma, organizationId, absPath, file.buffer?.length ?? file.size ?? 0, async () => {
            if (file.buffer) {
                (0, fs_1.writeFileSync)(absPath, file.buffer);
            }
            else if (file.stream) {
                await (0, promises_1.pipeline)(file.stream, (0, fs_1.createWriteStream)(absPath));
            }
            else if (file.path) {
                (0, fs_1.copyFileSync)(file.path, absPath);
            }
        });
        const storedPath = `/uploads/hrm/${organizationId}/${filename}`;
        const document = await this.prisma.employeeDocument.create({
            data: {
                organizationId,
                employeeId,
                branchId: employee.branchId,
                title: meta.title,
                type: meta.type,
                fileUrl: storedPath,
                fileKey,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                issuedAt: meta.issuedAt ? new Date(meta.issuedAt) : undefined,
                expiresAt: meta.expiresAt ? new Date(meta.expiresAt) : undefined,
                uploadedById: actor?.userId,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.document.upload',
            entityType: 'EmployeeDocument',
            entityId: document.id,
            metadata: {
                after: {
                    employeeId,
                    title: document.title,
                    type: document.type,
                    fileUrl: document.fileUrl,
                    fileKey: document.fileKey,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return this.signDoc(document);
    }
    async archive(organizationId, id, actor) {
        const existing = await this.prisma.employeeDocument.findFirst({
            where: { id, organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Tài liệu không tồn tại');
        if (existing.isArchived) {
            return this.signDoc(existing);
        }
        const document = await this.prisma.employeeDocument.update({
            where: { id },
            data: { isArchived: true },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.document.archive',
            entityType: 'EmployeeDocument',
            entityId: id,
            metadata: {
                before: { isArchived: false },
                after: { isArchived: true },
            },
            ipAddress: actor?.ipAddress,
        });
        return this.signDoc(document);
    }
};
exports.HrmDocumentsService = HrmDocumentsService;
exports.HrmDocumentsService = HrmDocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        hrm_employees_service_1.HrmEmployeesService,
        config_1.ConfigService])
], HrmDocumentsService);
