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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPostController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const auto_post_service_1 = require("./auto-post.service");
const auto_post_facebook_service_1 = require("./auto-post-facebook.service");
const auto_post_meta_compliance_service_1 = require("./auto-post-meta-compliance.service");
const auto_post_facebook_page_details_service_1 = require("./auto-post-facebook-page-details.service");
const meta_graph_metrics_service_1 = require("./meta-graph-metrics.service");
const auto_post_dto_1 = require("./dto/auto-post.dto");
const FanpageGuards = [auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard];
let AutoPostController = class AutoPostController {
    service;
    facebook;
    metaCompliance;
    pageDetails;
    metrics;
    constructor(service, facebook, metaCompliance, pageDetails, metrics) {
        this.service = service;
        this.facebook = facebook;
        this.metaCompliance = metaCompliance;
        this.pageDetails = pageDetails;
        this.metrics = metrics;
    }
    status(user) {
        return this.service.status(user);
    }
    generateAi(user, dto) {
        return this.service.generateAi(user, dto);
    }
    rewriteAi(user, dto) {
        return this.service.rewriteAi(user, dto);
    }
    saveDraft(user, dto) {
        return this.service.saveDraft(user, dto);
    }
    updatePost(user, id, dto) {
        return this.service.updatePost(user, { ...dto, id });
    }
    listPosts(user, query) {
        return this.service.listPosts(user.id, user.organizationId, query.status, {
            industryId: query.industryId,
            customIndustry: query.customIndustry,
        });
    }
    getPost(user, id) {
        return this.service.getPost(user.id, user.organizationId, id);
    }
    deletePost(user, id) {
        return this.service.deletePost(user.id, user.organizationId, id);
    }
    publishNow(user, dto) {
        return this.service.publishNow(user.id, user.organizationId, dto);
    }
    schedule(user, dto) {
        return this.service.schedule(user.id, user.organizationId, dto);
    }
    cancelSchedule(user, id) {
        return this.service.cancelSchedule(user.id, user.organizationId, id);
    }
    retry(user, id) {
        return this.service.retry(user.id, user.organizationId, id);
    }
    facebookStatus(user) {
        return this.facebook.getConnectionStatus(user.id, user.organizationId, user);
    }
    /** Metrics Graph an toàn (không token) — phục vụ canary / quan sát. */
    facebookMetaMetrics() {
        return this.metrics.snapshot();
    }
    /**
     * Chẩn đoán quyền Fanpage: Configuration ID, granted/declined, Page ID, token type, updatedAt.
     * Không trả token.
     */
    facebookPermissionsDiagnostics(user) {
        return this.facebook.getPermissionsDiagnostics(user.id, user.organizationId);
    }
    facebookOAuthStart(user) {
        return this.facebook.getOAuthStartUrl(user);
    }
    /** SUPER_ADMIN / org allowlist: đồng bộ Fanpage từ META_PAGE_* (không lộ token). */
    facebookConnectServerEnv(user) {
        return this.facebook.connectServerEnv(user);
    }
    async facebookOAuthCallback(code, state, error, res) {
        const { redirectUrl } = await this.facebook.handleOAuthCallback(code, state, error);
        return res.redirect(redirectUrl);
    }
    facebookDisconnect(user) {
        return this.facebook.disconnect(user.id, user.organizationId);
    }
    /**
     * Xem thông tin Fanpage (pages_read_engagement) — metadata + bài gần đây.
     * Query `refresh=true` bỏ cache ngắn (3–5 phút) và không fallback stale.
     */
    facebookPageDetails(user, fanpageId, refresh) {
        const forceRefresh = refresh === '1' || refresh === 'true' || refresh === 'yes';
        return this.pageDetails.getPageDetails(user.id, user.organizationId, fanpageId, {
            refresh: forceRefresh,
        });
    }
    /**
     * Đồng bộ live từ Facebook Graph (Page Access Token).
     * Không đọc cache / không fallback dữ liệu cũ — dùng cho App Review pages_read_engagement.
     */
    facebookPageSync(user, fanpageId) {
        return this.pageDetails.syncPageDetails(user.id, user.organizationId, fanpageId);
    }
    facebookDisconnectPage(user, fanpageId) {
        return this.facebook.disconnectPage(user.id, user.organizationId, fanpageId);
    }
    refreshPages(user) {
        return this.facebook.refreshPages(user.id, user.organizationId, user);
    }
    // OAuth: lấy danh sách Fanpage để user chủ động chọn (không trả token)
    oauthListPages(user) {
        return this.facebook.listOAuthManagedPages(user.id, user.organizationId, user);
    }
    oauthSelectPage(user, dto) {
        const pageIds = Array.isArray(dto?.pageIds) && dto.pageIds.length > 0
            ? dto.pageIds
            : dto?.pageId
                ? [dto.pageId]
                : [];
        if (pageIds.length === 0) {
            throw new common_1.BadRequestException('pageIds is required');
        }
        return this.facebook.selectOAuthPages(user.id, user.organizationId, pageIds);
    }
    /**
     * Meta Deauthorize Callback (public, no JWT).
     * App Dashboard → Facebook Login → Settings → Deauthorize Callback URL
     * POST application/x-www-form-urlencoded: signed_request=...
     */
    facebookDeauthorize(req, body) {
        const signedRequest = this.extractSignedRequest(req, body);
        return this.metaCompliance.handleDeauthorize({
            signedRequest,
            ipAddress: req.ip,
            requestId: req.requestId,
            secure: req.secure,
            forwardedProto: req.headers['x-forwarded-proto'],
        });
    }
    /**
     * Meta Data Deletion Request Callback (public, no JWT).
     * Returns { url, confirmation_code } per Meta Platform Terms.
     */
    facebookDataDeletion(req, body) {
        const signedRequest = this.extractSignedRequest(req, body);
        return this.metaCompliance.handleDataDeletion({
            signedRequest,
            ipAddress: req.ip,
            requestId: req.requestId,
            secure: req.secure,
            forwardedProto: req.headers['x-forwarded-proto'],
        });
    }
    /** Public status check for Meta data deletion confirmation_code */
    facebookDataDeletionStatus(code) {
        return this.metaCompliance.getDeletionStatus(code);
    }
    extractSignedRequest(req, body) {
        const fromBody = (typeof body?.signed_request === 'string' && body.signed_request) ||
            (typeof req.body?.signed_request === 'string' &&
                req.body.signed_request) ||
            '';
        const fromQuery = typeof req.query?.signed_request === 'string' ? req.query.signed_request : '';
        const signedRequest = (fromBody || fromQuery).trim();
        if (!signedRequest) {
            throw new common_1.BadRequestException('signed_request is required');
        }
        return signedRequest;
    }
};
exports.AutoPostController = AutoPostController;
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('ai/generate'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_post_dto_1.GenerateAutoPostDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "generateAi", null);
__decorate([
    (0, common_1.Post)('ai/rewrite'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_post_dto_1.RewriteAutoPostDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "rewriteAi", null);
__decorate([
    (0, common_1.Post)('drafts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_post_dto_1.SaveAutoPostDraftDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "saveDraft", null);
__decorate([
    (0, common_1.Put)('posts/:id'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, auto_post_dto_1.UpdateAutoPostDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "updatePost", null);
__decorate([
    (0, common_1.Get)('posts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_post_dto_1.AutoPostListQueryDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "listPosts", null);
__decorate([
    (0, common_1.Get)('posts/:id'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "getPost", null);
__decorate([
    (0, common_1.Delete)('posts/:id'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "deletePost", null);
__decorate([
    (0, common_1.Post)('publish'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_post_dto_1.PublishAutoPostDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "publishNow", null);
__decorate([
    (0, common_1.Post)('schedule'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_post_dto_1.ScheduleAutoPostDto]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "schedule", null);
__decorate([
    (0, common_1.Post)('schedule/:id/cancel'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "cancelSchedule", null);
__decorate([
    (0, common_1.Post)('posts/:id/retry'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "retry", null);
__decorate([
    (0, common_1.Get)('facebook/status'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookStatus", null);
__decorate([
    (0, common_1.Get)('facebook/meta-metrics'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookMetaMetrics", null);
__decorate([
    (0, common_1.Get)('facebook/permissions-diagnostics'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookPermissionsDiagnostics", null);
__decorate([
    (0, common_1.Get)('facebook/oauth/start'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookOAuthStart", null);
__decorate([
    (0, common_1.Post)('facebook/connect/server-env'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookConnectServerEnv", null);
__decorate([
    (0, common_1.Get)('facebook/oauth/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AutoPostController.prototype, "facebookOAuthCallback", null);
__decorate([
    (0, common_1.Post)('facebook/disconnect'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookDisconnect", null);
__decorate([
    (0, common_1.Get)('facebook/pages/:fanpageId/details'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('fanpageId')),
    __param(2, (0, common_1.Query)('refresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookPageDetails", null);
__decorate([
    (0, common_1.Post)('facebook/pages/:fanpageId/sync'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('fanpageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookPageSync", null);
__decorate([
    (0, common_1.Delete)('facebook/pages/:fanpageId'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('fanpageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookDisconnectPage", null);
__decorate([
    (0, common_1.Post)('facebook/pages/refresh'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "refreshPages", null);
__decorate([
    (0, common_1.Get)('facebook/oauth/pages'),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "oauthListPages", null);
__decorate([
    (0, common_1.Post)('facebook/oauth/select'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(...FanpageGuards),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "oauthSelectPage", null);
__decorate([
    (0, common_1.Post)('facebook/deauthorize'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookDeauthorize", null);
__decorate([
    (0, common_1.Post)('facebook/data-deletion'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookDataDeletion", null);
__decorate([
    (0, common_1.Get)('facebook/data-deletion/status/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutoPostController.prototype, "facebookDataDeletionStatus", null);
exports.AutoPostController = AutoPostController = __decorate([
    (0, common_1.Controller)('auto-post'),
    __metadata("design:paramtypes", [auto_post_service_1.AutoPostService,
        auto_post_facebook_service_1.AutoPostFacebookService,
        auto_post_meta_compliance_service_1.AutoPostMetaComplianceService,
        auto_post_facebook_page_details_service_1.AutoPostFacebookPageDetailsService,
        meta_graph_metrics_service_1.MetaGraphMetricsService])
], AutoPostController);
