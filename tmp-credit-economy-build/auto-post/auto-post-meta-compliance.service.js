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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AutoPostMetaComplianceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPostMetaComplianceService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const queue_constants_1 = require("../queue/queue.constants");
const channel_connections_service_1 = require("../messaging/channel-connections.service");
const auto_post_meta_service_1 = require("./auto-post-meta.service");
const auto_post_signed_request_1 = require("./auto-post-signed-request");
let AutoPostMetaComplianceService = AutoPostMetaComplianceService_1 = class AutoPostMetaComplianceService {
    prisma;
    config;
    meta;
    audit;
    channelConnections;
    autoPostQueue;
    logger = new common_1.Logger(AutoPostMetaComplianceService_1.name);
    constructor(prisma, config, meta, audit, channelConnections, autoPostQueue) {
        this.prisma = prisma;
        this.config = config;
        this.meta = meta;
        this.audit = audit;
        this.channelConnections = channelConnections;
        this.autoPostQueue = autoPostQueue;
    }
    /**
     * Meta Deauthorize Callback — revoke tokens, detach Fanpages, cancel scheduled jobs.
     * Idempotent on (facebookUserId, issued_at).
     */
    async handleDeauthorize(input) {
        this.ensureHttps(input);
        const payload = this.verifySignedRequest(input.signedRequest);
        const facebookUserId = payload.user_id;
        const issuedAt = payload.issued_at;
        const existing = await this.prisma.autoPostMetaDeauthorizeEvent.findUnique({
            where: {
                facebookUserId_issuedAt: { facebookUserId, issuedAt },
            },
        });
        if (existing) {
            this.safeAudit('auto_post.facebook.deauthorize.idempotent', {
                facebookUserId,
                eventId: existing.id,
                ipAddress: input.ipAddress,
                requestId: input.requestId,
            });
            return {
                ok: true,
                idempotent: true,
                facebookUserIdMasked: (0, auto_post_signed_request_1.maskFacebookUserId)(facebookUserId),
                userIdsAffected: existing.userIdsAffected.length,
            };
        }
        const result = await this.revokeFacebookAccess(facebookUserId);
        await this.prisma.autoPostMetaDeauthorizeEvent.create({
            data: {
                facebookUserId,
                issuedAt,
                userIdsAffected: result.userIds,
                pagesRemoved: result.pagesRemoved,
                jobsCancelled: result.jobsCancelled,
            },
        });
        this.safeAudit('auto_post.facebook.deauthorize.completed', {
            facebookUserId,
            userIdsAffected: result.userIds.length,
            pagesRemoved: result.pagesRemoved,
            jobsCancelled: result.jobsCancelled,
            organizationIds: result.organizationIds,
            ipAddress: input.ipAddress,
            requestId: input.requestId,
        });
        return {
            ok: true,
            idempotent: false,
            facebookUserIdMasked: (0, auto_post_signed_request_1.maskFacebookUserId)(facebookUserId),
            userIdsAffected: result.userIds.length,
            pagesRemoved: result.pagesRemoved,
            jobsCancelled: result.jobsCancelled,
        };
    }
    /**
     * Meta Data Deletion Callback — delete/anonymize FB Auto Post data; return status URL.
     * Idempotent on facebookUserId (same confirmation_code).
     */
    async handleDataDeletion(input) {
        this.ensureHttps(input);
        const payload = this.verifySignedRequest(input.signedRequest);
        const facebookUserId = payload.user_id;
        const confirmationCode = (0, auto_post_signed_request_1.buildDataDeletionConfirmationCode)(facebookUserId);
        const existing = await this.prisma.autoPostMetaDataDeletionRequest.findUnique({
            where: { facebookUserId },
        });
        if (existing?.status === database_1.AutoPostMetaDeletionStatus.COMPLETED) {
            this.safeAudit('auto_post.facebook.data_deletion.idempotent', {
                facebookUserId,
                confirmationCode: existing.confirmationCode,
                ipAddress: input.ipAddress,
                requestId: input.requestId,
            });
            return {
                url: this.buildStatusUrl(existing.confirmationCode),
                confirmation_code: existing.confirmationCode,
            };
        }
        let request = existing;
        if (!request) {
            try {
                request = await this.prisma.autoPostMetaDataDeletionRequest.create({
                    data: {
                        confirmationCode,
                        facebookUserId,
                        status: database_1.AutoPostMetaDeletionStatus.PENDING,
                    },
                });
            }
            catch {
                // Concurrent create — reload
                request = await this.prisma.autoPostMetaDataDeletionRequest.findUnique({
                    where: { facebookUserId },
                });
                if (!request)
                    throw new common_1.BadRequestException('Unable to create deletion request');
                if (request.status === database_1.AutoPostMetaDeletionStatus.COMPLETED) {
                    return {
                        url: this.buildStatusUrl(request.confirmationCode),
                        confirmation_code: request.confirmationCode,
                    };
                }
            }
        }
        if (!request) {
            throw new common_1.BadRequestException('Unable to create deletion request');
        }
        const revoke = await this.revokeFacebookAccess(facebookUserId);
        const anonymized = await this.anonymizeFacebookPosts(revoke.userIds);
        await this.prisma.autoPostMetaDataDeletionRequest.update({
            where: { id: request.id },
            data: {
                status: database_1.AutoPostMetaDeletionStatus.COMPLETED,
                confirmationCode: request.confirmationCode || confirmationCode,
                userIdsAffected: revoke.userIds,
                organizationIds: revoke.organizationIds,
                postsAnonymized: anonymized.postsAnonymized,
                pagesRemoved: revoke.pagesRemoved,
                scheduledCancelled: revoke.jobsCancelled + anonymized.scheduledCancelled,
                completedAt: new Date(),
            },
        });
        this.safeAudit('auto_post.facebook.data_deletion.completed', {
            facebookUserId,
            confirmationCode: request.confirmationCode,
            userIdsAffected: revoke.userIds.length,
            pagesRemoved: revoke.pagesRemoved,
            postsAnonymized: anonymized.postsAnonymized,
            scheduledCancelled: revoke.jobsCancelled + anonymized.scheduledCancelled,
            organizationIds: revoke.organizationIds,
            ipAddress: input.ipAddress,
            requestId: input.requestId,
        });
        return {
            url: this.buildStatusUrl(request.confirmationCode),
            confirmation_code: request.confirmationCode,
        };
    }
    async getDeletionStatus(confirmationCode) {
        const code = confirmationCode?.trim();
        if (!code)
            throw new common_1.BadRequestException('confirmation_code is required');
        const row = await this.prisma.autoPostMetaDataDeletionRequest.findUnique({
            where: { confirmationCode: code },
        });
        if (!row) {
            return {
                confirmation_code: code,
                status: database_1.AutoPostMetaDeletionStatus.NOT_FOUND,
                message: 'Không tìm thấy yêu cầu xóa dữ liệu với mã này.',
                completed_at: null,
                facebook_user_id_masked: null,
            };
        }
        return {
            confirmation_code: row.confirmationCode,
            status: row.status,
            message: row.status === database_1.AutoPostMetaDeletionStatus.COMPLETED
                ? 'Đã xóa/ẩn danh dữ liệu Facebook Auto Post liên quan.'
                : 'Yêu cầu đang được xử lý.',
            completed_at: row.completedAt?.toISOString() ?? null,
            facebook_user_id_masked: (0, auto_post_signed_request_1.maskFacebookUserId)(row.facebookUserId),
            pages_removed: row.pagesRemoved,
            posts_anonymized: row.postsAnonymized,
            scheduled_cancelled: row.scheduledCancelled,
        };
    }
    verifySignedRequest(signedRequest) {
        try {
            return (0, auto_post_signed_request_1.parseAndVerifySignedRequest)(signedRequest, this.meta.appSecret);
        }
        catch (e) {
            if (e instanceof auto_post_signed_request_1.SignedRequestError) {
                this.logger.warn(`Meta signed_request rejected: ${e.message}`);
                throw new common_1.UnauthorizedException(e.message);
            }
            throw e;
        }
    }
    ensureHttps(input) {
        try {
            (0, auto_post_signed_request_1.assertHttpsRequest)({
                secure: input.secure,
                forwardedProto: input.forwardedProto,
                nodeEnv: this.config.get('NODE_ENV') ?? process.env.NODE_ENV,
            });
        }
        catch (e) {
            if (e instanceof auto_post_signed_request_1.SignedRequestError) {
                throw new common_1.BadRequestException(e.message);
            }
            throw e;
        }
    }
    buildStatusUrl(confirmationCode) {
        const appUrl = (this.config.get('APP_URL') ??
            process.env.APP_URL ??
            'https://aibeego.com').replace(/\/$/, '');
        return `${appUrl}/facebook/data-deletion/status/${encodeURIComponent(confirmationCode)}`;
    }
    /** Invalidate tokens, remove Fanpages, cancel related BullMQ jobs. */
    async revokeFacebookAccess(facebookUserId) {
        const connections = await this.prisma.autoPostFacebookConnection.findMany({
            where: { facebookUserId },
            select: { id: true, userId: true, organizationId: true },
        });
        const userIds = [...new Set(connections.map((c) => c.userId))];
        const organizationIds = [...new Set(connections.map((c) => c.organizationId))];
        let pagesRemoved = 0;
        let jobsCancelled = 0;
        for (const userId of userIds) {
            const pages = await this.prisma.autoPostFacebookPage.findMany({
                where: { userId },
                select: { id: true, pageId: true },
            });
            pagesRemoved += pages.length;
            for (const page of pages) {
                await this.channelConnections.disableMessengerPageAccess(page.pageId, {
                    reason: 'Facebook deauthorized',
                });
            }
            const scheduled = await this.prisma.autoPost.findMany({
                where: { userId, status: database_1.AutoPostStatus.SCHEDULED },
                select: { id: true },
            });
            for (const post of scheduled) {
                try {
                    const job = await this.autoPostQueue.getJob(`auto-post-${post.id}`);
                    if (job) {
                        await job.remove();
                        jobsCancelled++;
                    }
                }
                catch (e) {
                    this.logger.warn(`Failed to cancel auto-post job ${post.id}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            if (scheduled.length > 0) {
                await this.prisma.autoPost.updateMany({
                    where: { userId, status: database_1.AutoPostStatus.SCHEDULED },
                    data: {
                        status: database_1.AutoPostStatus.CANCELLED,
                        scheduledAt: null,
                        errorMessage: 'Cancelled: Facebook deauthorized',
                    },
                });
            }
            await this.prisma.autoPostFacebookPage.deleteMany({ where: { userId } });
            // Hard-delete connection rows so tokens cannot be recovered
            await this.prisma.autoPostFacebookConnection.deleteMany({ where: { userId } });
        }
        this.logger.log(`Revoked Auto Post Facebook access for ${(0, auto_post_signed_request_1.maskFacebookUserId)(facebookUserId)} users=${userIds.length} pages=${pagesRemoved} jobs=${jobsCancelled}`);
        return { userIds, organizationIds, pagesRemoved, jobsCancelled };
    }
    /** Anonymize Facebook-linked fields on Auto Post records for affected users. */
    async anonymizeFacebookPosts(userIds) {
        if (userIds.length === 0) {
            return { postsAnonymized: 0, scheduledCancelled: 0 };
        }
        const scheduled = await this.prisma.autoPost.updateMany({
            where: { userId: { in: userIds }, status: database_1.AutoPostStatus.SCHEDULED },
            data: {
                status: database_1.AutoPostStatus.CANCELLED,
                scheduledAt: null,
                errorMessage: 'Cancelled: Facebook data deletion',
            },
        });
        const result = await this.prisma.autoPost.updateMany({
            where: { userId: { in: userIds } },
            data: {
                fanpageId: null,
                fanpagePageId: null,
                fanpageName: null,
                facebookPostId: null,
                imageUrl: null,
                linkUrl: null,
                caption: '[deleted — Facebook data deletion request]',
                hashtags: null,
                cta: null,
                topic: '[deleted]',
                errorMessage: null,
            },
        });
        // Scrub publish logs that store facebook post ids
        await this.prisma.autoPostPublishLog.updateMany({
            where: { userId: { in: userIds } },
            data: { facebookPostId: null, errorMessage: null },
        });
        await this.prisma.autoPostApiLog.updateMany({
            where: { userId: { in: userIds } },
            data: { message: '[redacted — Facebook data deletion]' },
        });
        return {
            postsAnonymized: result.count,
            scheduledCancelled: scheduled.count,
        };
    }
    safeAudit(action, meta) {
        void this.audit
            .log({
            action,
            entityType: 'AutoPostFacebook',
            entityId: (0, auto_post_signed_request_1.maskFacebookUserId)(meta.facebookUserId),
            ipAddress: meta.ipAddress,
            requestId: meta.requestId,
            metadata: {
                facebookUserIdMasked: (0, auto_post_signed_request_1.maskFacebookUserId)(meta.facebookUserId),
                confirmationCode: meta.confirmationCode,
                eventId: meta.eventId,
                userIdsAffected: meta.userIdsAffected,
                pagesRemoved: meta.pagesRemoved,
                postsAnonymized: meta.postsAnonymized,
                jobsCancelled: meta.jobsCancelled,
                scheduledCancelled: meta.scheduledCancelled,
                organizationCount: meta.organizationIds?.length,
                // Never include tokens / app secret / raw signed_request
            },
        })
            .catch((e) => {
            this.logger.warn(`Audit log failed for ${action}: ${e instanceof Error ? e.message : String(e)}`);
        });
    }
};
exports.AutoPostMetaComplianceService = AutoPostMetaComplianceService;
exports.AutoPostMetaComplianceService = AutoPostMetaComplianceService = AutoPostMetaComplianceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(queue_constants_1.AUTO_POST_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        auto_post_meta_service_1.AutoPostMetaService,
        audit_service_1.AuditService,
        channel_connections_service_1.ChannelConnectionsService, Function])
], AutoPostMetaComplianceService);
