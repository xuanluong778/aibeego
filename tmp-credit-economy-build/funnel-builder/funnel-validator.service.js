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
var FunnelValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelValidatorService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const openai_service_1 = require("../openai/openai.service");
function isZodLikeError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        'issues' in err &&
        Array.isArray(err.issues));
}
let FunnelValidatorService = FunnelValidatorService_1 = class FunnelValidatorService {
    openAi;
    logger = new common_1.Logger(FunnelValidatorService_1.name);
    constructor(openAi) {
        this.openAi = openAi;
    }
    validateCompleteSpec(raw) {
        try {
            const spec = (0, shared_1.parseFunnelCompleteSpec)(raw);
            return (0, shared_1.validateFunnelCompleteSpec)(spec);
        }
        catch (err) {
            if (isZodLikeError(err)) {
                throw new common_1.BadRequestException({
                    message: 'Complete spec không hợp lệ',
                    issues: err.issues.map((i) => i.message),
                });
            }
            throw err;
        }
    }
    validateBlueprintDraft(raw) {
        try {
            const draft = (0, shared_1.parseFunnelBlueprintDraft)(raw);
            return (0, shared_1.validateFunnelBlueprintDraft)(draft);
        }
        catch (err) {
            if (isZodLikeError(err)) {
                throw new common_1.BadRequestException({
                    message: 'Blueprint draft không hợp lệ',
                    issues: err.issues.map((i) => i.message),
                });
            }
            throw err;
        }
    }
    async explain(result) {
        if (!this.openAi.isConfigured()) {
            return {
                explanation: (0, shared_1.buildFunnelValidatorExplanation)(result),
                source: 'rules',
            };
        }
        try {
            const payload = {
                score: result.score,
                canActivate: result.canActivate,
                blocking: result.blocking,
                warnings: result.warnings,
                dimensions: Object.fromEntries(Object.entries(result.dimensions).map(([k, v]) => [
                    k,
                    { score: v.score, max: v.max, issues: v.issues },
                ])),
                failedChecks: result.checks.filter((c) => !c.passed).map((c) => ({
                    id: c.id,
                    label: c.label,
                    message: c.message,
                    hint: c.hint,
                })),
            };
            const text = await this.openAi.chatCompletion({
                model: 'gpt-4o-mini',
                temperature: 0.3,
                maxTokens: 450,
                messages: [
                    {
                        role: 'system',
                        content: `Bạn là chuyên gia funnel marketing spa. Giải thích điểm yếu funnel bằng tiếng Việt.
QUY TẮC BẮT BUỘC:
- CHỈ dựa trên JSON validation report được cung cấp
- KHÔNG bịa số KPI, conversion rate, ROAS, doanh thu, hoặc % dự đoán
- KHÔNG đưa ra con số hiệu suất thực tế vì chưa có dữ liệu ads
- Gợi ý sửa cụ thể theo từng check/dimension thiếu
- Tối đa 250 từ, bullet ngắn`,
                    },
                    {
                        role: 'user',
                        content: `Validation report:\n${JSON.stringify(payload, null, 2)}`,
                    },
                ],
            });
            const explanation = text?.trim() || (0, shared_1.buildFunnelValidatorExplanation)(result);
            return { explanation, source: 'ai' };
        }
        catch (err) {
            this.logger.warn(`AI funnel explanation failed: ${String(err)}`);
            return {
                explanation: (0, shared_1.buildFunnelValidatorExplanation)(result),
                source: 'rules',
            };
        }
    }
};
exports.FunnelValidatorService = FunnelValidatorService;
exports.FunnelValidatorService = FunnelValidatorService = FunnelValidatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService])
], FunnelValidatorService);
