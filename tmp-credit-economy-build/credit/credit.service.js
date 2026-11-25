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
exports.CreditService = exports.CreditReservationNotFoundError = exports.InsufficientCreditsError = void 0;
exports.isInsufficientCredits = isInsufficientCredits;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
class InsufficientCreditsError extends common_1.BadRequestException {
    constructor(required, available) {
        super({
            code: 'INSUFFICIENT_CREDITS',
            message: 'Không đủ AI Credit',
            required,
            available,
        });
    }
}
exports.InsufficientCreditsError = InsufficientCreditsError;
class CreditReservationNotFoundError extends common_1.NotFoundException {
    constructor(referenceId) {
        super({
            code: 'CREDIT_RESERVATION_NOT_FOUND',
            message: `Không tìm thấy reservation cho referenceId=${referenceId}`,
            referenceId,
        });
    }
}
exports.CreditReservationNotFoundError = CreditReservationNotFoundError;
function isInsufficientCredits(err) {
    if (err instanceof InsufficientCreditsError)
        return true;
    if (err instanceof database_1.CreditError && err.code === 'INSUFFICIENT_CREDITS')
        return true;
    if (err instanceof common_1.BadRequestException) {
        const body = err.getResponse();
        return typeof body === 'object' && body !== null && body.code === 'INSUFFICIENT_CREDITS';
    }
    return false;
}
let CreditService = class CreditService {
    prisma;
    ledger;
    constructor(prisma) {
        this.prisma = prisma;
        this.ledger = new database_1.CreditLedger(this.prisma);
    }
    getBalance(organizationId) {
        return this.wrap(() => this.ledger.getBalance(organizationId));
    }
    checkAvailable(organizationId, amount) {
        return this.wrap(() => this.ledger.checkAvailable(organizationId, amount));
    }
    getFeatureCost(featureCode) {
        return this.wrap(() => this.ledger.getFeatureCost(featureCode));
    }
    resolveFeatureAmount(featureCode, overrideAmount) {
        return this.wrap(() => this.ledger.resolveFeatureAmount(featureCode, overrideAmount));
    }
    grant(params, tx) {
        return this.wrap(() => this.ledger.grant(params, tx));
    }
    purchase(params, tx) {
        return this.wrap(() => this.ledger.purchase(params, tx));
    }
    refund(params) {
        return this.wrap(() => this.ledger.refund(params));
    }
    adjust(params, tx) {
        return this.wrap(() => this.ledger.adjust(params, tx));
    }
    usage(params) {
        return this.wrap(() => this.ledger.usage(params));
    }
    reserve(params) {
        return this.wrap(() => this.ledger.reserve(params));
    }
    commit(params) {
        return this.wrap(() => this.ledger.commit(params));
    }
    release(params) {
        return this.wrap(() => this.ledger.release(params));
    }
    hasCommitted(organizationId, referenceId) {
        return this.wrap(() => this.ledger.hasCommitted(organizationId, referenceId));
    }
    ensureWallet(organizationId) {
        return this.wrap(() => this.ledger.ensureWallet(organizationId));
    }
    runPaidFeature(params) {
        return this.wrap(() => this.ledger.runPaidFeature(params));
    }
    async listPackages() {
        const rows = await this.prisma.creditPackage.findMany({
            where: { status: 'ACTIVE' },
            orderBy: [{ sortOrder: 'asc' }, { priceVnd: 'asc' }],
        });
        return rows.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            credits: Number(p.credits),
            priceVnd: Number(p.priceVnd),
            status: p.status,
        }));
    }
    async listHistory(organizationId, query = {}) {
        await this.ensureWallet(organizationId);
        const page = Math.max(1, query.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
        const where = { organizationId };
        if (!query.includeInternal) {
            where.type = { notIn: [database_1.CreditTransactionType.RESERVE, database_1.CreditTransactionType.RELEASE] };
        }
        const [total, rows, pricing] = await Promise.all([
            this.prisma.creditTransaction.count({ where }),
            this.prisma.creditTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.creditFeaturePricing.findMany({
                select: { featureCode: true, name: true },
            }),
        ]);
        const names = new Map(pricing.map((p) => [p.featureCode, p.name]));
        return {
            items: rows.map((row) => this.mapTransaction(row, names)),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        };
    }
    mapTransaction(row, featureNames) {
        const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? row.metadata
            : {};
        const type = String(row.type);
        const featureName = (row.featureCode && featureNames?.get(row.featureCode)) ||
            (0, shared_1.creditFeatureLabel)(row.featureCode, type, row.reason);
        return {
            id: row.id,
            createdAt: row.createdAt,
            type,
            featureCode: row.featureCode,
            featureLabel: featureName,
            reason: row.reason,
            referenceId: row.referenceId,
            amount: (0, shared_1.signedCreditAmount)(type, Number(row.amount), metadata),
            balanceAfter: Number(row.balanceAfter),
            reservedAfter: Number(row.reservedAfter),
        };
    }
    async wrap(fn) {
        try {
            return await fn();
        }
        catch (err) {
            try {
                this.toHttp(err);
            }
            catch (mapped) {
                const context = database_1.creditCallContext.getStore();
                if (context && (err instanceof database_1.CreditError || err instanceof database_1.PlanPolicyError))
                    context.billingError = mapped;
                throw mapped;
            }
        }
    }
    toHttp(err) {
        if (err instanceof database_1.CreditError) {
            if (err.code === 'INSUFFICIENT_CREDITS') {
                throw new InsufficientCreditsError(Number(err.extra.required ?? 0), Number(err.extra.available ?? 0));
            }
            if (err.code === 'CREDIT_RESERVATION_NOT_FOUND') {
                throw new CreditReservationNotFoundError(String(err.extra.referenceId ?? ''));
            }
            if (err.code === 'FEATURE_PRICING_NOT_FOUND') {
                throw new common_1.NotFoundException(err.message);
            }
            if (err.code === 'RESERVE_UNDERFLOW') {
                throw new common_1.ConflictException(err.message);
            }
            if (err.code === 'ALREADY_COMMITTED') {
                throw new common_1.ConflictException({ code: err.code, message: err.message });
            }
            throw new common_1.BadRequestException({ code: err.code, message: err.message });
        }
        throw err;
    }
};
exports.CreditService = CreditService;
exports.CreditService = CreditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CreditService);
