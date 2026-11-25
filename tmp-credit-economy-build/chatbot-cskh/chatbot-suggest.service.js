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
exports.ChatbotSuggestService = void 0;
const common_1 = require("@nestjs/common");
const chatbot_constants_1 = require("./utils/chatbot-constants");
const chatbot_suggest_options_1 = require("./utils/chatbot-suggest-options");
const openai_service_1 = require("../openai/openai.service");
let ChatbotSuggestService = class ChatbotSuggestService {
    openAi;
    constructor(openAi) {
        this.openAi = openAi;
    }
    getOptions(industry) {
        return {
            industries: [...chatbot_suggest_options_1.CHATBOT_INDUSTRY_OPTIONS],
            services: (0, chatbot_suggest_options_1.servicesForIndustry)(industry),
            defaultServices: chatbot_suggest_options_1.CHATBOT_DEFAULT_SERVICES,
        };
    }
    async suggest(dto) {
        if (dto.type === 'greeting') {
            const text = await this.suggestGreeting(dto);
            return { type: 'greeting', text, suggestions: this.greetingVariants(dto) };
        }
        const services = this.suggestServices(dto);
        return {
            type: 'services',
            text: services.join('\n'),
            suggestions: services,
        };
    }
    greetingVariants(dto) {
        const botName = dto.botName || 'Chatbot';
        const business = dto.businessName || botName;
        const tones = ['friendly', 'professional', 'enthusiastic', 'concise'];
        return tones.map((t) => (0, chatbot_constants_1.defaultGreeting)(botName, business, t));
    }
    async suggestGreeting(dto) {
        const tone = dto.consultationTone || 'friendly';
        const botName = dto.botName || 'Chatbot';
        const business = dto.businessName || botName;
        const industry = dto.industry || 'dịch vụ';
        const template = (0, chatbot_constants_1.defaultGreeting)(botName, business, tone);
        if (!this.openAi.isConfigured())
            return template;
        try {
            const text = await this.openAi.chatCompletion({
                model: this.openAi.getDefaultModel(),
                maxTokens: 200,
                temperature: 0.7,
                messages: [
                    {
                        role: 'system',
                        content: 'Viết 1 câu chào ngắn (tối đa 2 câu) cho chatbot CSKH tiếng Việt. Không dùng emoji. Không bịa giá hay cam kết.',
                    },
                    {
                        role: 'user',
                        content: `Doanh nghiệp: ${business}. Ngành: ${industry}. Giọng điệu: ${tone}. Dịch vụ: ${dto.mainServices || 'chưa rõ'}.`,
                    },
                ],
            });
            return text || template;
        }
        catch {
            return template;
        }
    }
    suggestServices(dto) {
        const base = (0, chatbot_suggest_options_1.servicesForIndustry)(dto.industry);
        const existing = (dto.mainServices ?? '')
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        const merged = [...new Set([...existing, ...base])];
        return merged.slice(0, 12);
    }
};
exports.ChatbotSuggestService = ChatbotSuggestService;
exports.ChatbotSuggestService = ChatbotSuggestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService])
], ChatbotSuggestService);
