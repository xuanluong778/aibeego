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
var GoogleAdsCampaignBuilderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsCampaignBuilderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const ad_connection_facade_1 = require("../ad-performance/ad-connection.facade");
const google_ads_api_service_1 = require("../ad-performance/google-ads/google-ads-api.service");
const openai_service_1 = require("../openai/openai.service");
const credit_service_1 = require("../credit/credit.service");
const ads_efficiency_util_1 = require("./ads-efficiency.util");
const queue_constants_1 = require("../queue/queue.constants");
const crypto_1 = require("crypto");
/**
 * LLM / draft / approval / preflight only.
 * Does not call Google Ads mutate endpoints — worker executes deploy.
 */
let GoogleAdsCampaignBuilderService = GoogleAdsCampaignBuilderService_1 = class GoogleAdsCampaignBuilderService {
    prisma;
    config;
    connections;
    googleApi;
    openAi;
    credit;
    audit;
    deployQueue;
    logger = new common_1.Logger(GoogleAdsCampaignBuilderService_1.name);
    constructor(prisma, config, connections, googleApi, openAi, credit, audit, deployQueue) {
        this.prisma = prisma;
        this.config = config;
        this.connections = connections;
        this.googleApi = googleApi;
        this.openAi = openAi;
        this.credit = credit;
        this.audit = audit;
        this.deployQueue = deployQueue;
    }
    async listDrafts(user) {
        const items = await this.prisma.googleAdsCampaignDraft.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 40,
            include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        return { items: items.map((d) => this.toPublic(d)) };
    }
    async getDraft(user, id) {
        return this.toPublic(await this.requireDraft(user, id));
    }
    async createDraft(user, dto) {
        const brief = shared_1.googleAdsCampaignBriefSchema.parse(dto.brief);
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(dto.customerId);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        const loginCustomerId = (0, shared_1.normalizeGoogleCustomerId)(dto.loginCustomerId) || null;
        const url = (0, shared_1.parsePublicHttpUrl)(brief.landingPage);
        if (!url) {
            throw new common_1.BadRequestException('Website/Landing page phải là URL http(s) công khai, không dùng localhost');
        }
        const budget = (0, shared_1.resolveDailyBudget)(brief);
        if (!budget.ok)
            throw new common_1.BadRequestException(budget.errors.join('; '));
        const settings = await this.prisma.adManagerSettings.findUnique({
            where: { userId: user.id },
        });
        const limit = settings?.dailyBudgetLimit ? (0, ads_efficiency_util_1.decimalToNumber)(settings.dailyBudgetLimit) : null;
        const limitError = (0, shared_1.validateCampaignBudgetLimit)(budget.dailyAmount, limit);
        if (limitError)
            throw new common_1.BadRequestException(limitError);
        const account = await this.prisma.adGoogleAdsAccount.findFirst({
            where: { organizationId: user.organizationId, customerId, isSelected: true },
        });
        if (!account) {
            throw new common_1.BadRequestException('Chọn tài khoản Google Ads trước khi tạo chiến dịch');
        }
        const idempotencyKey = (0, shared_1.campaignBuilderIdempotencyKey)({
            organizationId: user.organizationId,
            customerId,
            brief,
        });
        const existing = await this.prisma.googleAdsCampaignDraft.findUnique({
            where: { idempotencyKey },
            include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (existing && existing.organizationId === user.organizationId) {
            return this.toPublic(existing);
        }
        const structured = await this.generateStructuredDraft(user, brief, budget);
        const row = await this.prisma.googleAdsCampaignDraft.create({
            data: {
                organizationId: user.organizationId,
                userId: user.id,
                customerId,
                loginCustomerId: loginCustomerId || account.loginCustomerId,
                status: database_1.GoogleAdsCampaignDraftStatus.DRAFT,
                brief: brief,
                structuredDraft: structured,
                validation: {
                    budget,
                    url: url.toString(),
                },
                dailyBudget: budget.dailyAmount,
                monthlyEstimate: budget.monthlyEstimate,
                currency: budget.currency,
                idempotencyKey,
            },
            include: { deployments: true },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'GOOGLE_ADS_CAMPAIGN_DRAFT_CREATED',
            entityType: 'GoogleAdsCampaignDraft',
            entityId: row.id,
            metadata: { customerId, campaignName: structured.campaignName },
        });
        return this.toPublic(row);
    }
    async preview(user, id) {
        const draft = await this.requireDraft(user, id);
        const structured = shared_1.googleAdsStructuredDraftSchema.parse(draft.structuredDraft);
        const brief = shared_1.googleAdsCampaignBriefSchema.parse(draft.brief);
        const budget = {
            dailyAmount: (0, ads_efficiency_util_1.decimalToNumber)(draft.dailyBudget),
            monthlyEstimate: (0, ads_efficiency_util_1.decimalToNumber)(draft.monthlyEstimate),
            currency: draft.currency,
        };
        const updated = await this.prisma.googleAdsCampaignDraft.update({
            where: { id: draft.id },
            data: {
                status: draft.status === database_1.GoogleAdsCampaignDraftStatus.DRAFT
                    ? database_1.GoogleAdsCampaignDraftStatus.PREVIEWED
                    : draft.status,
                previewedAt: draft.previewedAt ?? new Date(),
            },
            include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        return {
            ...this.toPublic(updated),
            preview: {
                ...structured,
                budget,
                briefing: brief,
                steps: [
                    'CampaignBudget',
                    'Campaign',
                    'Locations/Languages',
                    'AdGroups',
                    'Keywords',
                    'Responsive Search Ads',
                ],
            },
        };
    }
    async preflight(user, id) {
        const draft = await this.requireDraft(user, id);
        const structured = shared_1.googleAdsStructuredDraftSchema.parse(draft.structuredDraft);
        const brief = shared_1.googleAdsCampaignBriefSchema.parse(draft.brief);
        const settings = await this.prisma.adManagerSettings.findUnique({
            where: { userId: user.id },
        });
        const limit = settings?.dailyBudgetLimit ? (0, ads_efficiency_util_1.decimalToNumber)(settings.dailyBudgetLimit) : null;
        const publish = (0, shared_1.validateStructuredDraftForPublish)(structured, brief, limit);
        const conn = await this.prisma.adConnection.findUnique({
            where: {
                organizationId_provider: {
                    organizationId: user.organizationId,
                    provider: database_1.AdConnectionProvider.GOOGLE,
                },
            },
        });
        const account = await this.prisma.adGoogleAdsAccount.findFirst({
            where: {
                organizationId: user.organizationId,
                customerId: draft.customerId,
                isSelected: true,
            },
        });
        const scopes = Array.isArray(conn?.scopes) ? conn.scopes : [];
        const hasAdwords = scopes.some((s) => String(s).includes('adwords'));
        const checks = [
            ...publish.checks,
            {
                id: 'account',
                ok: Boolean(account && conn?.status === database_1.AdConnectionStatus.CONNECTED),
                message: account && conn?.status === database_1.AdConnectionStatus.CONNECTED
                    ? `Tài khoản ${draft.customerId} đã chọn và OAuth CONNECTED`
                    : 'Thiếu kết nối Google hoặc chưa chọn customer',
            },
            {
                id: 'permission',
                ok: Boolean(hasAdwords && this.config.get('GOOGLE_ADS_DEVELOPER_TOKEN')),
                message: hasAdwords
                    ? 'OAuth có scope adwords · developer token đã cấu hình'
                    : 'Thiếu scope adwords hoặc developer token — Kết nối lại Google',
            },
        ];
        try {
            const refresh = await this.connections.getGoogleRefreshToken(user.organizationId);
            const access = await this.googleApi.refreshAccessToken(refresh);
            await this.googleApi.getCustomerDetail(access, draft.customerId, draft.loginCustomerId);
            checks.push({
                id: 'google_read',
                ok: true,
                message: 'Đọc được customer trên Google Ads API',
            });
        }
        catch (e) {
            checks.push({
                id: 'google_read',
                ok: false,
                message: e instanceof Error ? e.message.slice(0, 240) : 'Không đọc được Google Ads customer',
            });
        }
        const requiredIds = new Set(['url', 'budget', 'rsa', 'keywords', 'account', 'permission']);
        if (this.providerWriteEnabled())
            requiredIds.add('google_read');
        const ok = checks.filter((c) => requiredIds.has(c.id)).every((c) => c.ok);
        const validation = { checks, ok, ranAt: new Date().toISOString() };
        const updated = await this.prisma.googleAdsCampaignDraft.update({
            where: { id: draft.id },
            data: { validation: validation },
            include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        return { ...this.toPublic(updated), preflight: validation };
    }
    async approve(user, id, confirm) {
        if (confirm !== true) {
            throw new common_1.BadRequestException('Cần bấm xác nhận (confirm=true) trước khi chạy quảng cáo');
        }
        const draft = await this.requireDraft(user, id);
        if (!draft.previewedAt) {
            throw new common_1.BadRequestException('Xem preview chiến dịch trước khi xác nhận');
        }
        const validation = (draft.validation ?? {});
        if (validation.ok !== true) {
            throw new common_1.BadRequestException('Chạy kiểm tra (preflight) và sửa lỗi trước khi xác nhận');
        }
        if (draft.status === database_1.GoogleAdsCampaignDraftStatus.DEPLOYED ||
            draft.status === database_1.GoogleAdsCampaignDraftStatus.DEPLOYING) {
            throw new common_1.BadRequestException('Chiến dịch đang triển khai hoặc đã chạy');
        }
        const updated = await this.prisma.googleAdsCampaignDraft.update({
            where: { id: draft.id },
            data: {
                status: database_1.GoogleAdsCampaignDraftStatus.APPROVED,
                approvedAt: new Date(),
                approvedByUserId: user.id,
            },
            include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'GOOGLE_ADS_CAMPAIGN_DRAFT_APPROVED',
            entityType: 'GoogleAdsCampaignDraft',
            entityId: draft.id,
            metadata: { customerId: draft.customerId },
        });
        return this.toPublic(updated);
    }
    providerWriteEnabled() {
        return ((0, shared_1.isAdsActionsLive)({ ADS_ACTIONS_LIVE: this.config.get('ADS_ACTIONS_LIVE') }) &&
            String(this.config.get('ADS_ACTIONS_PROVIDER_WRITE') ?? 'false').toLowerCase() === 'true');
    }
    async deploy(user, id) {
        const draft = await this.requireDraft(user, id);
        if (draft.status !== database_1.GoogleAdsCampaignDraftStatus.APPROVED &&
            draft.status !== database_1.GoogleAdsCampaignDraftStatus.PARTIAL &&
            draft.status !== database_1.GoogleAdsCampaignDraftStatus.DEPLOYED &&
            draft.status !== database_1.GoogleAdsCampaignDraftStatus.DEPLOYING) {
            throw new common_1.ForbiddenException('Chỉ triển khai sau khi bạn bấm Xác nhận chạy quảng cáo (USER_APPROVAL)');
        }
        const providerWrite = (0, shared_1.isAdsActionsLive)({ ADS_ACTIONS_LIVE: this.config.get('ADS_ACTIONS_LIVE') }) &&
            String(this.config.get('ADS_ACTIONS_PROVIDER_WRITE') ?? 'false').toLowerCase() === 'true';
        const key = (0, shared_1.deploymentIdempotencyKey)(draft.id);
        let deployment = await this.prisma.googleAdsCampaignDeployment.findUnique({
            where: { idempotencyKey: key },
        });
        if (!deployment) {
            deployment = await this.prisma.googleAdsCampaignDeployment.create({
                data: {
                    draftId: draft.id,
                    organizationId: user.organizationId,
                    status: database_1.GoogleAdsCampaignDeployStatus.PENDING,
                    idempotencyKey: key,
                    providerWriteEnabled: providerWrite,
                },
            });
        }
        else if (deployment.status === database_1.GoogleAdsCampaignDeployStatus.SUCCEEDED) {
            return {
                reused: true,
                message: 'Đã triển khai — không tạo campaign trùng',
                deployment: this.toPublicDeployment(deployment),
                draft: this.toPublic(await this.requireDraft(user, id)),
            };
        }
        await this.prisma.googleAdsCampaignDraft.update({
            where: { id: draft.id },
            data: { status: database_1.GoogleAdsCampaignDraftStatus.DEPLOYING },
        });
        if (providerWrite) {
            const job = await this.deployQueue.add(shared_1.QUEUE_NAMES.ADS_CAMPAIGN_DEPLOY, { organizationId: user.organizationId, deploymentId: deployment.id }, { jobId: key, removeOnComplete: 50, attempts: 3, backoff: { type: 'exponential', delay: 15_000 } });
            await this.prisma.googleAdsCampaignDeployment.update({
                where: { id: deployment.id },
                data: { status: database_1.GoogleAdsCampaignDeployStatus.DEPLOYING, startedAt: new Date() },
            });
            return {
                queued: true,
                jobId: String(job.id),
                deployment: this.toPublicDeployment({
                    ...deployment,
                    status: database_1.GoogleAdsCampaignDeployStatus.DEPLOYING,
                }),
            };
        }
        const structured = shared_1.googleAdsStructuredDraftSchema.parse(draft.structuredDraft);
        const existing = (deployment.createdResources ?? {});
        const result = await (0, shared_1.executeGoogleAdsCampaignPlan)({
            draft: structured,
            resources: existing,
            mutate: (0, shared_1.createDryRunMutatePort)(draft.customerId),
        });
        const nextStatus = result.completed
            ? database_1.GoogleAdsCampaignDeployStatus.SUCCEEDED
            : result.resources.budgetResourceName
                ? database_1.GoogleAdsCampaignDeployStatus.PARTIAL
                : database_1.GoogleAdsCampaignDeployStatus.FAILED;
        const saved = await this.prisma.googleAdsCampaignDeployment.update({
            where: { id: deployment.id },
            data: {
                status: nextStatus,
                createdResources: result.resources,
                lastCompletedStep: result.completed ? 'ads' : result.failedStep ?? null,
                lastError: result.error ?? null,
                attemptCount: { increment: 1 },
                providerWriteEnabled: false,
                startedAt: deployment.startedAt ?? new Date(),
                completedAt: result.completed ? new Date() : null,
            },
        });
        await this.prisma.googleAdsCampaignDraft.update({
            where: { id: draft.id },
            data: {
                status: result.completed
                    ? database_1.GoogleAdsCampaignDraftStatus.DEPLOYED
                    : nextStatus === database_1.GoogleAdsCampaignDeployStatus.PARTIAL
                        ? database_1.GoogleAdsCampaignDraftStatus.PARTIAL
                        : database_1.GoogleAdsCampaignDraftStatus.FAILED,
                lastError: result.error ?? null,
            },
        });
        return {
            reused: false,
            dryRun: true,
            message: result.completed
                ? 'Đã tạo campaign (dry-run — bật ADS_ACTIONS_LIVE + ADS_ACTIONS_PROVIDER_WRITE để ghi Google Ads thật)'
                : 'Triển khai dở — trạng thái PARTIAL, bấm triển khai lại để tiếp tục',
            deployment: this.toPublicDeployment(saved),
        };
    }
    async getDeployment(user, id) {
        const row = await this.prisma.googleAdsCampaignDeployment.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy lần triển khai');
        return this.toPublicDeployment(row);
    }
    async retry(user, deploymentId) {
        const row = await this.prisma.googleAdsCampaignDeployment.findFirst({
            where: { id: deploymentId, organizationId: user.organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy lần triển khai');
        if (row.status === database_1.GoogleAdsCampaignDeployStatus.SUCCEEDED) {
            return { reused: true, deployment: this.toPublicDeployment(row) };
        }
        await this.prisma.googleAdsCampaignDraft.update({
            where: { id: row.draftId },
            data: { status: database_1.GoogleAdsCampaignDraftStatus.APPROVED },
        });
        return this.deploy(user, row.draftId);
    }
    async generateStructuredDraft(user, brief, budget) {
        let ai = null;
        if (this.openAi.isConfigured()) {
            try {
                ai = await this.credit.runPaidFeature({
                    organizationId: user.organizationId,
                    featureCode: shared_1.CREDIT_FEATURE_CODES.ADS_AI_CREATIVE,
                    referenceId: `ads.campaign-draft:${user.organizationId}:${(0, crypto_1.randomUUID)()}`,
                    reason: 'Google Ads AI campaign draft',
                    fn: async (ctx) => {
                        const raw = await this.openAi.chatCompletion({
                            messages: [
                                {
                                    role: 'system',
                                    content: 'Bạn là chuyên gia Google Ads Search cho người mới. Chỉ trả JSON (không markdown) với: campaignType (SEARCH), objective, campaignName, budget {dailyAmount,currency}, locations[], languages[], biddingStrategy, adGroups[{name,keywords[]}], keywords[], negativeKeywords[], headlines[] (3-15, mỗi cái ≤30 ký tự), descriptions[] (2-4, ≤90 ký tự), finalUrl. Không bịa giá. Không gọi API Google.',
                                },
                                {
                                    role: 'user',
                                    content: JSON.stringify({
                                        product: brief.product,
                                        landingPage: brief.landingPage,
                                        objective: brief.objective,
                                        location: brief.location,
                                        audience: brief.audience,
                                        dailyBudget: budget.dailyAmount,
                                        currency: budget.currency,
                                    }),
                                },
                            ],
                            temperature: 0.4,
                        });
                        return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
                    },
                });
            }
            catch (err) {
                this.logger.warn(`AI campaign draft fallback: ${err instanceof Error ? err.message : err}`);
            }
        }
        return (0, shared_1.mergeStructuredDraft)(brief, budget, ai);
    }
    async requireDraft(user, id) {
        const row = await this.prisma.googleAdsCampaignDraft.findFirst({
            where: { id, organizationId: user.organizationId },
            include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy bản nháp chiến dịch Google Ads');
        return row;
    }
    toPublic(row) {
        return {
            id: row.id,
            organizationId: row.organizationId,
            customerId: row.customerId,
            loginCustomerId: row.loginCustomerId,
            status: row.status,
            brief: row.brief,
            structuredDraft: row.structuredDraft,
            validation: row.validation,
            dailyBudget: (0, ads_efficiency_util_1.decimalToNumber)(row.dailyBudget),
            monthlyEstimate: (0, ads_efficiency_util_1.decimalToNumber)(row.monthlyEstimate),
            currency: row.currency,
            approvedAt: row.approvedAt,
            previewedAt: row.previewedAt,
            idempotencyKey: row.idempotencyKey,
            lastError: row.lastError,
            createdAt: row.createdAt,
            latestDeployment: row.deployments?.[0]
                ? {
                    id: row.deployments[0].id,
                    status: row.deployments[0].status,
                    createdResources: row.deployments[0].createdResources,
                    lastError: row.deployments[0].lastError,
                    attemptCount: row.deployments[0].attemptCount,
                    providerWriteEnabled: row.deployments[0].providerWriteEnabled,
                }
                : null,
        };
    }
    toPublicDeployment(row) {
        return {
            id: row.id,
            draftId: row.draftId,
            status: row.status,
            idempotencyKey: row.idempotencyKey,
            createdResources: row.createdResources,
            lastCompletedStep: row.lastCompletedStep,
            lastError: row.lastError,
            attemptCount: row.attemptCount,
            providerWriteEnabled: row.providerWriteEnabled,
        };
    }
};
exports.GoogleAdsCampaignBuilderService = GoogleAdsCampaignBuilderService;
exports.GoogleAdsCampaignBuilderService = GoogleAdsCampaignBuilderService = GoogleAdsCampaignBuilderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(queue_constants_1.ADS_CAMPAIGN_DEPLOY_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        ad_connection_facade_1.AdConnectionFacade,
        google_ads_api_service_1.GoogleAdsApiService,
        openai_service_1.OpenAiService,
        credit_service_1.CreditService,
        audit_service_1.AuditService,
        bullmq_1.Queue])
], GoogleAdsCampaignBuilderService);
