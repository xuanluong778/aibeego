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
exports.MarketingAutopilotGuardrailService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let MarketingAutopilotGuardrailService = class MarketingAutopilotGuardrailService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getOrCreate(organizationId) {
        const existing = await this.prisma.marketingAutopilotGuardrail.findUnique({
            where: { organizationId },
        });
        if (existing)
            return (0, shared_1.normalizeGuardrailFromDb)(existing);
        const created = await this.prisma.marketingAutopilotGuardrail.create({
            data: {
                organizationId,
                maxDailyAdSpend: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.maxDailyAdSpend,
                maxCampaignBudget: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.maxCampaignBudget,
                maxBudgetIncreasePercent: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.maxBudgetIncreasePercent,
                allowedChannels: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowedChannels,
                allowFacebookPublish: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowFacebookPublish,
                allowGoogleAdsPublish: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowGoogleAdsPublish,
                allowEmailSend: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowEmailSend,
                allowZaloSend: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowZaloSend,
                allowAutomationActivation: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowAutomationActivation,
                autopilotMode: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.autopilotMode,
                fullAutopilotEnabled: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.fullAutopilotEnabled,
                cooldownMinutes: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.cooldownMinutes,
            },
        });
        return (0, shared_1.normalizeGuardrailFromDb)(created);
    }
    async update(user, input) {
        if (input.autopilotMode === 'FULL_AUTOPILOT' && input.fullAutopilotEnabled === false) {
            throw new common_1.BadRequestException('FULL_AUTOPILOT cần bật fullAutopilotEnabled — hoặc chọn APPROVAL_AUTOPILOT');
        }
        const parsed = shared_1.marketingAutopilotGuardrailSchema.partial().parse(input);
        const current = await this.getOrCreate(user.organizationId);
        // FULL_AUTOPILOT never auto-enables allowFacebookPublish — only explicit PATCH field.
        if (parsed.allowFacebookPublish === undefined &&
            (parsed.fullAutopilotEnabled === true || parsed.autopilotMode === 'FULL_AUTOPILOT')) {
            delete parsed.allowFacebookPublish;
        }
        const row = await this.prisma.marketingAutopilotGuardrail.upsert({
            where: { organizationId: user.organizationId },
            create: {
                organizationId: user.organizationId,
                ...this.toDbFields({ ...current, ...parsed }),
            },
            update: this.toDbFields(parsed),
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'AUTOPILOT_GUARDRAIL_UPDATE',
            entityType: 'MARKETING_AUTOPILOT_GUARDRAIL',
            entityId: row.id,
            metadata: {
                autopilotMode: row.autopilotMode,
                fullAutopilotEnabled: row.fullAutopilotEnabled,
                allowFacebookPublish: row.allowFacebookPublish,
                allowFacebookPublishExplicit: input.allowFacebookPublish !== undefined,
            },
        });
        return (0, shared_1.normalizeGuardrailFromDb)(row);
    }
    async setEmergencyStop(user, emergencyStop) {
        const row = await this.prisma.marketingAutopilotGuardrail.upsert({
            where: { organizationId: user.organizationId },
            create: {
                organizationId: user.organizationId,
                emergencyStop,
                ...(emergencyStop ? { fullAutopilotEnabled: false } : {}),
            },
            update: {
                emergencyStop,
                ...(emergencyStop ? { fullAutopilotEnabled: false } : {}),
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: emergencyStop ? 'AUTOPILOT_EMERGENCY_STOP_ON' : 'AUTOPILOT_EMERGENCY_STOP_OFF',
            entityType: 'MARKETING_AUTOPILOT_GUARDRAIL',
            entityId: row.id,
            metadata: { emergencyStop },
        });
        const config = (0, shared_1.normalizeGuardrailFromDb)(row);
        return {
            emergencyStop: config.emergencyStop,
            fullAutopilotEnabled: config.fullAutopilotEnabled,
            autopilotMode: config.autopilotMode,
            fullAutopilotActive: (0, shared_1.isFullAutopilotActive)(config),
        };
    }
    resolveEffectiveMode(row) {
        if (row.emergencyStop)
            return 'APPROVAL_AUTOPILOT';
        if (row.autopilotMode === 'RECOMMEND_ONLY')
            return 'RECOMMEND_ONLY';
        if ((0, shared_1.isFullAutopilotActive)(row))
            return 'FULL_AUTOPILOT';
        return 'APPROVAL_AUTOPILOT';
    }
    toDbFields(input) {
        const data = {};
        if (input.maxDailyAdSpend !== undefined)
            data.maxDailyAdSpend = input.maxDailyAdSpend;
        if (input.maxCampaignBudget !== undefined)
            data.maxCampaignBudget = input.maxCampaignBudget;
        if (input.maxBudgetIncreasePercent !== undefined) {
            data.maxBudgetIncreasePercent = input.maxBudgetIncreasePercent;
        }
        if (input.allowedChannels !== undefined)
            data.allowedChannels = input.allowedChannels;
        if (input.allowGoogleAdsPublish !== undefined) {
            data.allowGoogleAdsPublish = input.allowGoogleAdsPublish;
        }
        if (input.allowFacebookPublish !== undefined) {
            data.allowFacebookPublish = input.allowFacebookPublish;
        }
        if (input.allowEmailSend !== undefined)
            data.allowEmailSend = input.allowEmailSend;
        if (input.allowZaloSend !== undefined)
            data.allowZaloSend = input.allowZaloSend;
        if (input.allowAutomationActivation !== undefined) {
            data.allowAutomationActivation = input.allowAutomationActivation;
        }
        if (input.stopLossCpl !== undefined)
            data.stopLossCpl = input.stopLossCpl;
        if (input.stopLossCpa !== undefined)
            data.stopLossCpa = input.stopLossCpa;
        if (input.autopilotMode !== undefined)
            data.autopilotMode = input.autopilotMode;
        if (input.fullAutopilotEnabled !== undefined) {
            data.fullAutopilotEnabled = input.fullAutopilotEnabled;
        }
        if (input.cooldownMinutes !== undefined)
            data.cooldownMinutes = input.cooldownMinutes;
        return data;
    }
};
exports.MarketingAutopilotGuardrailService = MarketingAutopilotGuardrailService;
exports.MarketingAutopilotGuardrailService = MarketingAutopilotGuardrailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], MarketingAutopilotGuardrailService);
