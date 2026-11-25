/** Credit units are product allowances, not a cash balance. See docs/credit-economy-20261122.md. */
export const CREDIT_PRICING = [
  { featureCode: 'content_ai.generate', name: 'Content AI — tạo nội dung', creditCost: 20, description: 'Chỉ trừ khi tạo content thành công; gợi ý và các thao tác khác trong Content miễn phí', sortOrder: 10 },
  { featureCode: 'content_ai.suggest', name: 'Content AI — gợi ý ngắn', creditCost: 0, description: 'Miễn phí trong phần Content; không trừ credit khi bấm gợi ý', sortOrder: 15 },
  { featureCode: 'content_ai.image', name: 'Tạo ảnh AI', creditCost: 1000, description: 'Mỗi ảnh tiêu chuẩn; chỉ tính khi có nhà cung cấp tạo ảnh thực tế', sortOrder: 20 },
  { featureCode: 'assistant.chat', name: 'Trợ lý AI — chat', creditCost: 20, description: 'Mỗi lượt trợ lý AI', sortOrder: 30 },
  { featureCode: 'assistant.write', name: 'Trợ lý AI — soạn thảo', creditCost: 40, description: 'Mỗi lần soạn thảo AI', sortOrder: 40 },
  { featureCode: 'chatbot.reply', name: 'Chatbot CSKH', creditCost: 6, description: 'Mỗi câu trả lời AI; trả lời theo luật không tính credit', sortOrder: 50 },
  { featureCode: 'video.transcribe', name: 'Phiên âm video', creditCost: 100, description: 'Mỗi phút âm thanh; tính theo giây, làm tròn credit; không tính trùng đoạn chồng lấn', sortOrder: 60 },
  { featureCode: 'funnel.ai_suggest', name: 'Phễu — gợi ý AI', creditCost: 60, description: 'Mỗi lần gọi AI tạo/gợi ý phễu', sortOrder: 70 },
  { featureCode: 'email_ai.subject', name: 'Email — nội dung AI', creditCost: 10, description: 'Mỗi lần gợi ý tiêu đề/nội dung email', sortOrder: 80 },
  { featureCode: 'ads_ai.creative', name: 'Quảng cáo — creative AI', creditCost: 60, description: 'Mỗi lần gọi AI tạo/phân tích quảng cáo', sortOrder: 90 },
  { featureCode: 'rag.query', name: 'Knowledge Base — trả lời AI', creditCost: 10, description: 'Mỗi lần tổng hợp bằng AI; tìm kiếm dữ liệu thuần túy miễn phí', sortOrder: 100 },
  { featureCode: 'ai.analysis', name: 'Phân tích AI', creditCost: 30, description: 'Mỗi lần gọi phân tích AI', sortOrder: 110 },
  { featureCode: 'landing_page.inline_ai', name: 'Landing Page — gợi ý chữ', creditCost: 10, description: 'Mỗi lần gọi AI gợi ý trường nội dung', sortOrder: 120 },
  { featureCode: 'landing_page.generate', name: 'Landing Page — tạo nội dung', creditCost: 80, description: 'Mỗi lần gọi AI tạo nội dung trang', sortOrder: 130 },
  { featureCode: 'ai.vision', name: 'Phân tích ảnh bằng AI', creditCost: 60, description: 'Mỗi lần phân tích ảnh, không phải tạo ảnh', sortOrder: 140 },
  { featureCode: 'email.send', name: 'Gửi email Marketing', creditCost: 2, description: 'Mỗi người nhận email marketing; email hệ thống/OTP không tính credit', sortOrder: 150 },
] as const;

export function transcriptionCreditAmount(ratePerMinute: number, seconds: number): number {
  if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0 || !Number.isFinite(seconds) || seconds <= 0)
    throw new Error('Invalid transcription credit rate/duration');
  return Math.max(1, Math.ceil(ratePerMinute * seconds / 60));
}

/** Expensive models and long requests consume more than the base feature rate. */
export function aiCreditUnits(params: { model: string; inputChars: number; maxTokens: number; vision?: boolean }): number {
  const model = params.model.toLowerCase();
  const multiplier = /mini|nano/.test(model) ? 1 : /gpt-4o|gpt-4\.1/.test(model) ? 15 : 30;
  const tokens = Math.ceil(Math.max(0, params.inputChars) / 3) + Math.max(1, params.maxTokens);
  return multiplier * Math.max(1, Math.ceil(tokens / 6000));
}

/** Only classifies actual provider calls; ordinary CRUD never consumes AI credit. */
export function creditFeatureForPath(path: string): string {
  path = path.split('?')[0]!.toLowerCase();
  if (/landing-pages/.test(path)) return /inline|suggest.*field/.test(path) ? 'landing_page.inline_ai' : 'landing_page.generate';
  if (/funnel/.test(path)) return 'funnel.ai_suggest';
  if (/assistant/.test(path)) return 'assistant.chat';
  if (/chatbot/.test(path)) return 'chatbot.reply';
  if (/email-marketing/.test(path)) return 'email_ai.subject';
  if (/ai-ads|ad-performance|ads-manager/.test(path)) return 'ads_ai.creative';
  if (/rag|knowledge/.test(path)) return 'rag.query';
  if (/content-marketing|auto-post|marketing-autopilot/.test(path))
    return /\/(?:[^/]*suggest[^/]*|[^/]*titles[^/]*|optimize-cta)\/?$/.test(path) ? 'content_ai.suggest' : 'content_ai.generate';
  return 'ai.analysis';
}
