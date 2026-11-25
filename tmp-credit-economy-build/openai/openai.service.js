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
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const node_crypto_1 = require("node:crypto");
const credit_service_1 = require("../credit/credit.service");
let OpenAiService = class OpenAiService {
    config;
    credit;
    constructor(config, credit) {
        this.config = config;
        this.credit = credit;
    }
    async meteredFetch(url, init, featureCode) {
        const context = database_1.creditCallContext.getStore();
        if (context?.prepaid) {
            const response = await fetch(url, init);
            if (response.ok)
                context.markProviderStarted?.();
            return response;
        }
        if (!context?.organizationId)
            throw new common_1.BadRequestException({ code: 'CREDIT_CONTEXT_REQUIRED', message: 'Không xác định được tài khoản tính AI credit' });
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
        const model = body.model || this.getDefaultModel();
        const units = (0, shared_1.aiCreditUnits)({ model, inputChars: JSON.stringify(body.messages || [], (key, value) => key === 'url' && typeof value === 'string' && value.startsWith('data:') ? '[image]' : value).length,
            maxTokens: body.max_tokens || 500, vision: featureCode === 'ai.vision' });
        const code = featureCode || context.featureCode;
        try {
            return await this.credit.runPaidFeature({ organizationId: context.organizationId,
                featureCode: code, referenceId: `${context.referenceId}:${(0, node_crypto_1.randomUUID)()}`,
                amount: (await this.credit.getFeatureCost(code)) * units,
                metadata: { model, units, pricingVersion: '20261122' },
                fn: async (paid) => {
                    const response = await fetch(url, init);
                    if (!response.ok)
                        throw new Error(`OpenAI ${response.status}`);
                    paid.markProviderStarted();
                    return response;
                },
            });
        }
        catch (error) {
            // Do not let a feature's deterministic fallback swallow billing rejection.
            if (error instanceof common_1.HttpException)
                context.billingError = error;
            throw error;
        }
    }
    isConfigured() {
        return !!this.getApiKey();
    }
    getApiKey() {
        const key = this.config.get('OPENAI_API_KEY')?.trim();
        return key || undefined;
    }
    getDefaultModel() {
        return this.config.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    }
    getBaseUrl() {
        return (this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '');
    }
    async chatCompletion(params) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY chưa được cấu hình');
        }
        const timeoutMs = params.timeoutMs ?? 20_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await this.meteredFetch(`${this.getBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: params.model || this.getDefaultModel(),
                    messages: params.messages,
                    max_tokens: params.maxTokens ?? 500,
                    temperature: params.temperature ?? 0.4,
                    ...(params.responseFormat ? { response_format: { type: params.responseFormat } } : {}),
                }),
                signal: controller.signal,
            });
            // Keep the deadline active while reading the body as well as waiting for headers.
            if (!res.ok) {
                let detail = '';
                try {
                    const err = (await res.json());
                    detail = err.error?.message ?? '';
                }
                catch {
                    detail = await res.text().catch(() => '');
                }
                if (controller.signal.aborted)
                    throw new Error('OPENAI_BODY_ABORTED');
                throw new Error(`OpenAI ${res.status}${detail ? `: ${detail}` : ''}`);
            }
            const data = (await res.json());
            return (data.choices?.[0]?.message?.content ?? '').trim();
        }
        catch (err) {
            if (controller.signal.aborted || err.name === 'AbortError') {
                throw new Error(`OpenAI timeout after ${timeoutMs}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
    }
    async chatCompletionWithTools(params) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY chưa được cấu hình');
        }
        const timeoutMs = params.timeoutMs ?? 20_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const body = {
            model: params.model || this.getDefaultModel(),
            messages: params.messages,
            max_tokens: params.maxTokens ?? 500,
            temperature: params.temperature ?? 0.4,
        };
        if (params.responseFormat) {
            body.response_format = { type: params.responseFormat };
        }
        if (params.tools?.length) {
            body.tools = params.tools;
            body.tool_choice = params.toolChoice ?? 'auto';
        }
        let res;
        try {
            res = await this.meteredFetch(`${this.getBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        }
        catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                throw new Error(`OpenAI timeout after ${timeoutMs}ms`);
            }
            throw err;
        }
        clearTimeout(timer);
        if (!res.ok) {
            let detail = '';
            try {
                const err = (await res.json());
                detail = err.error?.message ?? '';
            }
            catch {
                detail = await res.text().catch(() => '');
            }
            throw new Error(`OpenAI ${res.status}${detail ? `: ${detail}` : ''}`);
        }
        const data = (await res.json());
        const choice = data.choices?.[0];
        const message = choice?.message ?? { role: 'assistant', content: '' };
        return {
            message: {
                role: message.role ?? 'assistant',
                content: message.content ?? '',
                tool_calls: message.tool_calls,
            },
            finishReason: choice?.finish_reason,
        };
    }
    /**
     * Multimodal chat (vision). `content` may be string or OpenAI content parts array.
     */
    async chatCompletionVision(params) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY chưa được cấu hình');
        }
        const res = await this.meteredFetch(`${this.getBaseUrl()}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: params.model || this.getDefaultModel(),
                messages: params.messages,
                max_tokens: params.maxTokens ?? 800,
                temperature: params.temperature ?? 0.2,
            }),
        }, 'ai.vision');
        if (!res.ok) {
            let detail = '';
            try {
                const err = (await res.json());
                detail = err.error?.message ?? '';
            }
            catch {
                detail = await res.text().catch(() => '');
            }
            throw new Error(`OpenAI vision ${res.status}${detail ? `: ${detail}` : ''}`);
        }
        const data = (await res.json());
        return (data.choices?.[0]?.message?.content ?? '').trim();
    }
    /** Whisper / gpt-4o-mini-transcribe compatible audio transcription. */
    async transcribeAudio(params) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY chưa được cấu hình');
        }
        const model = params.model?.trim() ||
            this.config.get('OPENAI_TRANSCRIBE_MODEL')?.trim() ||
            'gpt-4o-mini-transcribe';
        const form = new FormData();
        const blob = new Blob([new Uint8Array(params.buffer)], {
            type: params.mimeType || 'application/octet-stream',
        });
        form.append('file', blob, params.filename);
        form.append('model', model);
        const lang = params.language?.trim();
        if (lang && lang !== 'auto') {
            form.append('language', lang);
        }
        // API audio has no production callers; the worker meters known-duration chunks.
        // Require an explicit paid scope instead of silently billing an unknown duration.
        if (!database_1.creditCallContext.getStore()?.prepaid)
            throw new common_1.BadRequestException('Phiên âm cần tác vụ có thời lượng để tính credit');
        const res = await fetch(`${this.getBaseUrl()}/audio/transcriptions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
        });
        if (!res.ok) {
            let detail = '';
            try {
                const err = (await res.json());
                detail = err.error?.message ?? '';
            }
            catch {
                detail = await res.text().catch(() => '');
            }
            throw new Error(`OpenAI transcribe ${res.status}${detail ? `: ${detail}` : ''}`);
        }
        const data = (await res.json());
        return {
            text: (data.text ?? '').trim(),
            language: data.language,
        };
    }
    async getStatus(testConnection = false) {
        const base = {
            configured: this.isConfigured(),
            model: this.getDefaultModel(),
            baseUrl: this.getBaseUrl(),
            ok: false,
        };
        if (!base.configured) {
            return { ...base, error: 'OPENAI_API_KEY chưa được cấu hình trong .env' };
        }
        if (!testConnection) {
            return { ...base, ok: true };
        }
        try {
            await this.chatCompletion({
                messages: [{ role: 'user', content: 'Trả lời đúng 1 từ: ok' }],
                maxTokens: 5,
                temperature: 0,
            });
            return { ...base, ok: true };
        }
        catch (err) {
            return {
                ...base,
                ok: false,
                error: err instanceof Error ? err.message : 'Không kết nối được OpenAI',
            };
        }
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService, credit_service_1.CreditService])
], OpenAiService);
