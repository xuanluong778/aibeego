/**
 * Deep landing-page copy helpers — distinct per-block text, no fake social proof.
 */

export type DetailPair = { title: string; description: string };

export type DepthBriefInput = {
  productService: string;
  brandName?: string;
  price?: string;
  targetCustomer: string;
  uspBenefits?: string;
  pageGoal?: 'lead' | 'sales' | 'signup' | 'consult' | 'event';
  extraNotes?: string;
  businessType?: string;
  painPoint?: string;
  offer?: string;
  tone?: 'professional' | 'bold' | 'friendly';
};

const GOAL_LABELS: Record<string, string> = {
  lead: 'Thu lead',
  sales: 'Bán hàng',
  signup: 'Đăng ký',
  consult: 'Tư vấn',
  event: 'Sự kiện',
};

/** Split USP / notes into distinct non-empty chunks. */
export function splitCopyChunks(text: string, min = 3, max = 6): string[] {
  const parts = String(text || '')
    .split(/[.;\n|/•]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const out = parts.slice(0, max);
  while (out.length < min) {
    out.push(`Giá trị ${out.length + 1}: rõ ràng, đo được, phù hợp mục tiêu.`);
  }
  return out;
}

export function deepenBenefitPairs(
  titles: string[],
  details: string[] | undefined,
  painPoints: string[],
  audience: string,
  usp: string,
): DetailPair[] {
  const chunks = details?.length
    ? details
    : splitCopyChunks(usp, Math.max(titles.length, 3), titles.length + 2);
  return titles.slice(0, 8).map((title, i) => {
    const pain = painPoints[i];
    const detail = chunks[i] || chunks[0] || usp;
    const description = pain
      ? `Giải quyết: ${pain.replace(/\.$/, '')}. ${detail}`.slice(0, 280)
      : `Dành cho ${audience}: ${detail}`.slice(0, 280);
    return { title: title.slice(0, 120), description };
  });
}

export function deepenFeaturePairs(
  titles: string[],
  details: string[] | undefined,
  usp: string,
  offer: string,
): DetailPair[] {
  const chunks = details?.length
    ? details
    : splitCopyChunks(usp, Math.max(titles.length, 3), titles.length + 2);
  return titles.slice(0, 8).map((title, i) => ({
    title: title.slice(0, 120),
    description: (chunks[i] || (offer ? `Điểm khác biệt gắn với offer: ${offer}` : usp)).slice(
      0,
      280,
    ),
  }));
}

export function deepenProcessPairs(
  existingTitles: string[],
  steps: DetailPair[] | undefined,
  featureTitles: string[],
  goal: string,
  audience: string,
): DetailPair[] {
  if (steps?.length) {
    return steps.slice(0, 6).map((s) => ({
      title: s.title.slice(0, 120),
      description: s.description.slice(0, 280),
    }));
  }
  const titles =
    existingTitles.length >= 2
      ? existingTitles
      : featureTitles.length
        ? featureTitles.slice(0, 4)
        : ['Đăng ký', 'Tư vấn', 'Triển khai', 'Đo kết quả'];
  const goalLabel = (GOAL_LABELS[goal] || goal || 'chuyển đổi').toLowerCase();
  return titles.slice(0, 5).map((title, i) => ({
    title: title.slice(0, 120),
    description: [
      `Bước ${i + 1} giúp ${audience} tiến tới mục tiêu ${goalLabel} — rõ đầu vào, rõ đầu ra.`,
      `Thực hiện nhanh, có checklist — tránh lãng phí thời gian của ${audience}.`,
      `Chốt kết quả đo được trước khi chuyển bước tiếp theo.`,
      `Bàn giao / follow-up để giữ momentum sau khi hoàn tất.`,
    ][i % 4]!.slice(0, 280),
  }));
}

export function buildDeepFallbackNarrative(brief: DepthBriefInput) {
  const product = brief.productService.trim() || 'Giải pháp';
  const brand = brief.brandName?.trim() || product;
  const audience = brief.targetCustomer.trim() || 'khách hàng mục tiêu';
  const goal = brief.pageGoal || 'lead';
  const goalLabel = GOAL_LABELS[goal] || 'Thu lead';
  const businessType = (brief.businessType || '').trim() || 'doanh nghiệp';
  const pain =
    (brief.painPoint || '').trim() ||
    `${audience} đang mất thời gian / chi phí vì thiếu quy trình ${product.toLowerCase()} rõ ràng`;
  const offer = (brief.offer || '').trim() || brief.price?.trim() || '';
  const tone = brief.tone || 'professional';
  const uspRaw = (brief.uspBenefits || '').trim();
  const usp =
    uspRaw ||
    `${brand} giúp ${audience} trong ngành ${businessType} đạt ${goalLabel.toLowerCase()} nhờ ${product} — rõ lộ trình, rõ kết quả.`;

  const painPoints = [
    pain,
    `Thông điệp / offer chưa đủ rõ để ${audience} quyết định nhanh`,
    `Thiếu quy trình ${goalLabel.toLowerCase()} có thể đo và tối ưu liên tục`,
  ].map((s) => s.slice(0, 200));

  const benefits = [
    `Giải pháp ${product} gắn đúng nỗi đau của ${audience}`,
    `Lộ trình ${goalLabel.toLowerCase()} rõ ràng — biết bước tiếp theo`,
    offer
      ? `Offer rõ ràng: ${offer}`
      : `Tư vấn minh bạch — không bịa số liệu hay cam kết ảo`,
    `Phù hợp ${businessType} muốn tăng trưởng bền vững`,
  ].map((s) => s.slice(0, 200));

  const benefitDetails = [
    `Thay vì copy chung chung, trang tập trung vào vấn đề: ${pain.slice(0, 120)}.`,
    `Mỗi bước đều hướng tới mục tiêu ${goalLabel.toLowerCase()} của ${audience}.`,
    offer
      ? `Offer được nêu rõ để giảm ma sát quyết định: ${offer}.`
      : `USP được diễn giải thành lợi ích thực tế, không dùng số liệu bịa.`,
    `Ngôn ngữ ${tone} — chuyên nghiệp nhưng dễ hiểu với ${audience}.`,
  ];

  const features = [
    `Định vị rõ cho ${businessType}`,
    `Thông điệp theo pain → USP → CTA`,
    `Form / CTA phục vụ mục tiêu ${goalLabel.toLowerCase()}`,
    `Nội dung đủ sâu để thuyết phục ${audience}`,
  ];

  const featureDetails = [
    `Bám ngành ${businessType} và đối tượng ${audience} — tránh template “một câu cho mọi ngành”.`,
    `Pain point được chuyển thành lợi ích và FAQ objection handling.`,
    `CTA và form headline khớp goal ${goalLabel.toLowerCase()}.`,
    `Độ dài copy đủ để giải thích giá trị — không chỉ 3 từ chung chung.`,
  ];

  const processSteps: DetailPair[] = [
    {
      title: '1. Nắm nhu cầu',
      description: `Thu thập ngữ cảnh của ${audience} (pain, mục tiêu, ràng buộc) trước khi đề xuất.`,
    },
    {
      title: '2. Đề xuất rõ',
      description: `Trình bày ${product} + USP theo mục tiêu ${goalLabel.toLowerCase()}${
        offer ? ` và offer ${offer}` : ''
      }.`,
    },
    {
      title: '3. Chốt bước tiếp',
      description: `Hướng ${audience} tới hành động cụ thể trên trang (form / CTA) — đo được.`,
    },
    {
      title: '4. Follow-up',
      description: `Sau đăng ký: phản hồi nhanh, không hứa doanh thu / rating giả.`,
    },
  ];

  const toneLead =
    tone === 'bold'
      ? `${brand}: ${product} giúp ${audience} chốt ${goalLabel.toLowerCase()} nhanh hơn`
      : tone === 'friendly'
        ? `${brand} đồng hành cùng ${audience} với ${product}`
        : `${brand} — ${product} cho ${audience} muốn ${goalLabel.toLowerCase()} bền vững`;

  return {
    headline: toneLead.slice(0, 160),
    subheadline: `${pain.slice(0, 100)}. ${usp.slice(0, 200)}`.slice(0, 320),
    painPoints,
    benefits,
    benefitDetails,
    features,
    featureDetails,
    processSteps,
    usp: usp.slice(0, 240),
    faq: [
      {
        question: `${product} phù hợp với ai?`,
        answer: `Phù hợp ${audience} trong ${businessType} đang gặp: ${pain.slice(0, 140)}.`,
      },
      {
        question: 'Bắt đầu như thế nào?',
        answer: `Điền form — đội ngũ liên hệ để làm rõ nhu cầu và đề xuất bước ${goalLabel.toLowerCase()} phù hợp. Không yêu cầu cung cấp số liệu không có thật.`,
      },
      {
        question: offer ? 'Offer gồm những gì?' : 'Chi phí thế nào?',
        answer: offer
          ? `Offer hiện tại: ${offer}. Chi tiết sẽ được xác nhận khi tư vấn — không bịa % ưu đãi.`
          : brief.price?.trim()
            ? `Tham chiếu: ${brief.price}. Báo giá chính xác sau khi nắm scope.`
            : 'Chi phí phụ thuộc scope — nhận báo giá sau khi để lại thông tin.',
      },
      {
        question: 'Có cam kết kết quả không?',
        answer:
          'Cam kết quy trình rõ và hỗ trợ minh bạch. Không dùng testimonial / rating / doanh thu giả trên trang.',
      },
    ],
    guarantee: `Cam kết làm việc minh bạch với ${audience}: phản hồi rõ ràng, không phát sinh phí ẩn, không bịa chứng nhận hay số liệu.`,
    pricingCopy: offer
      ? `Offer: ${offer}. Để lại thông tin để nhận chi tiết áp dụng.`
      : brief.price?.trim()
        ? `Tham chiếu giá: ${brief.price}. Đăng ký để nhận tư vấn gói phù hợp.`
        : `Nhận đề xuất gói ${product} phù hợp ${audience} — báo giá sau khi nắm nhu cầu.`,
    leadFormHeadline:
      goal === 'event'
        ? 'Đăng ký giữ chỗ — nhận hướng dẫn tham dự'
        : goal === 'sales'
          ? 'Nhận tư vấn / báo giá phù hợp nhu cầu'
          : `Đăng ký — ${goalLabel.toLowerCase()} với ${brand}`,
    cta:
      goal === 'sales'
        ? 'Nhận báo giá ngay'
        : goal === 'event'
          ? 'Giữ chỗ ngay'
          : goal === 'signup'
            ? 'Đăng ký dùng thử'
            : 'Nhận tư vấn miễn phí',
  };
}
