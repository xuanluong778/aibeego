import type { ChatbotBot } from '@/types/chatbot-cskh';

const EDITABLE_FIELDS = [
  'botName', 'websiteUrl', 'businessName', 'industry', 'hotline',
  'mainServices', 'consultationTone', 'greeting', 'allowedDomains', 'status',
] as const;

export type ChatbotBotWriteInput = Partial<Pick<ChatbotBot, (typeof EDITABLE_FIELDS)[number]>>;

/** GET responses include server metadata; write requests contain only editable fields. */
export function toChatbotBotPayload(input: Partial<ChatbotBot>): ChatbotBotWriteInput {
  const payload: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      payload[key] = input[key];
    }
  }
  return payload as ChatbotBotWriteInput;
}
