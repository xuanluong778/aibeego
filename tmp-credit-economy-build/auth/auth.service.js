"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../redis/redis.constants");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const rate_limit_service_1 = require("../common/services/rate-limit.service");
const roles_1 = require("../common/constants/roles");
const slug_util_1 = require("../common/utils/slug.util");
const auth_mail_service_1 = require("./auth-mail.service");
const google_token_verifier_1 = require("./google-token.verifier");
const affiliate_service_1 = require("../affiliate/affiliate.service");
const email_normalize_util_1 = require("../common/utils/email-normalize.util");
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_GOOGLE_ATTEMPTS = 10;
const GOOGLE_WINDOW_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SEND_EMAIL_LIMIT = 5;
const OTP_SEND_IP_LIMIT = 15;
const OTP_VERIFY_IP_LIMIT = 30;
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function parseDurationSeconds(raw, fallbackSec) {
    const m = /^(\d+)([smhd])$/.exec(raw.trim());
    if (!m?.[1])
        return fallbackSec;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
        case 's':
            return n;
        case 'm':
            return n * 60;
        case 'h':
            return n * 3600;
        case 'd':
            return n * 86400;
        default:
            return fallbackSec;
    }
}
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwt;
    config;
    audit;
    rateLimit;
    mail;
    googleVerifier;
    affiliate;
    redis;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwt, config, audit, rateLimit, mail, googleVerifier, affiliate, redis) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
        this.rateLimit = rateLimit;
        this.mail = mail;
        this.googleVerifier = googleVerifier;
        this.affiliate = affiliate;
        this.redis = redis;
    }
    authUserKey(userId) {
        return `maaz:auth:u:${userId}`;
    }
    authMeKey(userId) {
        return `maaz:auth:me:${userId}`;
    }
    async invalidateAuthCache(userId) {
        if (!this.redis)
            return;
        try {
            await this.redis.del(this.authUserKey(userId), this.authMeKey(userId));
        }
        catch {
            /* fail-open */
        }
    }
    /** Chặn Gmail dot-trick / +alias: mỗi email chuẩn hóa chỉ 1 tài khoản */
    async assertEmailAvailable(rawEmail) {
        const email = rawEmail.toLowerCase().trim();
        const emailNormalized = (0, email_normalize_util_1.normalizeEmailForUniqueness)(email);
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [{ email }, { emailNormalized }],
            },
            select: { id: true, email: true },
        });
        if (existing) {
            throw new common_1.ConflictException('Email đã được sử dụng (kể cả biến thể Gmail có dấu chấm hoặc +alias).');
        }
        return { email, emailNormalized };
    }
    async register(dto, meta) {
        // Giữ endpoint cũ cho tương thích nội bộ/test — tạo user trực tiếp.
        // UI đăng ký dùng sendRegistrationOtp + verifyRegistrationOtp.
        const { email, emailNormalized } = await this.assertEmailAvailable(dto.email);
        const slug = dto.organizationSlug ?? (0, slug_util_1.slugify)(dto.organizationName);
        if (await this.prisma.organization.findUnique({ where: { slug } })) {
            throw new common_1.ConflictException('Slug organization đã tồn tại');
        }
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const result = await this.createRegisteredUser({
            email,
            emailNormalized,
            passwordHash,
            name: dto.name.trim(),
            organizationName: dto.organizationName.trim(),
            organizationSlug: slug,
        });
        const tokens = await this.issueTokens(result, meta);
        await this.audit.log({
            organizationId: result.organizationId,
            userId: result.id,
            action: 'AUTH_REGISTER',
            entityType: 'USER',
            entityId: result.id,
            ipAddress: meta?.ip,
        });
        return { ...tokens, user: await this.getCurrentUser(result.id) };
    }
    /** Bước 1: gửi OTP 6 số — chưa tạo User/Organization */
    async sendRegistrationOtp(dto, meta) {
        const { email } = await this.assertEmailAvailable(dto.email);
        this.rateLimit.assertWithinLimit(`reg-otp:email:${email}`, OTP_SEND_EMAIL_LIMIT, LOGIN_WINDOW_MS, 'Quá nhiều lần gửi OTP cho email này. Thử lại sau 15 phút.');
        if (meta?.ip) {
            this.rateLimit.assertWithinLimit(`reg-otp:ip:${meta.ip}`, OTP_SEND_IP_LIMIT, LOGIN_WINDOW_MS, 'Quá nhiều lần gửi OTP từ IP này. Thử lại sau.');
        }
        const slug = dto.organizationSlug ?? (0, slug_util_1.slugify)(dto.organizationName);
        if (await this.prisma.organization.findUnique({ where: { slug } })) {
            throw new common_1.ConflictException('Slug organization đã tồn tại');
        }
        const recent = await this.prisma.registrationOtp.findFirst({
            where: {
                email,
                consumedAt: null,
                invalidatedAt: null,
                createdAt: { gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (recent) {
            const waitSec = Math.ceil((recent.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000);
            throw new common_1.BadRequestException(`Vui lòng đợi ${waitSec}s trước khi gửi lại OTP`);
        }
        // Vô hiệu mã cũ còn hiệu lực
        await this.prisma.registrationOtp.updateMany({
            where: { email, consumedAt: null, invalidatedAt: null },
            data: { invalidatedAt: new Date() },
        });
        const otp = (0, crypto_1.randomInt)(0, 1_000_000).toString().padStart(6, '0');
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const row = await this.prisma.registrationOtp.create({
            data: {
                email,
                codeHash: hashToken(otp),
                passwordHash,
                name: dto.name.trim(),
                organizationName: dto.organizationName.trim(),
                organizationSlug: slug,
                referralCode: meta?.referralCode?.trim().toUpperCase() || null,
                expiresAt: new Date(Date.now() + OTP_TTL_MS),
                maxAttempts: OTP_MAX_ATTEMPTS,
                ipAddress: meta?.ip,
            },
        });
        await this.mail.sendRegistrationOtp(email, otp, dto.name.trim());
        return {
            registrationId: row.id,
            email,
            expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
            resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
            message: 'Đã gửi mã OTP tới email của bạn',
        };
    }
    /** Gửi lại OTP (cùng payload đăng ký, mã cũ bị vô hiệu) */
    async resendRegistrationOtp(registrationId, meta) {
        if (meta?.ip) {
            this.rateLimit.assertWithinLimit(`reg-otp:ip:${meta.ip}`, OTP_SEND_IP_LIMIT, LOGIN_WINDOW_MS, 'Quá nhiều lần gửi OTP từ IP này. Thử lại sau.');
        }
        const prev = await this.prisma.registrationOtp.findUnique({ where: { id: registrationId } });
        if (!prev || prev.consumedAt || prev.invalidatedAt) {
            throw new common_1.BadRequestException('Phiên đăng ký không hợp lệ. Vui lòng đăng ký lại.');
        }
        if (prev.expiresAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Mã OTP đã hết hạn. Vui lòng đăng ký lại.');
        }
        this.rateLimit.assertWithinLimit(`reg-otp:email:${prev.email}`, OTP_SEND_EMAIL_LIMIT, LOGIN_WINDOW_MS, 'Quá nhiều lần gửi OTP cho email này. Thử lại sau 15 phút.');
        if (Date.now() - prev.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
            const waitSec = Math.ceil((prev.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000);
            throw new common_1.BadRequestException(`Vui lòng đợi ${waitSec}s trước khi gửi lại OTP`);
        }
        if (await this.prisma.user.findUnique({ where: { email: prev.email } })) {
            throw new common_1.ConflictException('Email đã được sử dụng');
        }
        await this.prisma.registrationOtp.update({
            where: { id: prev.id },
            data: { invalidatedAt: new Date() },
        });
        const otp = (0, crypto_1.randomInt)(0, 1_000_000).toString().padStart(6, '0');
        const row = await this.prisma.registrationOtp.create({
            data: {
                email: prev.email,
                codeHash: hashToken(otp),
                passwordHash: prev.passwordHash,
                name: prev.name,
                organizationName: prev.organizationName,
                organizationSlug: prev.organizationSlug,
                // Giữ mã ref đã khóa lúc send-otp ban đầu
                referralCode: prev.referralCode,
                expiresAt: new Date(Date.now() + OTP_TTL_MS),
                maxAttempts: OTP_MAX_ATTEMPTS,
                ipAddress: meta?.ip ?? prev.ipAddress,
            },
        });
        await this.mail.sendRegistrationOtp(prev.email, otp, prev.name);
        return {
            registrationId: row.id,
            email: prev.email,
            expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
            resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
            message: 'Đã gửi lại mã OTP',
        };
    }
    /** Bước 2: xác minh OTP → tạo User + Organization + JWT */
    async verifyRegistrationOtp(registrationId, otp, meta) {
        if (meta?.ip) {
            this.rateLimit.assertWithinLimit(`reg-otp-verify:ip:${meta.ip}`, OTP_VERIFY_IP_LIMIT, LOGIN_WINDOW_MS, 'Quá nhiều lần xác minh OTP. Thử lại sau.');
        }
        const row = await this.prisma.registrationOtp.findUnique({ where: { id: registrationId } });
        if (!row || row.invalidatedAt) {
            throw new common_1.BadRequestException('Phiên đăng ký không hợp lệ. Vui lòng đăng ký lại.');
        }
        if (row.consumedAt) {
            throw new common_1.BadRequestException('Mã OTP đã được sử dụng');
        }
        if (row.expiresAt.getTime() <= Date.now()) {
            await this.prisma.registrationOtp.update({
                where: { id: row.id },
                data: { invalidatedAt: new Date() },
            });
            throw new common_1.BadRequestException('Mã OTP đã hết hạn. Vui lòng gửi lại mã.');
        }
        if (row.attemptCount >= row.maxAttempts) {
            await this.prisma.registrationOtp.update({
                where: { id: row.id },
                data: { invalidatedAt: new Date() },
            });
            throw new common_1.BadRequestException('Đã nhập sai quá số lần cho phép. Vui lòng đăng ký lại.');
        }
        const ok = hashToken(otp) === row.codeHash;
        if (!ok) {
            const updated = await this.prisma.registrationOtp.update({
                where: { id: row.id },
                data: {
                    attemptCount: { increment: 1 },
                    ...(row.attemptCount + 1 >= row.maxAttempts ? { invalidatedAt: new Date() } : {}),
                },
            });
            const left = Math.max(0, updated.maxAttempts - updated.attemptCount);
            throw new common_1.BadRequestException(left > 0
                ? `Mã OTP không đúng. Còn ${left} lần thử.`
                : 'Đã nhập sai quá số lần cho phép. Vui lòng đăng ký lại.');
        }
        let emailNormalized;
        try {
            ({ emailNormalized } = await this.assertEmailAvailable(row.email));
        }
        catch (e) {
            await this.prisma.registrationOtp.update({
                where: { id: row.id },
                data: { invalidatedAt: new Date() },
            });
            throw e;
        }
        const slug = row.organizationSlug || (0, slug_util_1.slugify)(row.organizationName);
        if (await this.prisma.organization.findUnique({ where: { slug } })) {
            throw new common_1.ConflictException('Slug organization đã tồn tại');
        }
        // Đánh dấu dùng một lần trước khi tạo user (tránh race double-submit)
        const claimed = await this.prisma.registrationOtp.updateMany({
            where: { id: row.id, consumedAt: null, invalidatedAt: null },
            data: { consumedAt: new Date() },
        });
        if (claimed.count === 0) {
            throw new common_1.BadRequestException('Mã OTP đã được sử dụng');
        }
        let user;
        try {
            user = await this.createRegisteredUser({
                email: row.email,
                emailNormalized,
                passwordHash: row.passwordHash,
                name: row.name,
                organizationName: row.organizationName,
                organizationSlug: slug,
            });
        }
        catch (e) {
            // Rollback consume nếu tạo user thất bại (để user thử lại / đăng ký lại)
            await this.prisma.registrationOtp.update({
                where: { id: row.id },
                data: { consumedAt: null, invalidatedAt: new Date() },
            });
            throw e;
        }
        const tokens = await this.issueTokens(user, meta);
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'AUTH_REGISTER_OTP_VERIFIED',
            entityType: 'USER',
            entityId: user.id,
            ipAddress: meta?.ip,
        });
        // Khóa referral từ OTP (đã lưu lúc send-otp). Fallback cookie/header chỉ khi OTP thiếu mã.
        await this.lockReferralBestEffort({
            organizationId: user.organizationId,
            userId: user.id,
            email: user.email,
            referralCode: row.referralCode ||
                meta?.referralCode ||
                null,
            ip: meta?.ip,
            source: 'otp',
        });
        // Tạo mã affiliate ngay khi đăng ký — không đợi user mở /affiliate
        await this.ensureAffiliateProfileBestEffort(user);
        return { ...tokens, user: await this.getCurrentUser(user.id) };
    }
    async createRegisteredUser(input) {
        const emailNormalized = input.emailNormalized || (0, email_normalize_util_1.normalizeEmailForUniqueness)(input.email);
        return this.prisma.$transaction(async (tx) => {
            const org = await tx.organization.create({
                data: {
                    name: input.organizationName,
                    slug: input.organizationSlug,
                    email: input.email,
                },
            });
            const roles = await Promise.all(roles_1.DEFAULT_ROLE_SEEDS.map((r) => tx.role.create({
                data: {
                    organizationId: org.id,
                    code: r.code,
                    name: r.name,
                    isSystem: true,
                },
            })));
            const permissionRows = await Promise.all(roles_1.ALL_PERMISSION_DEFS.map((p) => tx.permission.upsert({
                where: { code: p.code },
                update: { name: p.name, module: p.module },
                create: { code: p.code, name: p.name, module: p.module },
            })));
            const permissionByCode = new Map(permissionRows.map((p) => [p.code, p]));
            for (const role of roles) {
                const codes = (0, roles_1.defaultPermissionCodesForRole)(role.code);
                const links = codes
                    .map((code) => permissionByCode.get(code))
                    .filter((p) => !!p)
                    .map((p) => ({ roleId: role.id, permissionId: p.id }));
                if (links.length) {
                    await tx.rolePermission.createMany({ data: links, skipDuplicates: true });
                }
            }
            const ownerRole = roles.find((r) => r.code === roles_1.SYSTEM_ROLES.OWNER);
            const user = await tx.user.create({
                data: {
                    email: input.email,
                    emailNormalized,
                    passwordHash: input.passwordHash,
                    name: input.name,
                    authProvider: 'LOCAL',
                    organizationId: org.id,
                    roleId: ownerRole.id,
                    emailVerifiedAt: new Date(),
                },
                include: { organization: true, role: true },
            });
            await tx.creditWallet.create({ data: { organizationId: org.id, balance: 0 } });
            return user;
        });
    }
    async login(dto, meta) {
        const emailKey = dto.email.toLowerCase().trim();
        this.rateLimit.assertWithinLimit(`login:email:${emailKey}`, MAX_LOGIN_FAILURES, LOGIN_WINDOW_MS, 'Quá nhiều lần đăng nhập sai. Thử lại sau 15 phút.');
        if (meta?.ip) {
            this.rateLimit.assertWithinLimit(`login:ip:${meta.ip}`, MAX_LOGIN_FAILURES * 3, LOGIN_WINDOW_MS, 'Quá nhiều lần đăng nhập. Thử lại sau.');
        }
        const user = await this.prisma.user.findUnique({
            where: { email: emailKey },
            include: { organization: true, role: true },
        });
        const fail = async () => {
            await this.prisma.loginAttempt.create({
                data: { email: emailKey, ipAddress: meta?.ip, success: false },
            });
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không đúng');
        };
        if (!user || !user.isActive)
            return fail();
        if (!user.passwordHash) {
            await this.prisma.loginAttempt.create({
                data: { email: emailKey, ipAddress: meta?.ip, success: false },
            });
            throw new common_1.UnauthorizedException('Tài khoản này đăng nhập bằng Google. Hãy dùng nút «Tiếp tục với Google».');
        }
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid)
            return fail();
        await this.prisma.loginAttempt.create({
            data: { email: emailKey, ipAddress: meta?.ip, success: true },
        });
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const tokens = await this.issueTokens(user, meta);
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'AUTH_LOGIN',
            entityType: 'USER',
            entityId: user.id,
            ipAddress: meta?.ip,
        });
        return { ...tokens, user: await this.getCurrentUser(user.id) };
    }
    /**
     * Đăng nhập / đăng ký bằng Google ID token.
     * - User mới: tạo org + OWNER giống register
     * - Email đã có: liên kết googleSub, không tạo user trùng, không ghi đè password/role/org
     */
    async loginWithGoogle(idToken, meta) {
        if (meta?.ip) {
            this.rateLimit.assertWithinLimit(`google:ip:${meta.ip}`, MAX_GOOGLE_ATTEMPTS, GOOGLE_WINDOW_MS, 'Quá nhiều lần đăng nhập Google. Thử lại sau 15 phút.');
        }
        this.rateLimit.assertWithinLimit(`google:token:${hashToken(idToken).slice(0, 24)}`, 5, GOOGLE_WINDOW_MS, 'Token Google bị dùng quá nhiều lần. Thử lại sau.');
        const identity = await this.googleVerifier.verifyIdToken(idToken);
        const emailNormalized = (0, email_normalize_util_1.normalizeEmailForUniqueness)(identity.email);
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { googleSub: identity.googleSub },
                    { email: identity.email },
                    { emailNormalized },
                ],
            },
            include: { organization: true, role: true },
        });
        if (user) {
            if (!user.isActive) {
                throw new common_1.UnauthorizedException('Tài khoản đã bị khóa');
            }
            // googleSub thuộc user khác cùng email? (race / conflict)
            if (user.googleSub && user.googleSub !== identity.googleSub && user.email === identity.email) {
                throw new common_1.ConflictException('Email đã liên kết với tài khoản Google khác. Liên hệ hỗ trợ.');
            }
            // Email trùng nhưng googleSub đã gắn user khác
            const subOwner = await this.prisma.user.findUnique({
                where: { googleSub: identity.googleSub },
            });
            if (subOwner && subOwner.id !== user.id) {
                throw new common_1.ConflictException('Tài khoản Google đã liên kết với email khác');
            }
            const nextProvider = user.passwordHash ? 'BOTH' : 'GOOGLE';
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    googleSub: user.googleSub ?? identity.googleSub,
                    authProvider: nextProvider,
                    avatarUrl: identity.avatarUrl ?? user.avatarUrl,
                    emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
                    emailNormalized: user.emailNormalized ?? emailNormalized,
                    lastLoginAt: new Date(),
                    // Không ghi đè name / password / role / organization
                },
                include: { organization: true, role: true },
            });
            await this.prisma.loginAttempt.create({
                data: { email: identity.email, ipAddress: meta?.ip, success: true },
            });
            const tokens = await this.issueTokens(user, meta);
            await this.audit.log({
                organizationId: user.organizationId,
                userId: user.id,
                action: 'AUTH_GOOGLE_LOGIN',
                entityType: 'USER',
                entityId: user.id,
                ipAddress: meta?.ip,
            });
            return { ...tokens, user: await this.getCurrentUser(user.id) };
        }
        // User mới — mirror register org bootstrap; chặn Gmail biến thể đã tồn tại
        await this.assertEmailAvailable(identity.email);
        const orgName = `${identity.name}'s Spa`;
        let slug = (0, slug_util_1.slugify)(orgName);
        const slugTaken = await this.prisma.organization.findUnique({ where: { slug } });
        if (slugTaken) {
            slug = `${slug}-${(0, crypto_1.randomBytes)(3).toString('hex')}`;
        }
        try {
            user = await this.prisma.$transaction(async (tx) => {
                const org = await tx.organization.create({
                    data: { name: orgName, slug, email: identity.email },
                });
                const roles = await Promise.all(roles_1.DEFAULT_ROLE_SEEDS.map((r) => tx.role.create({
                    data: {
                        organizationId: org.id,
                        code: r.code,
                        name: r.name,
                        isSystem: true,
                    },
                })));
                const permissionRows = await Promise.all(roles_1.ALL_PERMISSION_DEFS.map((p) => tx.permission.upsert({
                    where: { code: p.code },
                    update: { name: p.name, module: p.module },
                    create: { code: p.code, name: p.name, module: p.module },
                })));
                const permissionByCode = new Map(permissionRows.map((p) => [p.code, p]));
                for (const role of roles) {
                    const codes = (0, roles_1.defaultPermissionCodesForRole)(role.code);
                    const links = codes
                        .map((code) => permissionByCode.get(code))
                        .filter((p) => !!p)
                        .map((p) => ({ roleId: role.id, permissionId: p.id }));
                    if (links.length) {
                        await tx.rolePermission.createMany({ data: links, skipDuplicates: true });
                    }
                }
                const ownerRole = roles.find((r) => r.code === roles_1.SYSTEM_ROLES.OWNER);
                const created = await tx.user.create({
                    data: {
                        email: identity.email,
                        emailNormalized,
                        passwordHash: null,
                        name: identity.name,
                        avatarUrl: identity.avatarUrl,
                        googleSub: identity.googleSub,
                        authProvider: 'GOOGLE',
                        organizationId: org.id,
                        roleId: ownerRole.id,
                        emailVerifiedAt: new Date(),
                        lastLoginAt: new Date(),
                    },
                    include: { organization: true, role: true },
                });
                await tx.creditWallet.create({ data: { organizationId: org.id, balance: 0 } });
                return created;
            });
        }
        catch (e) {
            // Race: email/googleSub vừa được tạo bởi request song song → login lại
            if (e instanceof database_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                const raced = await this.prisma.user.findFirst({
                    where: {
                        OR: [{ googleSub: identity.googleSub }, { email: identity.email }],
                    },
                    include: { organization: true, role: true },
                });
                if (raced?.isActive) {
                    const tokens = await this.issueTokens(raced, meta);
                    return { ...tokens, user: await this.getCurrentUser(raced.id) };
                }
            }
            throw e;
        }
        await this.prisma.loginAttempt.create({
            data: { email: identity.email, ipAddress: meta?.ip, success: true },
        });
        const tokens = await this.issueTokens(user, meta);
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'AUTH_GOOGLE_REGISTER',
            entityType: 'USER',
            entityId: user.id,
            ipAddress: meta?.ip,
        });
        await this.lockReferralBestEffort({
            organizationId: user.organizationId,
            userId: user.id,
            email: user.email,
            referralCode: meta?.referralCode || null,
            ip: meta?.ip,
            source: 'google',
        });
        await this.ensureAffiliateProfileBestEffort(user);
        return { ...tokens, user: await this.getCurrentUser(user.id) };
    }
    async lockReferralBestEffort(opts) {
        try {
            const result = await this.affiliate.attachReferralOnSignup({
                organizationId: opts.organizationId,
                userId: opts.userId,
                email: opts.email,
                referralCode: opts.referralCode,
                ip: opts.ip,
            });
            if (!result.attached) {
                this.logger.warn(`affiliate attach skipped (${opts.source}) user=${opts.email} code=${opts.referralCode || '-'} reason=${result.reason || 'unknown'}`);
            }
            else {
                this.logger.log(`affiliate attach ok (${opts.source}) user=${opts.email} code=${opts.referralCode}`);
            }
        }
        catch (e) {
            this.logger.warn(`affiliate attach error (${opts.source}) user=${opts.email}: ${e instanceof Error ? e.message : e}`);
        }
    }
    async ensureAffiliateProfileBestEffort(user) {
        try {
            const roleCode = typeof user.role === 'string' ? user.role : user.role?.code || 'OWNER';
            await this.affiliate.ensureProfile({
                id: user.id,
                email: user.email,
                name: user.name || user.email,
                organizationId: user.organizationId,
                role: roleCode,
            });
        }
        catch (e) {
            this.logger.warn(`affiliate ensureProfile skip user=${user.email}: ${e instanceof Error ? e.message : e}`);
        }
    }
    async refresh(refreshToken, meta) {
        const refreshSecret = this.refreshSecret();
        let payload;
        try {
            payload = await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
        }
        catch {
            throw new common_1.UnauthorizedException('Refresh token không hợp lệ');
        }
        if (payload.type !== 'refresh' || !payload.sid) {
            throw new common_1.UnauthorizedException('Refresh token không hợp lệ');
        }
        const session = await this.prisma.authSession.findFirst({
            where: {
                id: payload.sid,
                userId: payload.sub,
                revokedAt: null,
                expiresAt: { gt: new Date() },
                tokenHash: hashToken(refreshToken),
            },
        });
        if (!session) {
            throw new common_1.UnauthorizedException('Refresh token đã hết hạn hoặc bị thu hồi');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: { organization: true, role: true },
        });
        if (!user || !user.isActive || user.deletedAt) {
            throw new common_1.UnauthorizedException('Tài khoản không hợp lệ');
        }
        await this.prisma.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
        });
        const tokens = await this.issueTokens(user, meta);
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'AUTH_REFRESH',
            entityType: 'AUTH_SESSION',
            entityId: session.id,
            ipAddress: meta?.ip,
        });
        return { ...tokens, user: await this.getCurrentUser(user.id) };
    }
    async logout(userId, refreshToken, ip) {
        if (refreshToken) {
            try {
                const payload = await this.jwt.verifyAsync(refreshToken, {
                    secret: this.refreshSecret(),
                });
                if (payload.sid) {
                    await this.prisma.authSession.updateMany({
                        where: { id: payload.sid, userId, revokedAt: null },
                        data: { revokedAt: new Date() },
                    });
                }
            }
            catch {
                // ignore invalid token on logout
            }
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            await this.audit.log({
                organizationId: user.organizationId,
                userId,
                action: 'AUTH_LOGOUT',
                entityType: 'USER',
                entityId: userId,
                ipAddress: ip,
            });
        }
        await this.invalidateAuthCache(userId);
        return { message: 'Đăng xuất thành công' };
    }
    async logoutAll(userId, ip) {
        await this.prisma.authSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            await this.audit.log({
                organizationId: user.organizationId,
                userId,
                action: 'AUTH_LOGOUT_ALL',
                entityType: 'USER',
                entityId: userId,
                ipAddress: ip,
            });
        }
        await this.invalidateAuthCache(userId);
        return { message: 'Đã đăng xuất tất cả thiết bị' };
    }
    async forgotPassword(email, ip) {
        const normalized = email.toLowerCase().trim();
        this.rateLimit.assertWithinLimit(`forgot:${normalized}`, 3, 60 * 60 * 1000, 'Quá nhiều yêu cầu đặt lại mật khẩu.');
        const user = await this.prisma.user.findUnique({ where: { email: normalized } });
        if (user) {
            const raw = (0, crypto_1.randomBytes)(32).toString('hex');
            const ttlSec = 3600;
            await this.prisma.authToken.create({
                data: {
                    userId: user.id,
                    type: database_1.AuthTokenType.PASSWORD_RESET,
                    tokenHash: hashToken(raw),
                    expiresAt: new Date(Date.now() + ttlSec * 1000),
                },
            });
            await this.mail.sendActionLink('reset-password', normalized, raw);
            await this.audit.log({
                organizationId: user.organizationId,
                userId: user.id,
                action: 'AUTH_FORGOT_PASSWORD',
                entityType: 'USER',
                entityId: user.id,
                ipAddress: ip,
            });
        }
        return {
            message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
        };
    }
    async resetPassword(token, newPassword, ip) {
        const row = await this.prisma.authToken.findFirst({
            where: {
                tokenHash: hashToken(token),
                type: database_1.AuthTokenType.PASSWORD_RESET,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });
        if (!row)
            throw new common_1.BadRequestException('Token không hợp lệ hoặc đã hết hạn');
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: row.userId },
                data: { passwordHash },
            }),
            this.prisma.authToken.update({
                where: { id: row.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.authSession.updateMany({
                where: { userId: row.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
        await this.audit.log({
            organizationId: row.user.organizationId,
            userId: row.userId,
            action: 'AUTH_RESET_PASSWORD',
            entityType: 'USER',
            entityId: row.userId,
            ipAddress: ip,
        });
        return { message: 'Đặt lại mật khẩu thành công' };
    }
    async verifyEmail(token, ip) {
        const row = await this.prisma.authToken.findFirst({
            where: {
                tokenHash: hashToken(token),
                type: database_1.AuthTokenType.EMAIL_VERIFY,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });
        if (!row)
            throw new common_1.BadRequestException('Token xác minh không hợp lệ');
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: row.userId },
                data: { emailVerifiedAt: new Date() },
            }),
            this.prisma.authToken.update({
                where: { id: row.id },
                data: { usedAt: new Date() },
            }),
        ]);
        await this.audit.log({
            organizationId: row.user.organizationId,
            userId: row.userId,
            action: 'AUTH_VERIFY_EMAIL',
            entityType: 'USER',
            entityId: row.userId,
            ipAddress: ip,
        });
        return { message: 'Xác minh email thành công' };
    }
    async resendVerification(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException();
        if (user.emailVerifiedAt) {
            return { message: 'Email đã được xác minh' };
        }
        this.rateLimit.assertWithinLimit(`verify-resend:${userId}`, 3, 3600_000);
        const raw = (0, crypto_1.randomBytes)(32).toString('hex');
        await this.prisma.authToken.create({
            data: {
                userId: user.id,
                type: database_1.AuthTokenType.EMAIL_VERIFY,
                tokenHash: hashToken(raw),
                expiresAt: new Date(Date.now() + 86400 * 1000),
            },
        });
        await this.mail.sendActionLink('verify-email', user.email, raw);
        return { message: 'Email xác minh đã được gửi lại' };
    }
    async changePassword(userId, currentPassword, newPassword, ip) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException();
        if (!user.passwordHash) {
            throw new common_1.BadRequestException('Tài khoản Google chưa có mật khẩu. Đặt mật khẩu qua «Quên mật khẩu» hoặc liên hệ admin.');
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Mật khẩu hiện tại không đúng');
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
        await this.audit.log({
            organizationId: user.organizationId,
            userId,
            action: 'AUTH_CHANGE_PASSWORD',
            entityType: 'USER',
            entityId: userId,
            ipAddress: ip,
        });
        await this.invalidateAuthCache(userId);
        return { message: 'Đổi mật khẩu thành công' };
    }
    async validateUser(userId) {
        if (this.redis) {
            try {
                const cached = await this.redis.get(this.authUserKey(userId));
                if (cached) {
                    return JSON.parse(cached);
                }
            }
            catch {
                /* miss */
            }
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                isActive: true,
                deletedAt: true,
                organizationId: true,
                employeeId: true,
                role: {
                    select: {
                        code: true,
                        permissions: { select: { permission: { select: { code: true } } } },
                    },
                },
            },
        });
        // Khóa (isActive=false) hoặc soft-delete → JWT/session cũ không còn gọi được API
        if (!user || !user.isActive || user.deletedAt || !user.role)
            return null;
        const mapped = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role.code,
            organizationId: user.organizationId,
            employeeId: user.employeeId,
            permissions: user.role.permissions.map((rp) => rp.permission.code),
        };
        if (this.redis) {
            try {
                await this.redis.set(this.authUserKey(userId), JSON.stringify(mapped), 'EX', 45);
            }
            catch {
                /* fail-open */
            }
        }
        return mapped;
    }
    async getCurrentUser(userId) {
        if (this.redis) {
            try {
                const cached = await this.redis.get(this.authMeKey(userId));
                if (cached)
                    return JSON.parse(cached);
            }
            catch {
                /* miss */
            }
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                authProvider: true,
                organizationId: true,
                employeeId: true,
                emailVerifiedAt: true,
                uiLocale: true,
                organization: { select: { id: true, name: true, slug: true } },
                role: {
                    select: {
                        code: true,
                        name: true,
                        permissions: { select: { permission: { select: { code: true } } } },
                    },
                },
                employee: { select: { id: true, name: true } },
            },
        });
        if (!user || !user.role || !user.organization)
            throw new common_1.UnauthorizedException();
        const mapped = this.mapUserResponse(user);
        if (this.redis) {
            try {
                await this.redis.set(this.authMeKey(userId), JSON.stringify(mapped), 'EX', 20);
            }
            catch {
                /* fail-open */
            }
        }
        return mapped;
    }
    async updateLocale(userId, locale) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { uiLocale: locale },
        });
        await this.invalidateAuthCache(userId);
        return this.getCurrentUser(userId);
    }
    async issueTokens(user, meta) {
        const refreshSecret = this.refreshSecret();
        const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
        const refreshTtlSec = parseDurationSeconds(refreshExpiresIn, 7 * 86400);
        const sessionId = (0, crypto_1.randomUUID)();
        const payload = {
            sub: user.id,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role.code,
        };
        const accessToken = await this.jwt.signAsync(payload, {
            secret: this.config.get('JWT_SECRET'),
            expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
        });
        const refreshToken = await this.jwt.signAsync({ sub: user.id, type: 'refresh', sid: sessionId }, { secret: refreshSecret, expiresIn: refreshExpiresIn });
        await this.prisma.authSession.create({
            data: {
                id: sessionId,
                userId: user.id,
                organizationId: user.organizationId,
                tokenHash: hashToken(refreshToken),
                userAgent: meta?.userAgent?.slice(0, 512),
                ipAddress: meta?.ip,
                expiresAt: new Date(Date.now() + refreshTtlSec * 1000),
                lastUsedAt: new Date(),
            },
        });
        return { accessToken, refreshToken };
    }
    refreshSecret() {
        const secret = this.config.get('JWT_REFRESH_SECRET') ?? this.config.get('JWT_SECRET');
        if (!secret)
            throw new common_1.UnauthorizedException('Refresh token chưa được cấu hình');
        return secret;
    }
    mapUserResponse(user) {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl ?? null,
            authProvider: user.authProvider ?? 'LOCAL',
            role: user.role.code,
            roleName: user.role.name,
            organizationId: user.organizationId,
            employeeId: user.employeeId ?? user.employee?.id ?? null,
            emailVerified: !!user.emailVerifiedAt,
            uiLocale: user.uiLocale ?? 'vi',
            permissions: (user.role.permissions ?? []).map((rp) => rp.permission.code),
            organization: {
                id: user.organization.id,
                name: user.organization.name,
                slug: user.organization.slug,
            },
            employee: user.employee ?? null,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Optional)()),
    __param(8, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        rate_limit_service_1.RateLimitService,
        auth_mail_service_1.AuthMailService,
        google_token_verifier_1.GoogleTokenVerifier,
        affiliate_service_1.AffiliateService, Function])
], AuthService);
