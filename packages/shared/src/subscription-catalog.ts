/** Versioned catalogue: legacy msp-* plans keep their purchased rights and prices. */
export type PlanTier = 'BASIC' | 'PRO' | 'VIP';
export const BILLING_MONTHS = [1, 6, 12] as const;
export const PLAN_FEATURE_LABELS: Record<string, string> = {
  overview: 'Tổng quan kinh doanh',
  content_ai: 'Content AI, thương hiệu & kiểm tra Content Ads',
  video_transcription: 'Phiên âm video & kịch bản quay',
  content_auto_post: 'Thư viện bài viết, lịch đăng & Auto Post',
  crm: 'CRM, khách hàng & phễu bán hàng',
  landing_pages: 'Landing Page & form thu lead',
  appointments_services: 'Lịch hẹn & quản lý dịch vụ',
  chatbot_cskh: 'Chatbot chăm sóc khách hàng',
  email_marketing: 'Chiến dịch Email Marketing',
  zalo_marketing: 'Kết nối Zalo OA',
  work_management: 'Quản lý công việc & dự án',
  reports: 'Báo cáo',
  marketing_autopilot: 'Marketing Autopilot',
  marketing_automation: 'Luồng chăm sóc tự động nhiều bước',
  messaging_campaigns: 'Chiến dịch nhắn tin',
  email_automation: 'Chuỗi email tự động',
  ads_performance: 'Ads & Attribution',
  hrm: 'Nhân sự, ca làm & chấm công',
  sales: 'Bán hàng',
  inventory: 'Kho & mua hàng',
  finance: 'Tài chính',
  business_goals: 'Mục tiêu kinh doanh',
  priority_support: 'Hỗ trợ ưu tiên',
  onboarding: 'Hướng dẫn thiết lập',
};
const basicFeatures = [
  'overview',
  'content_ai',
  'video_transcription',
  'content_auto_post',
  'crm',
  'landing_pages',
  'appointments_services',
  'chatbot_cskh',
  'email_marketing',
  'zalo_marketing',
  'work_management',
  'reports',
];
const proFeatures = [
  ...basicFeatures,
  'marketing_autopilot',
  'marketing_automation',
  'messaging_campaigns',
  'email_automation',
  'ads_performance',
  'hrm',
  'sales',
  'inventory',
  'finance',
  'business_goals',
  'onboarding',
];
export const PLAN_LIMIT_LABELS = {
  users: 'Người dùng',
  branches: 'Chi nhánh',
  fanpages: 'Fanpage kết nối',
  zaloOas: 'Zalo OA',
  adAccounts: 'Tài khoản quảng cáo',
  customers: 'Khách hàng CRM',
  landingPages: 'Landing Page xuất bản',
  domains: 'Tên miền kết nối',
  bots: 'Chatbot',
  knowledgeBases: 'Kho kiến thức',
  flows: 'Luồng tự động',
  posts: 'Lượt đăng/tháng',
  images: 'Ảnh AI/tháng',
  chatbotReplies: 'Câu trả lời AI/tháng',
  transcriptionMinutes: 'Phút phiên âm/tháng',
  sourcePages: 'Trang kiến thức đồng bộ/tháng',
  emails: 'Email marketing/tháng',
  automationSteps: 'Bước tự động/tháng',
  storageMb: 'Dung lượng (MB)',
  uploadMb: 'Dung lượng mỗi tệp (MB)',
} as const;
export type PlanLimit = keyof typeof PLAN_LIMIT_LABELS;
export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  monthlyPrice: number;
  monthlyCredits: number;
  features: string[];
  limits: Record<PlanLimit, number>;
  onboardingMinutes: number;
};
export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  BASIC: {
    tier: 'BASIC',
    name: 'Basic',
    monthlyPrice: 399000,
    monthlyCredits: 5000,
    features: basicFeatures,
    onboardingMinutes: 0,
    limits: {
      users: 2,
      branches: 1,
      fanpages: 2,
      zaloOas: 1,
      adAccounts: 1,
      customers: 2000,
      landingPages: 3,
      domains: 1,
      bots: 1,
      knowledgeBases: 1,
      flows: 0,
      posts: 100,
      images: 10,
      chatbotReplies: 300,
      transcriptionMinutes: 30,
      sourcePages: 50,
      emails: 1000,
      automationSteps: 0,
      storageMb: 2048,
      uploadMb: 20,
    },
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    monthlyPrice: 800000,
    monthlyCredits: 15000,
    features: proFeatures,
    onboardingMinutes: 45,
    limits: {
      users: 5,
      branches: 3,
      fanpages: 10,
      zaloOas: 3,
      adAccounts: 5,
      customers: 10000,
      landingPages: 15,
      domains: 5,
      bots: 3,
      knowledgeBases: 3,
      flows: 20,
      posts: 500,
      images: 40,
      chatbotReplies: 1000,
      transcriptionMinutes: 120,
      sourcePages: 300,
      emails: 5000,
      automationSteps: 20000,
      storageMb: 10240,
      uploadMb: 50,
    },
  },
  VIP: {
    tier: 'VIP',
    name: 'VIP',
    monthlyPrice: 1799000,
    monthlyCredits: 45000,
    features: [...proFeatures, 'priority_support'],
    onboardingMinutes: 120,
    limits: {
      users: 15,
      branches: 10,
      fanpages: 30,
      zaloOas: 10,
      adAccounts: 15,
      customers: 50000,
      landingPages: 50,
      domains: 15,
      bots: 10,
      knowledgeBases: 10,
      flows: 100,
      posts: 2000,
      images: 120,
      chatbotReplies: 3000,
      transcriptionMinutes: 360,
      sourcePages: 1500,
      emails: 20000,
      automationSteps: 100000,
      storageMb: 51200,
      uploadMb: 100,
    },
  },
};
export function planTierFromCode(code?: string | null): PlanTier | null {
  const match = /^abg-(basic|pro|vip)-(1|6|12)m$/.exec(code ?? '');
  return match ? (match[1]!.toUpperCase() as PlanTier) : null;
}
export function planDefinition(code?: string | null): PlanDefinition | null {
  const tier = planTierFromCode(code);
  return tier ? PLAN_DEFINITIONS[tier] : null;
}
/** Six-month Pro/VIP purchases include one additional month of service. */
export function planBonusMonths(code?: string | null): number {
  return code === 'abg-pro-6m' || code === 'abg-vip-6m' ? 1 : 0;
}
export function buildPlanCatalog() {
  return (Object.keys(PLAN_DEFINITIONS) as PlanTier[]).flatMap((tier, index) => {
    const definition = PLAN_DEFINITIONS[tier];
    return BILLING_MONTHS.map((durationMonths) => {
      const priceVnd = definition.monthlyPrice * (durationMonths === 12 ? 10 : durationMonths);
      return {
        code: `abg-${tier.toLowerCase()}-${durationMonths}m`,
        name: `Ai Bee Go ${definition.name} — ${durationMonths} tháng`,
        durationMonths,
        priceVnd,
        priceMonthly: Math.round((priceVnd / durationMonths) * 100) / 100,
        savingsAmount: definition.monthlyPrice * durationMonths - priceVnd,
        highlightLabel: tier === 'PRO' ? 'Khuyên dùng' : null,
        sortOrder: index * 100 + durationMonths,
        creditsIncluded: definition.monthlyCredits,
        features: definition.features,
        isActive: true,
      };
    });
  });
}
/** Match whole segments; user-controlled suffixes cannot bypass a restricted prefix. */
export function requiredPlanFeature(rawPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath.split('?')[0]!);
  } catch {
    decoded = rawPath.split('?')[0]!;
  }
  const path = decoded
    .replace(/\/{2,}/g, '/')
    .replace(/^\/api\/v1\//i, '')
    .replace(/^\//, '')
    .toLowerCase();
  const rules: Array<[string, string]> = [
    ['zalo-marketing/campaigns', 'messaging_campaigns'],
    ['email-marketing/automations', 'email_automation'],
    ['automation/flows', 'marketing_automation'],
    ['automation/messaging-campaigns', 'messaging_campaigns'],
    ['marketing-autopilot', 'marketing_autopilot'],
    ['marketing', 'marketing_automation'],
    ['campaigns', 'marketing_automation'],
    ['hrm', 'hrm'],
    ['employees', 'hrm'],
    ['funnel-builder', 'marketing_automation'],
    ['sales', 'sales'],
    ['finance', 'finance'],
    ['business-goals', 'business_goals'],
    ['ad-performance', 'ads_performance'],
    ['ai-ads-manager', 'ads_performance'],
    ['ads-actions', 'ads_performance'],
    ['attribution', 'ads_performance'],
  ];
  return rules.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? null;
}
/** Billing anniversaries are UTC, clamped to the last day of short months. */
export function billingAnniversary(start: Date, months: number): Date {
  const date = new Date(start);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}
export function currentBillingMonth(start: Date, now: Date) {
  let index = Math.max(
    0,
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth(),
  );
  if (billingAnniversary(start, index) > now) index = Math.max(0, index - 1);
  return {
    index,
    start: billingAnniversary(start, index),
    end: billingAnniversary(start, index + 1),
  };
}
