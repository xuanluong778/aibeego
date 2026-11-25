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
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const billing_mail_service_1 = require("./billing-mail.service");
const token_security_util_1 = require("../common/utils/token-security.util");
const affiliate_service_1 = require("../affiliate/affiliate.service");
const credit_service_1 = require("../credit/credit.service");
const email_normalize_util_1 = require("../common/utils/email-normalize.util");
const hash_signal_util_1 = require("../common/utils/hash-signal.util");
const shared_1 = require("@marketingspa/shared");
const database_2 = require("@marketingspa/database");
const ACB_BIN = '970416';
const ORDER_TTL_MS = 30 * 60 * 1000;
function stringsEqual(a, b) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(ba, bb);
}
let BillingService = BillingService_1 = class BillingService {
    prisma;
    config;
    audit;
    mail;
    affiliate;
    credit;
    logger = new common_1.Logger(BillingService_1.name);
    constructor(prisma, config, audit, mail, affiliate, credit) {
        this.prisma = prisma;
        this.config = config;
        this.audit = audit;
        this.mail = mail;
        this.affiliate = affiliate;
        this.credit = credit;
    }
    bankCode() {
        return (this.config.get('PAYMENT_BANK_CODE') || 'ACB').trim();
    }
    accountNumber() {
        return (this.config.get('PAYMENT_ACCOUNT_NUMBER') || '7982468').trim();
    }
    accountName() {
        return (this.config.get('PAYMENT_ACCOUNT_NAME') || 'CONG TY TNHH THE GIOI DIGI').trim();
    }
    codePrefix() {
        return (this.config.get('PAYMENT_CODE_PREFIX') || 'MKTA').trim().toUpperCase();
    }
    async listPlans() {
        const plans = await this.prisma.subscriptionPlan.findMany({
            where: { isActive: true, code: { startsWith: 'abg-' }, durationMonths: { in: [1, 6, 12] } },
            orderBy: [{ sortOrder: 'asc' }, { durationMonths: 'asc' }],
        });
        return plans.map((plan) => ({ ...plan, entitlement: (0, shared_1.planDefinition)(plan.code),
            bonusMonths: (0, shared_1.planBonusMonths)(plan.code),
            totalUsageMonths: plan.durationMonths + (0, shared_1.planBonusMonths)(plan.code) }));
    }
    async getPlanEntitlements(organizationId) {
        const { subscription, definition } = await (0, database_2.organizationPlan)(this.prisma, organizationId);
        const scheduled = await this.prisma.subscription.findMany({
            where: { organizationId, status: 'ACTIVE', currentPeriodStart: { gt: new Date() } },
            include: { plan: { select: { name: true } } }, orderBy: { currentPeriodStart: 'asc' },
        });
        return { tier: definition?.tier ?? (subscription ? 'LEGACY' : null),
            features: definition?.features ?? [], limits: definition?.limits ?? null,
            monthlyCredits: definition?.monthlyCredits ?? 0, legacy: Boolean(subscription && !definition),
            scheduled: scheduled.map((row) => ({ name: row.plan.name, startsAt: row.currentPeriodStart, endsAt: row.currentPeriodEnd })) };
    }
    async getTrialSettings() {
        return this.prisma.trialSetting.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                enabled: true,
                trialDays: 3,
                allowedFeaturePrefixes: ['content-marketing', 'auto-post', 'video-transcriptions'],
                aiDailyQuota: 30,
            },
            update: {},
        });
    }
    async updateTrialSettings(dto) {
        await this.getTrialSettings();
        return this.prisma.trialSetting.update({
            where: { id: 'default' },
            data: {
                ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
                ...(dto.trialDays !== undefined ? { trialDays: dto.trialDays } : {}),
                ...(dto.allowedFeaturePrefixes !== undefined
                    ? { allowedFeaturePrefixes: dto.allowedFeaturePrefixes }
                    : {}),
                ...(dto.aiDailyQuota !== undefined ? { aiDailyQuota: dto.aiDailyQuota } : {}),
            },
        });
    }
    /** Hết hạn trial tự động TRIALING → TRIAL_EXPIRED */
    async expireTrialIfNeeded(organizationId) {
        const now = new Date();
        await this.prisma.subscription.updateMany({
            where: {
                organizationId,
                status: database_1.SubscriptionStatus.TRIALING,
                OR: [{ trialEndsAt: { lte: now } }, { currentPeriodEnd: { lte: now } }],
            },
            data: { status: database_1.SubscriptionStatus.TRIAL_EXPIRED },
        });
    }
    /**
     * Quyền dùng app: ACTIVE còn hạn hoặc TRIALING chưa hết hạn.
     */
    async hasValidEntitlement(organizationId) {
        await this.expireTrialIfNeeded(organizationId);
        const now = new Date();
        const active = await this.prisma.subscription.findFirst({
            where: {
                organizationId,
                status: database_1.SubscriptionStatus.ACTIVE,
                currentPeriodStart: { lte: now },
                currentPeriodEnd: { gt: now },
            },
            select: { id: true },
        });
        if (active)
            return { ok: true, reason: 'ACTIVE', isTrial: false };
        const trial = await this.prisma.subscription.findFirst({
            where: {
                organizationId,
                status: database_1.SubscriptionStatus.TRIALING,
                trialEndsAt: { gt: now },
                currentPeriodEnd: { gt: now },
            },
            select: { id: true },
        });
        if (trial)
            return { ok: true, reason: 'TRIALING', isTrial: true };
        const trialExpired = await this.prisma.subscription.findFirst({
            where: { organizationId, status: database_1.SubscriptionStatus.TRIAL_EXPIRED },
            select: { id: true },
        });
        if (trialExpired)
            return { ok: false, reason: 'TRIAL_EXPIRED', isTrial: false };
        const expired = await this.prisma.subscription.findFirst({
            where: {
                organizationId,
                status: { in: [database_1.SubscriptionStatus.EXPIRED, database_1.SubscriptionStatus.ACTIVE] },
                currentPeriodEnd: { lte: now },
            },
            select: { id: true },
        });
        if (expired)
            return { ok: false, reason: 'EXPIRED', isTrial: false };
        return { ok: false, reason: 'NONE', isTrial: false };
    }
    /** @deprecated dùng hasValidEntitlement */
    async hasValidPaidSubscription(organizationId) {
        const e = await this.hasValidEntitlement(organizationId);
        return e.ok;
    }
    async isFeatureAllowedForOrg(organizationId, apiPath) {
        const ent = await this.hasValidEntitlement(organizationId);
        if (!ent.ok)
            return false;
        if (!ent.isTrial) {
            const { definition } = await (0, database_2.organizationPlan)(this.prisma, organizationId);
            const feature = (0, shared_1.requiredPlanFeature)(apiPath);
            return !definition || !feature || definition.features.includes(feature);
        }
        const settings = await this.getTrialSettings();
        const prefixes = Array.isArray(settings.allowedFeaturePrefixes)
            ? settings.allowedFeaturePrefixes
            : ['content-marketing', 'auto-post', 'video-transcriptions'];
        const path = apiPath.startsWith('/') ? apiPath.slice(1) : apiPath;
        // Content Studio companion — allow when content-marketing is already in trial
        if ((path === 'video-transcriptions' || path.startsWith('video-transcriptions/')) &&
            prefixes.some((p) => p === 'content-marketing' || p.startsWith('content-marketing'))) {
            return true;
        }
        return prefixes.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p));
    }
    /**
     * Subscription hiện tại — gồm TRIALING / TRIAL_EXPIRED / ACTIVE…
     */
    async getCurrentSubscription(organizationId, viewer) {
        await this.expireTrialIfNeeded(organizationId);
        const claim = await this.prisma.trialClaim.findUnique({
            where: { organizationId },
            select: { id: true, activatedAt: true, trialEndsAt: true },
        });
        const settings = await this.getTrialSettings();
        const sub = await this.prisma.subscription.findFirst({
            where: {
                organizationId,
                status: { not: database_1.SubscriptionStatus.CANCELLED },
                currentPeriodStart: { lte: new Date() },
            },
            include: { plan: true },
            orderBy: { currentPeriodEnd: 'desc' },
        });
        const identity = {
            email: viewer?.email ?? null,
            role: viewer?.role ?? null,
        };
        const trialEligible = settings.enabled &&
            !claim &&
            (!sub ||
                sub.status === database_1.SubscriptionStatus.EXPIRED ||
                sub.status === database_1.SubscriptionStatus.TRIAL_EXPIRED ||
                (sub.status !== database_1.SubscriptionStatus.ACTIVE &&
                    sub.status !== database_1.SubscriptionStatus.TRIALING));
        // Chưa từng có sub / chỉ eligible trial
        if (!sub) {
            return {
                ...identity,
                hasPlan: false,
                planCode: null,
                planName: null,
                durationMonths: null,
                startedAt: null,
                expiresAt: null,
                remainingDays: 0,
                status: 'NONE',
                subscriptionStatus: 'NONE',
                isExpired: true,
                daysRemaining: 0,
                plan: null,
                trial: {
                    enabled: settings.enabled,
                    eligible: !!trialEligible,
                    activated: false,
                    status: null,
                    trialStartedAt: null,
                    trialEndsAt: null,
                    remainingMs: 0,
                    remainingDays: 0,
                    remainingHours: 0,
                    warningWithin24h: false,
                    allowedFeatures: settings.allowedFeaturePrefixes,
                    trialDays: settings.trialDays,
                },
            };
        }
        const now = Date.now();
        const expiresMs = (sub.status === database_1.SubscriptionStatus.TRIALING && sub.trialEndsAt
            ? sub.trialEndsAt
            : sub.currentPeriodEnd).getTime();
        const remainingMs = Math.max(0, expiresMs - now);
        const remainingDays = Math.max(0, Math.ceil(remainingMs / 86400000));
        const remainingHours = Math.max(0, Math.ceil(remainingMs / 3600000));
        let status = 'NONE';
        if (sub.status === database_1.SubscriptionStatus.TRIALING) {
            status = remainingMs > 0 ? 'TRIALING' : 'TRIAL_EXPIRED';
        }
        else if (sub.status === database_1.SubscriptionStatus.TRIAL_EXPIRED) {
            status = 'TRIAL_EXPIRED';
        }
        else if (expiresMs <= now ||
            sub.status === database_1.SubscriptionStatus.EXPIRED) {
            status = 'EXPIRED';
        }
        else if (remainingDays <= 15) {
            status = 'EXPIRING';
        }
        else {
            status = 'ACTIVE';
        }
        const isExpired = status === 'EXPIRED' || status === 'TRIAL_EXPIRED';
        const hasPlan = status === 'ACTIVE' || status === 'EXPIRING' || status === 'TRIALING';
        const monthlyPayment = sub.plan.code === 'msp-pro-1m'
            ? await this.prisma.paymentOrder.findFirst({
                where: { organizationId, planId: sub.planId, status: database_1.PaymentOrderStatus.PAID },
                select: { id: true },
            })
            : null;
        const monthlyDisplay = sub.plan.code === 'msp-pro-1m'
            ? (0, shared_1.buildSubscriptionDisplay)({
                status,
                planCode: sub.plan.code,
                durationMonths: sub.plan.durationMonths,
                rawExpiresAt: new Date(expiresMs),
                paidPeriodEnd: monthlyPayment ? new Date(expiresMs) : null,
                now,
            })
            : null;
        return {
            ...identity,
            ...(monthlyDisplay ? { display: monthlyDisplay } : {}),
            id: sub.id,
            hasPlan,
            planCode: sub.plan.code,
            planName: sub.plan.name,
            durationMonths: sub.plan.durationMonths,
            startedAt: sub.currentPeriodStart.toISOString(),
            expiresAt: new Date(expiresMs).toISOString(),
            remainingDays,
            status,
            subscriptionStatus: status,
            isExpired,
            daysRemaining: remainingDays,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            plan: {
                code: sub.plan.code,
                name: sub.plan.name,
                durationMonths: sub.plan.durationMonths,
            },
            trial: {
                enabled: settings.enabled,
                eligible: !claim && status !== 'ACTIVE' && status !== 'EXPIRING' && status !== 'TRIALING',
                activated: !!claim || status === 'TRIALING' || status === 'TRIAL_EXPIRED',
                status: status === 'TRIALING' || status === 'TRIAL_EXPIRED'
                    ? status
                    : claim
                        ? 'USED'
                        : null,
                trialStartedAt: sub.trialStartedAt?.toISOString() ?? claim?.activatedAt.toISOString() ?? null,
                trialEndsAt: sub.trialEndsAt?.toISOString() ?? claim?.trialEndsAt.toISOString() ?? null,
                remainingMs: status === 'TRIALING' ? remainingMs : 0,
                remainingDays: status === 'TRIALING' ? remainingDays : 0,
                remainingHours: status === 'TRIALING' ? remainingHours : 0,
                warningWithin24h: status === 'TRIALING' && remainingMs > 0 && remainingMs <= 86400000,
                allowedFeatures: settings.allowedFeaturePrefixes,
                trialDays: settings.trialDays,
            },
        };
    }
    /**
     * User chủ động bấm kích hoạt dùng thử 3 ngày — idempotent, 1 lần / email-org-device.
     */
    async activateTrial(user, dto, meta) {
        const settings = await this.getTrialSettings();
        if (!settings.enabled) {
            throw new common_1.BadRequestException('Tính năng dùng thử đang tạm tắt');
        }
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: { organization: true },
        });
        if (!dbUser)
            throw new common_1.NotFoundException('User không tồn tại');
        if (!dbUser.emailVerifiedAt && dbUser.authProvider === 'LOCAL') {
            throw new common_1.BadRequestException('Vui lòng xác minh email trước khi dùng thử');
        }
        const emailNorm = dbUser.emailNormalized || (0, email_normalize_util_1.normalizeEmailForUniqueness)(dbUser.email);
        const phoneNorm = (0, email_normalize_util_1.normalizePhoneDigits)(dbUser.organization.phone);
        const deviceHash = (0, hash_signal_util_1.hashSignal)(dto.deviceFingerprint);
        const ipHash = (0, hash_signal_util_1.hashSignal)(meta?.ip);
        // Đã ACTIVE còn hạn → không cần trial
        const activePaid = await this.prisma.subscription.findFirst({
            where: {
                organizationId: user.organizationId,
                status: database_1.SubscriptionStatus.ACTIVE,
                currentPeriodEnd: { gt: new Date() },
            },
        });
        if (activePaid) {
            throw new common_1.BadRequestException('Tài khoản đã có gói ACTIVE — không cần dùng thử');
        }
        // Idempotent: đã có claim của chính org này
        const existingClaim = await this.prisma.trialClaim.findUnique({
            where: { organizationId: user.organizationId },
            include: { subscription: { include: { plan: true } } },
        });
        if (existingClaim) {
            await this.expireTrialIfNeeded(user.organizationId);
            return {
                activated: true,
                idempotent: true,
                subscription: await this.getCurrentSubscription(user.organizationId, {
                    email: user.email,
                    role: user.role,
                }),
            };
        }
        // Chống lạm dụng: email / phone / device đã dùng trial
        const abuse = await this.prisma.trialClaim.findFirst({
            where: {
                OR: [
                    { emailNormalized: emailNorm },
                    ...(phoneNorm ? [{ phoneNormalized: phoneNorm }] : []),
                    ...(deviceHash ? [{ deviceFingerprintHash: deviceHash }] : []),
                    { userId: user.id },
                ],
            },
        });
        if (abuse) {
            throw new common_1.ConflictException('Bạn đã sử dụng quyền dùng thử. Mỗi email/thiết bị chỉ được kích hoạt một lần.');
        }
        const trialPlan = await this.prisma.subscriptionPlan.upsert({
            where: { code: 'msp-trial-3d' },
            create: {
                code: 'msp-trial-3d',
                name: 'Dùng thử miễn phí 3 ngày',
                priceMonthly: 0,
                priceVnd: 0,
                durationMonths: 0,
                sortOrder: -1,
                creditsIncluded: settings.aiDailyQuota,
                features: ['Content cơ bản', 'Auto Post'],
                isActive: true,
            },
            update: { isActive: true },
        });
        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + settings.trialDays * 86400000);
        const result = await this.prisma.$transaction(async (tx) => {
            // Double-check trong transaction
            const raced = await tx.trialClaim.findFirst({
                where: {
                    OR: [
                        { organizationId: user.organizationId },
                        { emailNormalized: emailNorm },
                        { userId: user.id },
                        ...(deviceHash ? [{ deviceFingerprintHash: deviceHash }] : []),
                    ],
                },
            });
            if (raced) {
                throw new common_1.ConflictException('Bạn đã sử dụng quyền dùng thử. Mỗi email/thiết bị chỉ được kích hoạt một lần.');
            }
            const existingSub = await tx.subscription.findFirst({
                where: { organizationId: user.organizationId },
                orderBy: { createdAt: 'desc' },
            });
            let sub;
            if (existingSub) {
                sub = await tx.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                        planId: trialPlan.id,
                        status: database_1.SubscriptionStatus.TRIALING,
                        currentPeriodStart: startedAt,
                        currentPeriodEnd: endsAt,
                        trialStartedAt: startedAt,
                        trialEndsAt: endsAt,
                        cancelledAt: null,
                    },
                });
            }
            else {
                sub = await tx.subscription.create({
                    data: {
                        organizationId: user.organizationId,
                        planId: trialPlan.id,
                        status: database_1.SubscriptionStatus.TRIALING,
                        currentPeriodStart: startedAt,
                        currentPeriodEnd: endsAt,
                        trialStartedAt: startedAt,
                        trialEndsAt: endsAt,
                    },
                });
            }
            await tx.trialClaim.create({
                data: {
                    userId: user.id,
                    organizationId: user.organizationId,
                    subscriptionId: sub.id,
                    emailNormalized: emailNorm,
                    phoneNormalized: phoneNorm ?? undefined,
                    deviceFingerprintHash: deviceHash ?? undefined,
                    ipHash: ipHash ?? undefined,
                    activatedAt: startedAt,
                    trialEndsAt: endsAt,
                },
            });
            if (!dbUser.emailNormalized) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { emailNormalized: emailNorm },
                });
            }
            return sub;
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'TRIAL_ACTIVATED',
            entityType: 'SUBSCRIPTION',
            entityId: result.id,
            metadata: {
                trialDays: settings.trialDays,
                trialStartedAt: startedAt.toISOString(),
                trialEndsAt: endsAt.toISOString(),
                emailNormalized: emailNorm,
            },
            ipAddress: meta?.ip,
        });
        return {
            activated: true,
            idempotent: false,
            subscription: await this.getCurrentSubscription(user.organizationId, {
                email: user.email,
                role: user.role,
            }),
        };
    }
    async createOrder(organizationId, userId, planCode) {
        const plan = await this.prisma.subscriptionPlan.findFirst({
            where: { code: planCode, isActive: true },
        });
        if (!plan || ![1, 6, 12].includes(plan.durationMonths)) {
            throw new common_1.BadRequestException('Gói không hợp lệ');
        }
        // Hủy đơn PENDING cũ của org (tránh nhiều QR)
        await this.prisma.paymentOrder.updateMany({
            where: { organizationId, status: database_1.PaymentOrderStatus.PENDING },
            data: { status: database_1.PaymentOrderStatus.CANCELLED, cancelledAt: new Date() },
        });
        const code = await this.generateUniqueOrderCode();
        const amountVnd = Number(plan.priceVnd);
        const transferContent = code;
        const qrUrl = this.buildVietQrUrl({
            amount: amountVnd,
            addInfo: transferContent,
            accountName: this.accountName(),
        });
        const order = await this.prisma.paymentOrder.create({
            data: {
                code,
                organizationId,
                planId: plan.id,
                createdByUserId: userId,
                amountVnd,
                status: database_1.PaymentOrderStatus.PENDING,
                transferContent,
                bankCode: this.bankCode(),
                accountNumber: this.accountNumber(),
                accountName: this.accountName(),
                qrUrl,
                expiresAt: new Date(Date.now() + ORDER_TTL_MS),
            },
            include: { plan: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'PAYMENT_ORDER_CREATED',
            entityType: 'PAYMENT_ORDER',
            entityId: order.id,
            metadata: { code, planCode: plan.code, amountVnd },
        });
        return this.mapOrder(order);
    }
    async createCreditOrder(organizationId, userId, packageCode) {
        const pkg = await this.prisma.creditPackage.findFirst({
            where: { code: packageCode, status: 'ACTIVE' },
        });
        if (!pkg)
            throw new common_1.BadRequestException('Gói Credit không hợp lệ');
        await this.prisma.paymentOrder.updateMany({
            where: {
                organizationId,
                status: database_1.PaymentOrderStatus.PENDING,
                creditPackageId: { not: null },
            },
            data: { status: database_1.PaymentOrderStatus.CANCELLED, cancelledAt: new Date() },
        });
        const code = await this.generateUniqueOrderCode();
        const amountVnd = Number(pkg.priceVnd);
        const qrUrl = this.buildVietQrUrl({
            amount: amountVnd,
            addInfo: code,
            accountName: this.accountName(),
        });
        const order = await this.prisma.paymentOrder.create({
            data: {
                code,
                organizationId,
                creditPackageId: pkg.id,
                createdByUserId: userId,
                amountVnd,
                status: database_1.PaymentOrderStatus.PENDING,
                transferContent: code,
                bankCode: this.bankCode(),
                accountNumber: this.accountNumber(),
                accountName: this.accountName(),
                qrUrl,
                expiresAt: new Date(Date.now() + ORDER_TTL_MS),
            },
            include: { plan: true, creditPackage: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'CREDIT_ORDER_CREATED',
            entityType: 'PAYMENT_ORDER',
            entityId: order.id,
            metadata: {
                code,
                packageCode: pkg.code,
                amountVnd,
                credits: Number(pkg.credits),
            },
        });
        return this.mapOrder(order);
    }
    async getOrder(organizationId, orderIdOrCode) {
        await this.expireStaleOrders(organizationId);
        const order = await this.prisma.paymentOrder.findFirst({
            where: {
                organizationId,
                OR: [{ id: orderIdOrCode }, { code: orderIdOrCode }],
            },
            include: { plan: true, transactions: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn thanh toán');
        return this.mapOrder(order);
    }
    async listMyOrders(organizationId) {
        await this.expireStaleOrders(organizationId);
        const rows = await this.prisma.paymentOrder.findMany({
            where: { organizationId },
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return rows.map((r) => this.mapOrder(r));
    }
    async cancelOrder(organizationId, userId, orderId) {
        const order = await this.prisma.paymentOrder.findFirst({
            where: { id: orderId, organizationId },
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn');
        if (order.status !== database_1.PaymentOrderStatus.PENDING) {
            throw new common_1.BadRequestException('Chỉ hủy được đơn đang chờ thanh toán');
        }
        const updated = await this.prisma.paymentOrder.update({
            where: { id: order.id },
            data: { status: database_1.PaymentOrderStatus.CANCELLED, cancelledAt: new Date() },
            include: { plan: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'PAYMENT_ORDER_CANCELLED',
            entityType: 'PAYMENT_ORDER',
            entityId: order.id,
        });
        return this.mapOrder(updated);
    }
    /**
     * SePay webhook — chỉ xử lý tiền vào; idempotent theo sepayTransactionId.
     */
    async handleSepayWebhook(rawBody, headers, body) {
        const auth = await this.verifyWebhookAuth(rawBody, headers);
        if ((body.transferType || '').toLowerCase() !== 'in') {
            return { success: true, skipped: true, reason: 'not_incoming' };
        }
        const sepayId = String(body.id ?? '').trim();
        if (!sepayId)
            throw new common_1.BadRequestException('Thiếu transaction id');
        // Chặn ID giả từ smoke/ops test — không kích hoạt gói trên production
        const allowSynthetic = this.config.get('ALLOW_SYNTHETIC_SEPAY') === '1' ||
            this.config.get('NODE_ENV') === 'test';
        if (!allowSynthetic && /^(ops-|test-|smoke-)/i.test(sepayId)) {
            this.logger.warn(`Rejected synthetic SePay id=${sepayId}`);
            throw new common_1.BadRequestException('Giao dịch thử nghiệm không được kích hoạt gói');
        }
        const amount = Number(body.transferAmount ?? 0);
        const accountNumber = String(body.accountNumber ?? '').trim();
        const content = String(body.content || body.code || body.description || '');
        // Idempotency: nếu đã có transaction → trả success, không kích hoạt lại
        const existing = await this.prisma.paymentTransaction.findUnique({
            where: { sepayTransactionId: sepayId },
        });
        if (existing) {
            return {
                success: true,
                duplicated: true,
                transactionId: existing.id,
                sepayTransactionId: existing.sepayTransactionId,
                matched: existing.matched,
                activated: false,
            };
        }
        const orderCode = this.extractOrderCode(content);
        const expectedAccount = this.accountNumber();
        try {
            return await this.prisma
                .$transaction(async (tx) => {
                // Double-check inside txn for concurrent webhooks
                const raced = await tx.paymentTransaction.findUnique({
                    where: { sepayTransactionId: sepayId },
                });
                if (raced) {
                    return {
                        success: true,
                        duplicated: true,
                        transactionId: raced.id,
                        sepayTransactionId: raced.sepayTransactionId,
                        matched: raced.matched,
                        activated: false,
                    };
                }
                let matched = false;
                let matchedReason = '';
                const order = orderCode
                    ? await tx.paymentOrder.findUnique({
                        where: { code: orderCode },
                        include: { plan: true, creditPackage: true, organization: true },
                    })
                    : null;
                if (!order) {
                    matchedReason = orderCode ? 'ORDER_NOT_FOUND' : 'CONTENT_INVALID';
                }
                else if (accountNumber && accountNumber !== expectedAccount) {
                    matchedReason = 'ACCOUNT_MISMATCH';
                    if (order.status === database_1.PaymentOrderStatus.PENDING) {
                        await tx.paymentOrder.update({
                            where: { id: order.id },
                            data: {
                                status: database_1.PaymentOrderStatus.REVIEW_REQUIRED,
                                reviewNote: `ACCOUNT_MISMATCH: nhận STK ${accountNumber}, cần ${expectedAccount}`,
                            },
                        });
                    }
                }
                else if (order.transferContent.toUpperCase() !== orderCode &&
                    order.code.toUpperCase() !== orderCode) {
                    matchedReason = 'CONTENT_MISMATCH';
                    if (order.status === database_1.PaymentOrderStatus.PENDING) {
                        await tx.paymentOrder.update({
                            where: { id: order.id },
                            data: {
                                status: database_1.PaymentOrderStatus.REVIEW_REQUIRED,
                                reviewNote: `CONTENT_MISMATCH: ${content}`,
                            },
                        });
                    }
                }
                else if (order.status === database_1.PaymentOrderStatus.PAID) {
                    matchedReason = 'ORDER_ALREADY_PAID';
                }
                else if (order.status === database_1.PaymentOrderStatus.CANCELLED) {
                    matchedReason = 'ORDER_CANCELLED';
                }
                else if (order.status === database_1.PaymentOrderStatus.EXPIRED ||
                    order.expiresAt.getTime() < Date.now()) {
                    matchedReason = 'ORDER_EXPIRED';
                    if (order.status === database_1.PaymentOrderStatus.PENDING) {
                        await tx.paymentOrder.update({
                            where: { id: order.id },
                            data: { status: database_1.PaymentOrderStatus.EXPIRED },
                        });
                    }
                }
                else if (Number(order.amountVnd) !== amount) {
                    matchedReason = amount < Number(order.amountVnd) ? 'AMOUNT_UNDER' : 'AMOUNT_OVER';
                    await tx.paymentOrder.update({
                        where: { id: order.id },
                        data: {
                            status: database_1.PaymentOrderStatus.REVIEW_REQUIRED,
                            reviewNote: `${matchedReason}: nhận ${amount}, cần ${Number(order.amountVnd)}`,
                        },
                    });
                }
                else if (order.status === database_1.PaymentOrderStatus.REVIEW_REQUIRED) {
                    matchedReason = 'ORDER_STATUS_REVIEW_REQUIRED';
                }
                else if (order.status !== database_1.PaymentOrderStatus.PENDING) {
                    matchedReason = `ORDER_STATUS_${order.status}`;
                }
                else {
                    matched = true;
                    matchedReason = 'OK';
                }
                // Chỉ gắn paymentOrderId khi đã xác định được đơn (kể cả review)
                const linkedOrderId = matchedReason === 'ORDER_NOT_FOUND' || matchedReason === 'CONTENT_INVALID'
                    ? undefined
                    : order?.id;
                const linkedOrgId = matchedReason === 'ORDER_NOT_FOUND' || matchedReason === 'CONTENT_INVALID'
                    ? undefined
                    : order?.organizationId;
                let txn;
                try {
                    txn = await tx.paymentTransaction.create({
                        data: {
                            sepayTransactionId: sepayId,
                            paymentOrderId: linkedOrderId,
                            organizationId: linkedOrgId,
                            amountVnd: amount,
                            accountNumber: accountNumber || null,
                            gateway: body.gateway || null,
                            content,
                            transferType: 'in',
                            referenceCode: body.referenceCode || null,
                            rawPayload: (0, token_security_util_1.redactForAudit)(body),
                            authMethod: auth.method,
                            authVerified: true,
                            matched,
                            matchedReason,
                            processingError: matched ? null : matchedReason,
                            processedAt: matched ? new Date() : null,
                        },
                    });
                }
                catch (e) {
                    if (e instanceof database_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                        const existingTxn = await tx.paymentTransaction.findUnique({
                            where: { sepayTransactionId: sepayId },
                        });
                        return {
                            success: true,
                            duplicated: true,
                            transactionId: existingTxn?.id,
                            sepayTransactionId: existingTxn?.sepayTransactionId,
                            matched: existingTxn?.matched ?? false,
                            activated: false,
                        };
                    }
                    throw e;
                }
                if (!matched || !order) {
                    return {
                        success: true,
                        matched: false,
                        reason: matchedReason,
                        transactionId: txn.id,
                        sepayTransactionId: sepayId,
                        authMethod: auth.method,
                        authVerified: true,
                        activated: false,
                    };
                }
                // Activate subscription
                const now = new Date();
                const paid = await tx.paymentOrder.updateMany({
                    where: { id: order.id, status: database_1.PaymentOrderStatus.PENDING },
                    data: { status: database_1.PaymentOrderStatus.PAID, paidAt: now },
                });
                if (paid.count === 0) {
                    await tx.paymentTransaction.update({
                        where: { id: txn.id },
                        data: {
                            matched: false,
                            matchedReason: 'ORDER_ALREADY_PAID',
                            processingError: 'ORDER_ALREADY_PAID',
                            processedAt: null,
                        },
                    });
                    return {
                        success: true,
                        matched: false,
                        reason: 'ORDER_ALREADY_PAID',
                        transactionId: txn.id,
                        sepayTransactionId: sepayId,
                        activated: false,
                    };
                }
                const fulfilled = await this.fulfillPaidOrderTx(tx, order, now);
                return {
                    success: true,
                    matched: true,
                    orderCode: order.code,
                    transactionId: txn.id,
                    sepayTransactionId: sepayId,
                    authMethod: auth.method,
                    authVerified: true,
                    activated: fulfilled.kind === 'subscription',
                    credited: fulfilled.creditsGranted > 0,
                    kind: fulfilled.kind,
                    periodEnd: fulfilled.periodEnd,
                    creditsGranted: fulfilled.creditsGranted,
                    creditsIdempotent: fulfilled.creditsIdempotent,
                    _notify: {
                        kind: fulfilled.kind,
                        orderId: order.id,
                        organizationId: order.organizationId,
                        createdByUserId: order.createdByUserId,
                        code: order.code,
                        planName: fulfilled.label,
                        amount,
                        sepayId,
                        periodEnd: fulfilled.periodEnd,
                        creditsGranted: fulfilled.creditsGranted,
                    },
                };
            })
                .then(async (result) => {
                const notify = result._notify;
                if (notify) {
                    await this.audit.log({
                        organizationId: notify.organizationId,
                        userId: notify.createdByUserId ?? undefined,
                        action: 'PAYMENT_ORDER_PAID',
                        entityType: 'PAYMENT_ORDER',
                        entityId: notify.orderId,
                        metadata: {
                            kind: notify.kind ?? 'subscription',
                            code: notify.code,
                            amount: notify.amount,
                            sepayId: notify.sepayId,
                            periodEnd: notify.periodEnd?.toISOString() ?? null,
                            creditsGranted: notify.creditsGranted,
                        },
                    });
                    if (notify.kind !== 'credit' && notify.periodEnd) {
                        const emailTarget = await this.prisma.user.findFirst({
                            where: { organizationId: notify.organizationId, isActive: true },
                            orderBy: { createdAt: 'asc' },
                        });
                        if (emailTarget) {
                            void this.mail.sendPaymentSuccess({
                                email: emailTarget.email,
                                name: emailTarget.name,
                                orderCode: notify.code,
                                planName: notify.planName,
                                amountVnd: notify.amount,
                                periodEnd: notify.periodEnd,
                            });
                        }
                        // Affiliate commission — idempotent theo orderId; không đụng activation
                        void this.affiliate
                            .onOrderPaid({
                            orderId: notify.orderId,
                            organizationId: notify.organizationId,
                            createdByUserId: notify.createdByUserId,
                            code: notify.code,
                            amount: notify.amount,
                            sepayId: notify.sepayId,
                        })
                            .catch((err) => this.logger.warn(`Affiliate commission skipped: ${String(err)}`));
                    }
                    const { _notify: _, ...clean } = result;
                    void _;
                    return clean;
                }
                return result;
            });
        }
        catch (e) {
            if (e instanceof database_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                const existingTxn = await this.prisma.paymentTransaction.findUnique({
                    where: { sepayTransactionId: sepayId },
                });
                return {
                    success: true,
                    duplicated: true,
                    transactionId: existingTxn?.id,
                    sepayTransactionId: existingTxn?.sepayTransactionId,
                    matched: existingTxn?.matched ?? false,
                    activated: false,
                };
            }
            throw e;
        }
    }
    async adminListOrders(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {};
        if (query.status)
            where.status = query.status;
        if (query.code)
            where.code = { contains: query.code.trim().toUpperCase() };
        if (query.transferContent) {
            where.transferContent = { contains: query.transferContent.trim().toUpperCase() };
        }
        if (query.organizationId)
            where.organizationId = query.organizationId;
        if (query.from || query.to) {
            where.createdAt = {};
            if (query.from)
                where.createdAt.gte = new Date(query.from);
            if (query.to)
                where.createdAt.lte = new Date(query.to);
        }
        if (query.email) {
            where.organization = {
                users: {
                    some: { email: { contains: query.email.trim().toLowerCase(), mode: 'insensitive' } },
                },
            };
        }
        const [total, items] = await Promise.all([
            this.prisma.paymentOrder.count({ where }),
            this.prisma.paymentOrder.findMany({
                where,
                include: {
                    plan: true,
                    organization: { select: { id: true, name: true, slug: true, email: true } },
                    transactions: { orderBy: { createdAt: 'desc' }, take: 3 },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            items: items.map((i) => ({
                ...this.mapOrder({
                    ...i,
                    transactions: i.transactions.map((t) => this.mapTxn(t)),
                }),
                organization: i.organization,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        };
    }
    async adminListTransactions(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {};
        if (query.matched === 'true')
            where.matched = true;
        if (query.matched === 'false')
            where.matched = false;
        if (query.orderCode?.trim()) {
            where.paymentOrder = { code: { contains: query.orderCode.trim().toUpperCase() } };
        }
        if (query.q?.trim()) {
            const q = query.q.trim();
            where.OR = [
                { sepayTransactionId: { contains: q } },
                { content: { contains: q, mode: 'insensitive' } },
                { matchedReason: { contains: q, mode: 'insensitive' } },
                { processingError: { contains: q, mode: 'insensitive' } },
                { paymentOrder: { code: { contains: q.toUpperCase() } } },
            ];
        }
        const [total, items] = await Promise.all([
            this.prisma.paymentTransaction.count({ where }),
            this.prisma.paymentTransaction.findMany({
                where,
                include: {
                    paymentOrder: {
                        select: {
                            id: true,
                            code: true,
                            status: true,
                            organizationId: true,
                            amountVnd: true,
                            plan: { select: { code: true, name: true, durationMonths: true } },
                            organization: { select: { id: true, name: true, email: true, slug: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            items: items.map((t) => this.mapTxn(t)),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        };
    }
    /**
     * Đối soát / xử lý lại giao dịch SePay có kiểm soát.
     * - Không kích hoạt lần hai nếu txn đã matched/processed hoặc đơn đã PAID.
     * - force=true: admin xác nhận thủ công (bỏ qua lệch amount/account) nhưng vẫn chặn double-activate.
     */
    async adminReprocessTransaction(actor, transactionId, dto, ipAddress) {
        const txn = await this.prisma.paymentTransaction.findUnique({
            where: { id: transactionId },
            include: {
                paymentOrder: { include: { plan: true, creditPackage: true, organization: true } },
            },
        });
        if (!txn)
            throw new common_1.NotFoundException('Không tìm thấy giao dịch');
        if (txn.matched && txn.processedAt) {
            throw new common_1.BadRequestException('Giao dịch đã kích hoạt gói — webhook/reprocess trùng bị chặn (idempotent)');
        }
        const order = txn.paymentOrder;
        if (!order) {
            throw new common_1.BadRequestException('Giao dịch chưa gắn đơn MKTA — không thể xử lý lại');
        }
        if (order.status === database_1.PaymentOrderStatus.PAID) {
            throw new common_1.BadRequestException('Đơn đã PAID — không cộng ngày / kích hoạt lần hai');
        }
        if (order.status === database_1.PaymentOrderStatus.CANCELLED) {
            throw new common_1.BadRequestException('Đơn đã hủy — không thể kích hoạt');
        }
        const amount = Number(txn.amountVnd);
        const expectedAccount = this.accountNumber();
        const force = !!dto.force;
        let canActivate = false;
        let blockReason = '';
        if (!force) {
            if (txn.accountNumber && txn.accountNumber !== expectedAccount) {
                blockReason = 'ACCOUNT_MISMATCH';
            }
            else if (amount !== Number(order.amountVnd)) {
                blockReason = amount < Number(order.amountVnd) ? 'AMOUNT_UNDER' : 'AMOUNT_OVER';
            }
            else if (order.status !== database_1.PaymentOrderStatus.PENDING &&
                order.status !== database_1.PaymentOrderStatus.REVIEW_REQUIRED &&
                order.status !== database_1.PaymentOrderStatus.EXPIRED) {
                blockReason = `ORDER_STATUS_${order.status}`;
            }
            else {
                canActivate = true;
            }
        }
        else {
            canActivate = true;
        }
        const before = {
            orderStatus: order.status,
            orderPaidAt: order.paidAt,
            txnMatched: txn.matched,
            txnProcessedAt: txn.processedAt,
            matchedReason: txn.matchedReason,
            subscriptionEnd: null,
        };
        const subBefore = await this.prisma.subscription.findFirst({
            where: { organizationId: order.organizationId },
            orderBy: { currentPeriodEnd: 'desc' },
        });
        before.subscriptionEnd = subBefore?.currentPeriodEnd?.toISOString() ?? null;
        if (!canActivate) {
            const updated = await this.prisma.$transaction(async (tx) => {
                const t = await tx.paymentTransaction.update({
                    where: { id: txn.id },
                    data: {
                        matched: false,
                        matchedReason: blockReason,
                        processingError: blockReason,
                    },
                    include: {
                        paymentOrder: {
                            select: {
                                id: true,
                                code: true,
                                status: true,
                                organizationId: true,
                                amountVnd: true,
                                plan: { select: { code: true, name: true, durationMonths: true } },
                                organization: { select: { id: true, name: true, email: true, slug: true } },
                            },
                        },
                    },
                });
                await this.audit.log({
                    organizationId: order.organizationId,
                    userId: actor.id,
                    action: 'PAYMENT_TXN_REPROCESS_BLOCKED',
                    entityType: 'PAYMENT_TRANSACTION',
                    entityId: txn.id,
                    ipAddress,
                    metadata: {
                        reason: dto.reason,
                        force,
                        result: 'blocked',
                        before,
                        after: { matchedReason: blockReason },
                        sepayTransactionId: txn.sepayTransactionId,
                        orderCode: order.code,
                    },
                }, tx);
                return t;
            });
            return {
                result: 'blocked',
                reason: blockReason,
                before,
                after: { matchedReason: blockReason },
                transaction: this.mapTxn(updated),
            };
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const paid = await tx.paymentOrder.updateMany({
                where: {
                    id: order.id,
                    status: {
                        in: [
                            database_1.PaymentOrderStatus.PENDING,
                            database_1.PaymentOrderStatus.REVIEW_REQUIRED,
                            database_1.PaymentOrderStatus.EXPIRED,
                        ],
                    },
                },
                data: {
                    status: database_1.PaymentOrderStatus.PAID,
                    paidAt: new Date(),
                    reviewNote: force
                        ? `ADMIN_FORCE_REPROCESS: ${dto.reason}`
                        : order.reviewNote,
                },
            });
            if (paid.count === 0) {
                throw new common_1.BadRequestException('Không cập nhật được đơn — có thể đã PAID (chống double-activate)');
            }
            const fulfilled = await this.fulfillPaidOrderTx(tx, order, new Date());
            const t = await tx.paymentTransaction.update({
                where: { id: txn.id },
                data: {
                    matched: true,
                    matchedReason: force ? 'ADMIN_FORCE_OK' : 'ADMIN_REPROCESS_OK',
                    processingError: null,
                    processedAt: new Date(),
                    paymentOrderId: order.id,
                    organizationId: order.organizationId,
                },
                include: {
                    paymentOrder: {
                        select: {
                            id: true,
                            code: true,
                            status: true,
                            organizationId: true,
                            amountVnd: true,
                            plan: { select: { code: true, name: true, durationMonths: true } },
                            creditPackage: { select: { code: true, name: true, credits: true } },
                            organization: { select: { id: true, name: true, email: true, slug: true } },
                        },
                    },
                },
            });
            const after = {
                orderStatus: database_1.PaymentOrderStatus.PAID,
                orderPaidAt: new Date().toISOString(),
                txnMatched: true,
                txnProcessedAt: new Date().toISOString(),
                matchedReason: force ? 'ADMIN_FORCE_OK' : 'ADMIN_REPROCESS_OK',
                subscriptionEnd: fulfilled.periodEnd?.toISOString() ?? null,
                kind: fulfilled.kind,
                creditsGranted: fulfilled.creditsGranted,
            };
            await this.audit.log({
                organizationId: order.organizationId,
                userId: actor.id,
                action: force ? 'PAYMENT_TXN_FORCE_ACTIVATE' : 'PAYMENT_TXN_REPROCESS',
                entityType: 'PAYMENT_TRANSACTION',
                entityId: txn.id,
                ipAddress,
                metadata: {
                    reason: dto.reason,
                    force,
                    result: 'activated',
                    before,
                    after,
                    sepayTransactionId: txn.sepayTransactionId,
                    orderCode: order.code,
                    planCode: order.plan?.code ?? null,
                    packageCode: order.creditPackage?.code ?? null,
                    amountVnd: amount,
                },
            }, tx);
            return { transaction: t, before, after, periodEnd: fulfilled.periodEnd };
        });
        // Admin reprocess / force — không tạo hoa hồng affiliate
        void this.affiliate
            .onOrderPaid({
            orderId: order.id,
            organizationId: order.organizationId,
            createdByUserId: actor.id,
            code: order.code,
            amount,
            sepayId: txn.sepayTransactionId,
            skipCommission: true,
        })
            .catch(() => undefined);
        return {
            result: 'activated',
            before: result.before,
            after: result.after,
            periodEnd: result.periodEnd,
            transaction: this.mapTxn(result.transaction),
        };
    }
    async adminListSubscriptions(opts) {
        const where = opts.organizationId
            ? { organizationId: opts.organizationId }
            : {};
        const [total, items] = await Promise.all([
            this.prisma.subscription.count({ where }),
            this.prisma.subscription.findMany({
                where,
                include: {
                    plan: true,
                    organization: { select: { id: true, name: true, slug: true, email: true } },
                },
                orderBy: { currentPeriodEnd: 'desc' },
                skip: (opts.page - 1) * opts.pageSize,
                take: opts.pageSize,
            }),
        ]);
        return {
            items: items.map((s) => ({
                ...this.mapSubscription(s),
                organization: s.organization,
                isExpired: s.currentPeriodEnd.getTime() <= Date.now(),
            })),
            total,
            page: opts.page,
            pageSize: opts.pageSize,
            totalPages: Math.ceil(total / opts.pageSize) || 1,
        };
    }
    async adminMarkNeedsReview(adminUserId, organizationId, orderId, note, ipAddress) {
        const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn');
        if (order.status === database_1.PaymentOrderStatus.PAID) {
            throw new common_1.BadRequestException('Không thể sửa đơn đã thanh toán thành công');
        }
        const before = { status: order.status, reviewNote: order.reviewNote };
        const updated = await this.prisma.$transaction(async (tx) => {
            const u = await tx.paymentOrder.update({
                where: { id: orderId },
                data: { status: database_1.PaymentOrderStatus.REVIEW_REQUIRED, reviewNote: note },
                include: { plan: true },
            });
            await this.audit.log({
                organizationId: order.organizationId,
                userId: adminUserId,
                action: 'PAYMENT_ORDER_MANUAL_REVIEW',
                entityType: 'PAYMENT_ORDER',
                entityId: orderId,
                ipAddress,
                metadata: {
                    reason: note,
                    result: 'review_required',
                    before,
                    after: { status: u.status, reviewNote: u.reviewNote },
                },
            }, tx);
            return u;
        });
        void organizationId;
        return this.mapOrder(updated);
    }
    // --- helpers ---
    async verifyWebhookAuth(rawBody, headers) {
        const secret = (this.config.get('SEPAY_WEBHOOK_SECRET') || '').trim();
        const apiToken = (this.config.get('SEPAY_API_TOKEN') || '').trim();
        if (!secret && !apiToken) {
            this.logger.warn('SEPAY secrets empty — rejecting webhook');
            throw new common_1.UnauthorizedException('Webhook chưa được cấu hình');
        }
        const authHeader = String(headers['authorization'] || headers['Authorization'] || '');
        const hasAuthHeader = authHeader.length > 0;
        const hasHmacHeader = !!(headers['x-sepay-signature'] ||
            headers['X-SePay-Signature']);
        if (apiToken) {
            if (stringsEqual(authHeader, `Apikey ${apiToken}`) ||
                stringsEqual(authHeader, `Bearer ${apiToken}`)) {
                return { method: 'API_KEY' };
            }
        }
        if (secret && stringsEqual(authHeader, `Apikey ${secret}`)) {
            return { method: 'API_KEY' };
        }
        if (secret) {
            const sigHeader = String(headers['x-sepay-signature'] || headers['X-SePay-Signature'] || '');
            const ts = String(headers['x-sepay-timestamp'] || headers['X-SePay-Timestamp'] || '');
            if (sigHeader.startsWith('sha256=') && ts) {
                const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
                const expected = `sha256=${(0, crypto_1.createHmac)('sha256', secret)
                    .update(`${ts}.${bodyStr}`)
                    .digest('hex')}`;
                if (stringsEqual(sigHeader, expected))
                    return { method: 'HMAC' };
            }
        }
        // Audit thất bại auth — không ghi secret/token
        try {
            await this.audit.log({
                action: 'SEPAY_WEBHOOK_AUTH_FAILED',
                entityType: 'PAYMENT_WEBHOOK',
                metadata: {
                    result: 'auth_failed',
                    hasAuthHeader,
                    hasHmacHeader,
                    reason: 'invalid_signature_or_api_key',
                },
            });
        }
        catch (e) {
            this.logger.warn(`Failed to audit webhook auth failure: ${String(e)}`);
        }
        throw new common_1.UnauthorizedException('Webhook auth thất bại');
    }
    mapTxn(t) {
        return {
            id: t.id,
            transactionId: t.id,
            sepayTransactionId: t.sepayTransactionId,
            paymentOrderId: t.paymentOrderId,
            organizationId: t.organizationId,
            amountVnd: Number(t.amountVnd),
            accountNumber: t.accountNumber,
            gateway: t.gateway,
            content: t.content,
            transferType: t.transferType,
            referenceCode: t.referenceCode,
            authMethod: t.authMethod ?? null,
            authVerified: t.authVerified ?? false,
            hmacVerified: t.authMethod === 'HMAC' && !!t.authVerified,
            matched: t.matched,
            matchedReason: t.matchedReason,
            processingError: t.processingError ?? t.matchedReason,
            processedAt: t.processedAt,
            createdAt: t.createdAt,
            paymentOrder: t.paymentOrder
                ? {
                    id: t.paymentOrder.id,
                    code: t.paymentOrder.code,
                    status: t.paymentOrder.status,
                    organizationId: t.paymentOrder.organizationId,
                    amountVnd: t.paymentOrder.amountVnd != null ? Number(t.paymentOrder.amountVnd) : undefined,
                    plan: t.paymentOrder.plan ?? undefined,
                    organization: t.paymentOrder.organization ?? undefined,
                }
                : null,
            // rawPayload intentionally omitted — không lộ payload đầy đủ ra frontend
        };
    }
    extractOrderCode(content) {
        const prefix = this.codePrefix();
        // MKTA123456 — tiền tố + ít nhất 6 chữ số/ký tự
        const re = new RegExp(`\\b(${prefix}[0-9]{6,12})\\b`, 'i');
        const m = content.toUpperCase().match(re);
        return m?.[1]?.toUpperCase() ?? null;
    }
    async generateUniqueOrderCode() {
        const prefix = this.codePrefix();
        for (let i = 0; i < 16; i++) {
            const n = 100000 + ((0, crypto_1.randomBytes)(3).readUIntBE(0, 3) % 900000);
            const code = `${prefix}${n}`;
            const exists = await this.prisma.paymentOrder.findUnique({ where: { code } });
            if (!exists)
                return code;
        }
        throw new common_1.BadRequestException('Không tạo được mã đơn — thử lại');
    }
    buildVietQrUrl(params) {
        const acc = this.accountNumber();
        const q = new URLSearchParams({
            amount: String(params.amount),
            addInfo: params.addInfo,
            accountName: params.accountName,
        });
        return `https://img.vietqr.io/image/${ACB_BIN}-${acc}-compact2.png?${q.toString()}`;
    }
    async expireStaleOrders(organizationId) {
        await this.prisma.paymentOrder.updateMany({
            where: {
                status: database_1.PaymentOrderStatus.PENDING,
                expiresAt: { lt: new Date() },
                ...(organizationId ? { organizationId } : {}),
            },
            data: { status: database_1.PaymentOrderStatus.EXPIRED },
        });
    }
    async fulfillPaidOrderTx(tx, order, paidAt) {
        if (order.creditPackageId) {
            const pkg = order.creditPackage;
            if (!pkg)
                throw new common_1.BadRequestException('Gói Credit không hợp lệ');
            const purchase = await this.grantPurchasedCreditsTx(tx, {
                organizationId: order.organizationId,
                orderId: order.id,
                userId: order.createdByUserId,
                pkg,
            });
            return {
                kind: 'credit',
                periodEnd: null,
                creditsGranted: purchase.granted,
                creditsIdempotent: purchase.idempotent,
                label: pkg.name,
            };
        }
        if (!order.planId || !order.plan) {
            throw new common_1.BadRequestException('Đơn thiếu gói đăng ký');
        }
        const existingSub = await tx.subscription.findFirst({
            where: {
                organizationId: order.organizationId,
                status: {
                    in: [
                        database_1.SubscriptionStatus.ACTIVE,
                        database_1.SubscriptionStatus.TRIALING,
                        database_1.SubscriptionStatus.TRIAL_EXPIRED,
                        database_1.SubscriptionStatus.EXPIRED,
                    ],
                },
            },
            orderBy: { currentPeriodEnd: 'desc' },
        });
        const fromTrial = existingSub?.status === database_1.SubscriptionStatus.TRIALING ||
            existingSub?.status === database_1.SubscriptionStatus.TRIAL_EXPIRED;
        const grantSource = existingSub && !fromTrial
            ? shared_1.CREDIT_GRANT_SOURCES.RENEWAL
            : shared_1.CREDIT_GRANT_SOURCES.PURCHASE;
        const period = await this.extendSubscriptionTx(tx, order.organizationId, order.planId, order.plan.durationMonths, paidAt);
        const creditGrant = await this.grantPlanCreditsTx(tx, {
            organizationId: order.organizationId,
            orderId: order.id,
            userId: order.createdByUserId,
            subscriptionId: period.id,
            source: grantSource,
            plan: order.plan,
        });
        return {
            kind: 'subscription',
            periodEnd: period.currentPeriodEnd,
            creditsGranted: creditGrant.granted,
            creditsIdempotent: creditGrant.idempotent,
            label: order.plan.name,
        };
    }
    /**
     * Cộng AI Credit của Plan đúng 1 lần theo orderId.
     * Số lượng lấy từ `plan.creditGrant` (DB), cộng dồn — không reset số dư cũ.
     */
    trialCreditGrantKey(organizationId) {
        return `trial:${organizationId}:credit-grant`;
    }
    paymentCreditGrantKey(orderId) {
        return `payment:${orderId}:credit-grant`;
    }
    paymentCreditPurchaseKey(orderId) {
        return `payment:${orderId}:credit-purchase`;
    }
    async grantPurchasedCreditsTx(tx, params) {
        const amount = Number(params.pkg.credits);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { granted: 0, idempotent: false, skipped: true };
        }
        const result = await this.credit.purchase({
            organizationId: params.organizationId,
            amount,
            userId: params.userId ?? undefined,
            source: shared_1.CREDIT_GRANT_SOURCES.PURCHASE,
            paymentId: params.orderId,
            idempotencyKey: this.paymentCreditPurchaseKey(params.orderId),
            referenceId: params.orderId,
            reason: `Mua gói ${params.pkg.name}`,
            metadata: {
                source: shared_1.CREDIT_GRANT_SOURCES.PURCHASE,
                packageCode: params.pkg.code,
                orderId: params.orderId,
                delta: amount,
            },
        }, tx);
        return { granted: amount, idempotent: result.idempotent, skipped: false };
    }
    async grantPlanCreditsTx(tx, params) {
        const amount = Number(params.plan.creditGrant ?? 0);
        // New catalogue grants monthly through CreditLedger, not once per payment.
        if ((0, shared_1.planDefinition)(params.plan.code))
            return { granted: 0, idempotent: false, skipped: true };
        if (!Number.isFinite(amount) || amount <= 0) {
            return { granted: 0, idempotent: false, skipped: true };
        }
        const result = await this.credit.grant({
            organizationId: params.organizationId,
            amount,
            userId: params.userId ?? undefined,
            source: params.source,
            subscriptionId: params.subscriptionId,
            paymentId: params.orderId,
            idempotencyKey: this.paymentCreditGrantKey(params.orderId),
            referenceId: params.orderId,
            reason: `Thanh toán gói ${params.plan.name}`,
            metadata: {
                source: params.source,
                planCode: params.plan.code,
                orderId: params.orderId,
            },
        }, tx);
        return { granted: amount, idempotent: result.idempotent, skipped: false };
    }
    async extendSubscriptionTx(tx, organizationId, planId, durationMonths, paidAt) {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`subscription:${organizationId}`}))`;
        const existing = await tx.subscription.findFirst({
            where: {
                organizationId,
                status: {
                    in: [
                        database_1.SubscriptionStatus.ACTIVE,
                        database_1.SubscriptionStatus.TRIALING,
                        database_1.SubscriptionStatus.TRIAL_EXPIRED,
                        database_1.SubscriptionStatus.EXPIRED,
                    ],
                },
            },
            orderBy: { currentPeriodEnd: 'desc' },
        });
        // Trial không cộng dồn vào gói trả phí — luôn tính từ paidAt khi nâng cấp từ trial
        const fromTrial = !!existing &&
            (existing.status === database_1.SubscriptionStatus.TRIALING ||
                existing.status === database_1.SubscriptionStatus.TRIAL_EXPIRED);
        const base = !fromTrial &&
            existing &&
            existing.status === database_1.SubscriptionStatus.ACTIVE &&
            existing.currentPeriodEnd.getTime() > paidAt.getTime()
            ? existing.currentPeriodEnd
            : paidAt;
        const newPlan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
        const end = (0, shared_1.billingAnniversary)(base, durationMonths + (0, shared_1.planBonusMonths)(newPlan.code));
        // Changing tiers starts after the already purchased term. No loss of time or rights.
        if (existing && !fromTrial && existing.currentPeriodEnd > paidAt) {
            const oldPlan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: existing.planId } });
            const oldTier = (0, shared_1.planDefinition)(oldPlan.code)?.tier ?? oldPlan.code;
            const newTier = (0, shared_1.planDefinition)(newPlan.code)?.tier ?? newPlan.code;
            if (oldTier !== newTier)
                return tx.subscription.create({ data: {
                        organizationId, planId, status: database_1.SubscriptionStatus.ACTIVE,
                        currentPeriodStart: base, currentPeriodEnd: end,
                    } });
        }
        if (existing) {
            return tx.subscription.update({
                where: { id: existing.id },
                data: {
                    planId,
                    status: database_1.SubscriptionStatus.ACTIVE,
                    currentPeriodStart: fromTrial || existing.currentPeriodEnd.getTime() <= paidAt.getTime()
                        ? paidAt
                        : existing.currentPeriodStart,
                    currentPeriodEnd: end,
                    cancelledAt: null,
                    // Giữ lịch sử trial; entitlement ACTIVE không phụ thuộc trialEndsAt
                },
            });
        }
        return tx.subscription.create({
            data: {
                organizationId,
                planId,
                status: database_1.SubscriptionStatus.ACTIVE,
                currentPeriodStart: paidAt,
                currentPeriodEnd: end,
            },
        });
    }
    mapOrder(order) {
        return {
            id: order.id,
            code: order.code,
            organizationId: order.organizationId,
            planId: order.planId,
            creditPackageId: order.creditPackageId ?? null,
            kind: order.creditPackageId ? 'credit' : 'subscription',
            amountVnd: Number(order.amountVnd),
            status: order.status,
            statusLabel: STATUS_LABELS[order.status] ?? order.status,
            transferContent: order.transferContent,
            bankCode: order.bankCode,
            accountNumber: order.accountNumber,
            accountName: order.accountName,
            qrUrl: order.qrUrl,
            expiresAt: order.expiresAt,
            paidAt: order.paidAt,
            cancelledAt: order.cancelledAt,
            reviewNote: order.reviewNote ?? null,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            plan: order.plan
                ? {
                    code: order.plan.code,
                    name: order.plan.name,
                    durationMonths: order.plan.durationMonths,
                    bonusMonths: (0, shared_1.planBonusMonths)(order.plan.code),
                    totalUsageMonths: order.plan.durationMonths + (0, shared_1.planBonusMonths)(order.plan.code),
                    priceVnd: Number(order.plan.priceVnd),
                }
                : undefined,
            creditPackage: order.creditPackage
                ? {
                    code: order.creditPackage.code,
                    name: order.creditPackage.name,
                    credits: Number(order.creditPackage.credits),
                    priceVnd: order.creditPackage.priceVnd != null
                        ? Number(order.creditPackage.priceVnd)
                        : undefined,
                }
                : undefined,
            transactions: order.transactions,
        };
    }
    mapSubscription(sub) {
        return {
            id: sub.id,
            organizationId: sub.organizationId,
            planId: sub.planId,
            status: sub.status,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            plan: sub.plan,
        };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        billing_mail_service_1.BillingMailService,
        affiliate_service_1.AffiliateService,
        credit_service_1.CreditService])
], BillingService);
const STATUS_LABELS = {
    PENDING: 'Chờ thanh toán',
    PAID: 'Thành công',
    EXPIRED: 'Hết hạn',
    CANCELLED: 'Đã hủy',
    REVIEW_REQUIRED: 'Cần kiểm tra',
};
