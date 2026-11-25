import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { creditCallContext, type CreditCallContext } from '@marketingspa/database';
import { aiCreditUnits } from '@marketingspa/shared';
import { randomUUID } from 'node:crypto';
import { CreditService } from '../credit/credit.service';

export interface OpenAiChatMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

export interface OpenAiFunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export interface OpenAiChatParams {
  model?: string;
  messages: OpenAiChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  /** Abort fetch after N ms (default 20s). */
  timeoutMs?: number;
}

export interface OpenAiChatWithToolsParams extends OpenAiChatParams {
  tools?: OpenAiFunctionTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export type OpenAiChatWithToolsResult = {
  message: OpenAiChatMessage;
  finishReason?: string;
};

export interface OpenAiStatus {
  configured: boolean;
  model: string;
  baseUrl: string;
  ok: boolean;
  error?: string;
}

@Injectable()
export class OpenAiService {
  constructor(private readonly config: ConfigService, private readonly credit: CreditService) {}

  private async flatContentFetch(url: string, init: RequestInit, context: CreditCallContext): Promise<Response> {
    const state = context.flatContentBilling!;
    while (state.pending) await state.pending.catch(() => undefined);
    if (state.charged) return fetch(url, init);
    let response: Response | undefined;
    const pending = this.credit.runPaidFeature({
      organizationId: context.organizationId!, featureCode: context.featureCode,
      referenceId: state.referenceId,
      metadata: { flatPerRequest: true, pricingVersion: 'content-flat-20261122' },
      fn: async paid => {
        const result = await fetch(url, init);
        if (!result.ok) throw new Error(`OpenAI ${result.status}`);
        paid.markProviderStarted();
        return result;
      },
    }).then(result => { response = result; state.charged = true; });
    state.pending = pending;
    try { await pending; return response!; }
    finally { if (state.pending === pending) state.pending = undefined; }
  }

  private async meteredFetch(url: string, init: RequestInit, featureCode?: string): Promise<Response> {
    const context = creditCallContext.getStore();
    if (context?.contentEditorFree) return fetch(url, init);
    if (!context?.organizationId) throw new BadRequestException({ code: 'CREDIT_CONTEXT_REQUIRED', message: 'Không xác định được tài khoản tính AI credit' });
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const model = body.model || this.getDefaultModel();
    const imageCount = (body.messages || []).reduce((sum: number, message: {content?: unknown}) => sum +
      (Array.isArray(message.content) ? message.content.filter((part: {type?:string}) => part.type === 'image_url').length : 0), 0);
    const units = aiCreditUnits({ model, inputChars: JSON.stringify(body.messages || [], (key, value) =>
      key === 'url' && typeof value === 'string' && value.startsWith('data:') ? '[image]' : value).length,
      maxTokens: body.max_tokens || 500, vision: featureCode === 'ai.vision' }) * Math.max(1, imageCount);
    const code = featureCode || context.featureCode;
    try {
      if (context.flatContentBilling && !context.prepaid && code === context.featureCode)
        return await this.flatContentFetch(url, init, context);
      // The outer workflow covers its first basic provider call. Charge only additional
      // calls/long-context/premium-model units so tool loops cannot run unmetered.
      const includedUnits = context.prepaid && !context.providerCalls && code === context.featureCode ? 1 : 0;
      const extraUnits = units - includedUnits;
      if (extraUnits === 0) {
        const response = await fetch(url, init);
        if (response.ok) { context.providerCalls = (context.providerCalls || 0) + 1; context.markProviderStarted?.(); }
        return response;
      }
      return await this.credit.runPaidFeature({ organizationId: context.organizationId,
        featureCode: code, referenceId: `${context.referenceId}:${randomUUID()}`,
        amount: (await this.credit.getFeatureCost(code)) * extraUnits,
        metadata: { model, units: extraUnits, meteringAddon: context.prepaid === true, pricingVersion: '20261122' },
        fn: async paid => {
          const response = await fetch(url, init);
          if (!response.ok) throw new Error(`OpenAI ${response.status}`);
          paid.markProviderStarted();
          if (context.prepaid) { context.providerCalls = (context.providerCalls || 0) + 1; context.markProviderStarted?.(); }
          return response;
        },
      });
    } catch (error) {
      // Do not let a feature's deterministic fallback swallow billing rejection.
      if (error instanceof HttpException) context.billingError = error;
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  getApiKey(): string | undefined {
    const key = this.config.get<string>('OPENAI_API_KEY')?.trim();
    return key || undefined;
  }

  getDefaultModel(): string {
    return this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
  }

  getBaseUrl(): string {
    return (this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(
      /\/$/,
      '',
    );
  }

  async chatCompletion(params: OpenAiChatParams): Promise<string> {
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
          const err = (await res.json()) as { error?: { message?: string } };
          detail = err.error?.message ?? '';
        } catch {
          detail = await res.text().catch(() => '');
        }
        if (controller.signal.aborted) throw new Error('OPENAI_BODY_ABORTED');
        throw new Error(`OpenAI ${res.status}${detail ? `: ${detail}` : ''}`);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return (data.choices?.[0]?.message?.content ?? '').trim();
    } catch (err) {
      if (controller.signal.aborted || (err as Error).name === 'AbortError') {
        throw new Error(`OpenAI timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async chatCompletionWithTools(
    params: OpenAiChatWithToolsParams,
  ): Promise<OpenAiChatWithToolsResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY chưa được cấu hình');
    }

    const timeoutMs = params.timeoutMs ?? 20_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const body: Record<string, unknown> = {
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

    let res: Response;
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
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new Error(`OpenAI timeout after ${timeoutMs}ms`);
      }
      throw err;
    }
    clearTimeout(timer);

    if (!res.ok) {
      let detail = '';
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        detail = err.error?.message ?? '';
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`OpenAI ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: OpenAiChatMessage;
      }>;
    };
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
  async chatCompletionVision(params: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    messages: Array<{
      role: string;
      content:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string; detail?: string } }
          >;
    }>;
  }): Promise<string> {
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
        const err = (await res.json()) as { error?: { message?: string } };
        detail = err.error?.message ?? '';
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`OpenAI vision ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? '').trim();
  }

  /** Whisper / gpt-4o-mini-transcribe compatible audio transcription. */
  async transcribeAudio(params: {
    buffer: Buffer;
    filename: string;
    mimeType?: string;
    language?: string;
    model?: string;
  }): Promise<{ text: string; language?: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY chưa được cấu hình');
    }

    const model =
      params.model?.trim() ||
      this.config.get<string>('OPENAI_TRANSCRIBE_MODEL')?.trim() ||
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
    if (!creditCallContext.getStore()?.prepaid) throw new BadRequestException('Phiên âm cần tác vụ có thời lượng để tính credit');
    const res = await fetch(`${this.getBaseUrl()}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      let detail = '';
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        detail = err.error?.message ?? '';
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`OpenAI transcribe ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const data = (await res.json()) as { text?: string; language?: string };
    return {
      text: (data.text ?? '').trim(),
      language: data.language,
    };
  }

  async getStatus(testConnection = false): Promise<OpenAiStatus> {
    const base: OpenAiStatus = {
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
    } catch (err) {
      return {
        ...base,
        ok: false,
        error: err instanceof Error ? err.message : 'Không kết nối được OpenAI',
      };
    }
  }
}
