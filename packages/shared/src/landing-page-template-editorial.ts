import type {
  TemplateContentBrief,
  TemplateContentProposal,
  TemplateContentSectionPlan,
  TemplateContentSlot,
} from './landing-page-template-content';
import { isGenericTemplateHeading } from './landing-page-template-copy-quality';

export type SourceSection = {
  heading: string;
  parent: string;
  level: number;
  paragraphs: string[];
};
export type EditorialFact = {
  id: string;
  kind: 'overview' | 'problem' | 'benefit' | 'curriculum' | 'audience' | 'method' | 'registration';
  title: string;
  text: string;
};
export type TemplateEditorialContext = {
  kind: 'course';
  topic: string;
  brand: string;
  facts: EditorialFact[];
};
export type SourceEntry = { tag: string; text: string; order: number };

export function cleanSourceText(text: string) {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}
/** Prefer complete sentences; never silently chop a paragraph at a character offset. */
export function completeCopy(text: string, max: number, alternative = ''): string {
  text = cleanSourceText(text);
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).trim().length > max) break;
    result += sentence;
  }
  return result.trim() || alternative;
}
export function sourceSections(entries: SourceEntry[]): {
  sections: SourceSection[];
  text: string;
  firstH1: string;
} {
  const seen = new Set<string>(),
    sections: SourceSection[] = [];
  const hierarchy: { level: number; text: string }[] = [];
  let current: SourceSection = { heading: '', parent: '', level: 0, paragraphs: [] },
    firstH1 = '';
  sections.push(current);
  for (const entry of entries.sort((a, b) => a.order - b.order)) {
    const text = cleanSourceText(entry.text);
    if (!text || /^\d+$/.test(text) || /add anything here|just remove it/i.test(text)) continue;
    const key = text.toLocaleLowerCase('vi');
    if (/^h[1-6]$/.test(entry.tag)) {
      const level = Number(entry.tag[1]);
      while (hierarchy.length && hierarchy[hierarchy.length - 1]!.level >= level) hierarchy.pop();
      const parent = hierarchy.map((h) => h.text).join(' / ');
      hierarchy.push({ level, text });
      if (entry.tag === 'h1' && !firstH1) firstH1 = text;
      current = { heading: text, parent, level, paragraphs: [] };
      sections.push(current);
      // Duplicate mobile headings still update hierarchy, but never consume the text budget.
      if (!seen.has(key)) seen.add(key);
    } else if (!seen.has(key)) {
      seen.add(key);
      current.paragraphs.push(text);
    }
  }
  const unique = sections
    .filter(
      (s) =>
        s.paragraphs.length ||
        (s.heading && sections.filter((x) => x.heading === s.heading).length === 1),
    )
    .slice(0, 120);
  // Reserve space for every section rather than keeping only the beginning of a long page.
  const quota = Math.max(220, Math.floor(30000 / Math.max(1, unique.length)));
  const balanced = unique.map((section) => {
    let count = 0;
    const paragraphs = section.paragraphs.filter((paragraph) => {
      if (
        count + paragraph.length >
        Math.max(quota, paragraph.length <= 1200 ? paragraph.length : 0)
      )
        return false;
      count += paragraph.length;
      return true;
    });
    return { ...section, paragraphs };
  });
  const output: string[] = [];
  const bounded: SourceSection[] = [];
  let used = 0;
  for (const section of balanced) {
    const block = [section.heading, ...section.paragraphs].filter(Boolean).join('\n');
    if (block && used + block.length + 2 <= 32000) {
      output.push(block);
      bounded.push(section);
      used += block.length + 2;
    }
  }
  // The structured facts must obey the same budget as the text sent to the model.
  return { sections: bounded, text: output.join('\n\n'), firstH1 };
}

const unsafePromotion =
  /(?:ưu đãi|khuyến mãi|khuyến mại|quà tặng|tặng theme|tặng tool|tặng file|miễn phí|thu nhập|lương hấp dẫn|chứng chỉ|chứng nhận|cam kết|đảm bảo|24\s*\/\s*7|giá thường|hôm nay chỉ|\d[\d.,]*\s*(?:triệu|đồng|vnđ|vnd|₫))/i;
export function buildEditorialContext(source: {
  title: string;
  brand: string;
  text: string;
  sections?: SourceSection[];
}): TemplateEditorialContext | undefined {
  if (
    !/khóa học|khoá học|đào tạo|course|training/i.test(`${source.title} ${source.text}`) ||
    !source.sections?.length
  )
    return;
  const topic = /\bSEO\b/i.test(source.title)
    ? 'SEO'
    : cleanSourceText(source.title.replace(/^(?:khóa học|khoá học|đào tạo|course|training)\s*[:–—-]?\s*/i, ''));
  if (!topic) return;
  const facts: EditorialFact[] = [];
  for (const section of source.sections) {
    const heading = section.heading,
      context = `${section.parent} ${heading}`;
    let kind: EditorialFact['kind'] = /rào cản|khó khăn|vấn đề|sai lầm khi|pain point/i.test(
      context,
    )
      ? 'problem'
      : /ai nên|đối tượng|phù hợp với ai|dành cho ai/i.test(context)
        ? 'audience'
        : /quy trình|cách học|phương pháp|th[ựụ]c hành trên|theo dõi sát|đo lường/i.test(context)
          ? 'method'
          : /đăng ký|liên hệ|chuẩn bị/i.test(heading)
            ? 'registration'
            : /khóa học.*chuyên sâu|khoá học.*chuyên sâu|chương trình|giáo trình|bài học|module|curriculum/i.test(
                  section.parent.split(' / ').pop() || '',
                ) && section.level >= 3
              ? 'curriculum'
              : /lợi ích|giá trị|vì sao|nên chọn|kiến thức.*bài bản/i.test(context)
                ? 'benefit'
                : 'overview';
    if (unsafePromotion.test(heading) || unsafePromotion.test(section.parent)) continue;
    const paragraphs = section.paragraphs.filter(
      (p) =>
        !unsafePromotion.test(p) &&
        !/^[“"«]|ignore.*instructions|system prompt|api.?key|bỏ qua.*chỉ dẫn/i.test(p),
    );
    if (!paragraphs.length && kind !== 'curriculum') continue;
    if (kind === 'method' && /^bước\s*\d+/i.test(heading) && paragraphs[0]) {
      facts.push({
        id: `f${facts.length + 1}`,
        kind,
        title: paragraphs[0],
        text: paragraphs.slice(1).join(' '),
      });
    } else if (kind === 'audience') {
      // Preserve each explicit audience; skip the rhetorical introductory paragraph.
      for (const paragraph of paragraphs.filter(
        (p) => p.length <= 160 && !/[?？]/.test(p) && !/(?:^|\s)(?:để|và|với|của|cho)\s*$/i.test(p),
      ))
        facts.push({ id: `f${facts.length + 1}`, kind, title: paragraph, text: paragraph });
    } else {
      const text = paragraphs
        .map((p) => completeCopy(p, 900))
        .filter(Boolean)
        .map((p) => (/[.!?]$/.test(p) ? p : `${p.replace(/[:;]$/, '')}.`))
        .join(' ');
      if (heading || text)
        facts.push({
          id: `f${facts.length + 1}`,
          kind,
          title: heading || completeCopy(text, 100, source.title),
          text: completeCopy(text, 1200),
        });
    }
    if (facts.length >= 70) break;
  }
  const unique = facts.filter(
    (f, i, all) =>
      all.findIndex(
        (x) =>
          x.kind === f.kind && x.title.toLocaleLowerCase('vi') === f.title.toLocaleLowerCase('vi'),
      ) === i,
  );
  if (!unique.some((f) => f.kind === 'curriculum') || unique.length < 5) return;
  return { kind: 'course', topic, brand: source.brand, facts: unique };
}

type SectionRole =
  | 'identity'
  | 'hero'
  | 'problem'
  | 'benefit'
  | 'curriculum'
  | 'audience'
  | 'method'
  | 'registration'
  | 'faq'
  | 'consult'
  | 'sensitive';
export function editorialRole(slot: TemplateContentSlot): SectionRole {
  if (['SEO', 'Header', 'Footer'].includes(slot.blockType)) return 'identity';
  if (slot.blockType === 'Hero') return 'hero';
  if (slot.blockType === 'Benefits') return (slot.occurrence || 0) === 0 ? 'problem' : 'benefit';
  if (slot.blockType === 'Features')
    return (slot.occurrence || 0) === 0 ? 'curriculum' : 'registration';
  if (slot.blockType === 'Process') return 'audience';
  if (slot.blockType === 'Gallery') return 'method';
  if (slot.blockType === 'FAQ') return 'faq';
  if (slot.blockType === 'Product') return 'curriculum';
  if (['CTA', 'LeadForm'].includes(slot.blockType)) return 'consult';
  return 'sensitive';
}
export function editorialPlan(
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
): TemplateContentSectionPlan[] {
  const titles: Record<SectionRole, string> = {
    identity: brief.brandName,
    hero: `Khóa học ${brief.sourceContext!.topic} thực chiến`,
    problem: `Bạn đang gặp khó khăn khi tự học ${brief.sourceContext!.topic}?`,
    benefit: brief.sourceContext!.topic === 'SEO' ? 'Biến kiến thức SEO thành từng việc trên website' : 'Kết nối kiến thức với mục tiêu học của bạn',
    curriculum: `Lộ trình ${brief.sourceContext!.topic}: học nền tảng, hiểu cách triển khai`,
    audience: `Khóa học ${brief.sourceContext!.topic} có phù hợp với bạn?`,
    method: brief.sourceContext!.topic === 'SEO' ? 'Thực hành trên website, đọc kết quả từ dữ liệu' : 'Bạn sẽ học và thực hành như thế nào?',
    registration: 'Chuẩn bị trước khi tham gia khóa học',
    faq: 'Giải đáp trước khi đăng ký học',
    consult: 'Nhận tư vấn lộ trình học phù hợp',
    sensitive: 'Thông tin cần xác nhận',
  };
  const seen = new Set<string>();
  return slots
    .filter((s) => !seen.has(s.blockId) && !!seen.add(s.blockId))
    .map((s) => ({
      blockId: s.blockId,
      blockType: s.blockType,
      occurrence: s.occurrence || 0,
      question: titles[editorialRole(s)],
      purpose: `Vai trò ${editorialRole(s)} trong hành trình: giá trị → vấn đề → lợi ích → chương trình → đối tượng → phương pháp → hỏi đáp → đăng ký. Giữ thiết kế/vị trí; mỗi section một nhiệm vụ. Không dùng lại ý của section khác.`,
    }));
}
function factsFor(slot: TemplateContentSlot, brief: TemplateContentBrief) {
  const role = editorialRole(slot),
    facts = brief.sourceContext!.facts;
  if (role === 'registration') {
    const prep = facts.filter(
      (f) =>
        f.kind === 'method' && /đăng ký|máy tính|phân quyền|cài đặt|tham gia buổi/i.test(f.title),
    );
    if (prep.length) return prep;
  }
  const kind =
    role === 'hero' ? 'benefit' : role === 'consult' || role === 'faq' ? 'overview' : role;
  const direct = facts
    .filter((f) => f.kind === kind)
    .sort((a, b) => (role === 'method' ? b.text.length - a.text.length : 0));
  if (role === 'method') {
    const core = direct.filter((f) =>
      /th[ựụ]c hành|dự án thực tế|đo lường|hỗ trợ trực tiếp/i.test(f.title),
    );
    if (core.length) return core;
  }
  return direct;
}
function groupsFor(
  slot: TemplateContentSlot,
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
) {
  const facts = factsFor(slot, brief),
    ids = [
      ...new Set(slots.filter((s) => s.blockId === slot.blockId && s.itemId).map((s) => s.itemId)),
    ];
  const n = Math.max(1, ids.length),
    i = slot.itemIndex || 0;
  if (facts.length <= n) return facts.slice(i, i + 1);
  return facts.slice(
    Math.floor((i * facts.length) / n),
    Math.max(Math.floor((i * facts.length) / n) + 1, Math.floor(((i + 1) * facts.length) / n)),
  );
}
export function editorialFactIdsFor(
  slot: TemplateContentSlot,
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
) {
  if (slot.blockType === 'FAQ' && slot.itemId) {
    const kind = ['audience', 'curriculum', 'method', 'method', 'overview'][slot.itemIndex || 0];
    return brief.sourceContext!.facts.filter((f) => f.kind === kind).map((f) => f.id);
  }
  return slot.itemId ? groupsFor(slot, slots, brief).map((f) => f.id) : [];
}
export function coversCurriculumFact(text: string, fact: EditorialFact): boolean {
  const pairs: [RegExp, RegExp][] = [
    [/entity|stacking/i, /entity|stacking/i],
    [/internal link|liên kết nội bộ/i, /internal link|liên kết nội bộ/i],
    [/traffic user/i, /traffic user|lưu lượng người dùng/i],
    [/technical|schema/i, /technical|schema/i],
    [/audit/i, /audit/i],
    [/onpage/i, /onpage/i],
    [/cấu trúc|silo|cluster/i, /cấu trúc|silo|cluster/i],
    [/từ khoá|từ khóa|keyword|content/i, /từ khóa|từ khoá|keyword|content/i],
    [/google|crawl|index|ranking/i, /google|crawl|index|ranking/i],
    [/tổng kết/i, /tổng kết|hệ thống (?:lại|kiến thức)/i],
  ];
  const match = pairs.find(([source]) => source.test(fact.title));
  if (match) return match[1].test(text);
  const terms = fact.title.toLocaleLowerCase('vi').match(/[\p{L}]{5,}/gu) || [];
  return !terms.length || terms.some((term) => text.toLocaleLowerCase('vi').includes(term));
}

/** Short, connected copy from a recognized source fact; unknown subjects retain source wording. */
function conciseCourseFact(fact: EditorialFact, topic: string): { title: string; text: string } {
  const source = fact.title;
  if (topic === 'SEO') {
    const patterns: [RegExp, RegExp, string, string][] = [
      [/problem/, /thiếu lộ trình|không biết bắt đầu/i, 'Học nhiều nhưng chưa biết bắt đầu từ đâu?', 'Kiến thức rời rạc khiến bạn khó xác định việc cần làm trước. Một lộ trình rõ ràng giúp kết nối từng phần với công việc trên website.'],
      [/problem/, /không đo lường|không biết.*hiệu quả/i, 'Làm SEO nhưng chưa biết điều gì hiệu quả?', 'Khi chưa biết đọc dữ liệu, bạn khó đánh giá công việc đã làm. Đây là khoảng trống cần xử lý trước khi tiếp tục đầu tư thời gian và nội dung.'],
      [/problem/, /lãng phí ngân sách/i, 'Đầu tư nội dung nhưng thiếu hướng triển khai?', 'Từ khóa, nội dung và kế hoạch SEO cần gắn với nhau. Thiếu chiến lược khiến ngân sách marketing bị phân tán và khó đánh giá hiệu quả.'],
      [/method|benefit/, /th[ựụ]c hành trên|dự án thực tế|website thật/i, 'Đưa kiến thức vào website của bạn', 'Thực hành trên dự án thực tế để kết nối nội dung học với từng việc cần triển khai trên website.'],
      [/method|benefit/, /theo dõi sát|đo lường/i, 'Đọc dữ liệu để hiểu kết quả SEO', 'Theo dõi dữ liệu website để đánh giá thay đổi và hiểu ý nghĩa của từng chỉ số trong quá trình triển khai SEO.'],
      [/benefit/, /chuyên gia|kinh nghiệm thực chiến/i, 'Hiểu cả cách làm và sai lầm cần tránh', 'Học từ kinh nghiệm triển khai dự án thực tế, cùng cách nhận diện và xử lý những sai lầm trong quá trình làm SEO.'],
      [/benefit/, /tiết kiệm chi phí/i, 'Chủ động hơn khi triển khai SEO', 'Nắm cách thực hiện công việc SEO để chủ động triển khai trên website và cân nhắc phần việc cần thuê ngoài.'],
    ];
    for (const [kind, match, title, text] of patterns)
      if (kind.test(fact.kind) && match.test(source)) return { title, text };
  }
  return { title: fact.title, text: fact.text || fact.title };
}
export function editorialFallback(
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
  base: TemplateContentProposal[],
): TemplateContentProposal[] {
  const context = brief.sourceContext!,
    topic = context.topic,
    seo = topic === 'SEO',
    outline = editorialPlan(slots, brief);
  const curriculum = context.facts.filter((f) => f.kind === 'curriculum'),
    methods = context.facts.filter((f) => f.kind === 'method'),
    audience = context.facts.filter((f) => f.kind === 'audience');
  const proposals = base.map((p) => {
    const slot = slots.find((s) => s.id === p.slotId)!;
    if (slot.kind === 'visibility' && !slot.locked)
      return { ...p, status: 'unchanged' as const, action: 'hide' as const, reason: 'Chỉ ẩn khi bạn duyệt thao tác này.' };
    if (
      slot.locked ||
      slot.kind !== 'text' ||
      ['price', 'policy', 'review', 'schedule', 'cta', 'form-label', 'alt'].includes(slot.role)
    )
      return p;
    const role = editorialRole(slot),
      i = slot.itemIndex || 0,
      plan = outline.find((s) => s.blockId === slot.blockId)!;
    const group = groupsFor(slot, slots, brief);
    if (slot.itemId && !group.length && slot.blockType !== 'FAQ')
      return { ...p, text: undefined, status: 'missing' as const, reason: 'Nguồn không có thêm dữ kiện riêng cho thẻ này. Bổ sung hoặc duyệt ẩn để tránh lặp nội dung.' };
    let text = '',
      evidence = group.map((f) => f.title);
    if (slot.field === 'eyebrow') {
      const labels: Record<SectionRole, string> = {
        identity: 'KHÓA HỌC',
        hero: 'ĐÀO TẠO',
        problem: 'VƯỚNG MẮC KHI TỰ HỌC',
        benefit: 'GIÁ TRỊ HỌC TẬP',
        curriculum: 'CHƯƠNG TRÌNH HỌC',
        audience: 'ĐỐI TƯỢNG PHÙ HỢP',
        method: 'PHƯƠNG PHÁP ĐÀO TẠO',
        registration: 'CHUẨN BỊ THAM GIA',
        faq: 'HỎI ĐÁP',
        consult: 'TƯ VẤN KHÓA HỌC',
        sensitive: 'THÔNG TIN ĐĂNG KÝ',
      };
      text = labels[role];
    } else if (slot.blockType === 'Header') text = brief.brandName;
    else if (slot.blockType === 'Footer')
      text =
        slot.field === 'headline'
          ? brief.brandName
          : `${brief.brandName} · Tư vấn khóa học ${topic}`;
    else if (slot.blockType === 'SEO')
      text =
        slot.field === 'seo.title'
          ? seo ? `${topic} chuyên sâu | ${brief.brandName}` : `${topic} | ${brief.brandName}`
          : seo
            ? `Khóa học ${topic} tại ${brief.brandName}. Kết nối kiến thức với thực hành trên website và đo lường dữ liệu. Nhận tư vấn lộ trình học phù hợp.`
            : `Tìm hiểu khóa học ${topic} tại ${brief.brandName}. Xem nội dung chương trình và nhận tư vấn trước khi đăng ký.`;
    else if (slot.blockType === 'Hero') {
      if (slot.field === 'headline') text = seo ? `Học ${topic} bài bản, thực hành trên website của bạn` : `Khám phá lộ trình học ${topic}`;
      else if (slot.field.startsWith('trustPoints.')) {
        const items = seo ? [
          'Lộ trình từ cơ bản đến nâng cao',
          'Thực hành trên website',
          'Theo dõi kết quả bằng dữ liệu',
        ] : curriculum.slice(0, 3).map(f => f.title);
        text = items[Number(slot.field.split('.')[1]) % Math.max(1, items.length)] || '';
      } else
        text =
          slot.field === 'subheadline'
            ? audience.length
              ? `${seo ? 'Từ nền tảng đến triển khai SEO. ' : ''}Dành cho ${audience
                  .slice(0, 3)
                  .map((f) => f.title.toLocaleLowerCase('vi'))
                  .join(', ')}.`
              : `Tìm hiểu chương trình ${topic} và chia sẻ mục tiêu học của bạn.`
            : seo ? `${brief.brandName} kết nối kiến thức ${topic} với thực hành trên website. Lộ trình đi từ nền tảng đến triển khai và đánh giá dữ liệu.` : `Tìm hiểu nội dung ${topic}, đối chiếu với mục tiêu và trao đổi những điều bạn cần làm rõ trước khi đăng ký.`;
    } else if (slot.blockType === 'FAQ') {
      if (!slot.itemId) text = 'Câu hỏi về chương trình và cách đăng ký';
      else {
        const questions = [
          'Khóa học dành cho ai?',
          'Chương trình học bao gồm những gì?',
          seo ? 'Có thực hành trên website không?' : 'Phương pháp học như thế nào?',
          'Cần chuẩn bị gì để tham gia?',
          'Học phí và lịch học được xác nhận thế nào?',
        ];
        const answers = [
          audience
            .slice(0, 4)
            .map((f) => f.title)
            .join('; ') + '.',
          `Chương trình gồm ${curriculum
            .slice(0, 3)
            .map((f) => f.title)
            .join('; ')}${curriculum.length > 3 ? ' và các học phần khác trong chương trình.' : '.'}`,
          completeCopy(
            (seo ? methods.find((f) =>
              /thực hành|website thật|dự án thực tế/i.test(`${f.title} ${f.text}`),
            ) : methods.find(f => f.text))?.text || '',
            slot.maxLength,
            `Nội dung nguồn có hướng dẫn thực hành ${topic}. Hãy trao đổi về website bạn muốn áp dụng.`,
          ),
          'Trao đổi nhu cầu và kiểm tra những điều cần chuẩn bị theo hướng dẫn đăng ký.',
          'Gửi thông tin qua biểu mẫu để được xác nhận học phí, lịch học và điều kiện tham gia trước khi đăng ký.',
        ];
        text = slot.field === 'question' ? questions[i % 5]! : answers[i % 5]!;
        evidence = context.facts
          .filter((f) => ['curriculum', 'audience', 'method', 'registration'].includes(f.kind))
          .map((f) => f.title);
      }
    } else if (slot.blockType === 'LeadForm') {
      if (['successMessage', 'footerText'].includes(slot.field)) return p;
      text =
        slot.field === 'headline'
          ? `Nhận tư vấn lộ trình học ${topic} cho mục tiêu của bạn`
          : `Để lại thông tin liên hệ và mục tiêu học. Trao đổi chương trình, lịch học và học phí trước khi quyết định đăng ký.`;
    } else if (slot.blockType === 'CTA')
      text =
        slot.field === 'headline'
          ? (slot.occurrence || 0) > 0
            ? `Bắt đầu lộ trình học ${topic} của bạn`
            : seo ? `Bạn muốn áp dụng ${topic} cho website nào?` : `Bạn muốn tìm hiểu khóa học ${topic}?`
          : `Gửi nhu cầu học ${topic}. Xác nhận chương trình, lịch học và học phí trước khi đăng ký.`;
    else if (slot.itemId) {
      text =
        slot.field === 'title'
          ? group[0] ? conciseCourseFact(group[0], topic).title : ''
          : role === 'curriculum'
            ? group.map((f) => f.title).join('; ') + '.'
            : completeCopy(
                group.map((f) => conciseCourseFact(f, topic).text).join(' '),
                slot.maxLength,
                group.map((f) => f.title).join('; ') + '.',
              );
    } else
      text =
        slot.field === 'headline'
          ? plan.question
          : role === 'curriculum'
            ? seo ? `Tìm hiểu các học phần ${topic}, từ cách Google hoạt động đến triển khai và đánh giá website.` : `Khám phá các học phần ${topic} trong chương trình.`
            : role === 'problem'
              ? seo ? 'Học có hệ thống để xử lý những vướng mắc khi triển khai trên website.' : `Đối chiếu những vướng mắc khi học ${topic} với nhu cầu của bạn.`
              : role === 'benefit'
                ? `Kết nối từng phần kiến thức với công việc ${topic} thực tế.`
                : role === 'audience'
                  ? 'Đối chiếu chương trình với kinh nghiệm và mục tiêu học của bạn.'
                  : role === 'method'
                    ? seo ? 'Thực hành trên website và theo dõi dữ liệu trong quá trình học.' : 'Tìm hiểu phương pháp học từ thông tin chương trình.'
                    : 'Kiểm tra những điều cần chuẩn bị trước khi đăng ký.';
    if (role === 'audience' && slot.itemId && slot.field === 'description') {
      const title = group[0]?.title || '';
      text = /marketing/i.test(title)
        ? `Đối chiếu nội dung ${topic} với công việc marketing và mục tiêu học của bạn.`
        : /chủ doanh nghiệp/i.test(title)
          ? `Tìm hiểu cách ứng dụng kiến thức ${topic} vào hoạt động của doanh nghiệp.`
          : /chuyển|nghề/i.test(title)
            ? `Xây dựng nền tảng trước khi tìm hiểu các công việc liên quan đến ${topic}.`
            : /sinh viên/i.test(title)
              ? `Tiếp cận các học phần ${topic} để bổ sung kiến thức chuyên môn.`
              : 'Đối chiếu chương trình với kinh nghiệm hiện tại và câu hỏi bạn muốn làm rõ.';
    }
    if (
      role === 'method' &&
      slot.itemId &&
      slot.field === 'description' &&
      /1:1/.test(group[0]?.title || '')
    )
      text = 'Hỗ trợ trực tiếp theo hình thức 1:1 khi trao đổi nội dung học.';
    text = completeCopy(text, slot.maxLength).replace(/\bseo\b/gi, 'SEO');
    if (!text)
      return {
        ...p,
        text: undefined,
        status: 'missing' as const,
        reason: 'Cần biên tập ngắn hơn cho ô này; không cắt ngang câu.',
      };
    return {
      slotId: p.slotId,
      text,
      status: 'ready' as const,
      source: 'fallback' as const,
      evidence,
    };
  });
  // Sensitive sample blocks and sections without a valid replacement are explicitly proposed for hiding.
  for (const slot of slots.filter((s) => s.kind === 'visibility' && !s.locked)) {
    const group = slots.filter((s) => s.blockId === slot.blockId && (!slot.itemId || s.itemId === slot.itemId) && s.kind === 'text');
    const incomplete = group.some(
      (s) => proposals.find((p) => p.slotId === s.id)?.status === 'missing',
    );
    if (
      (incomplete && ['Countdown', 'Pricing', 'Testimonials', 'Guarantee'].includes(slot.blockType)) ||
      (slot.itemId && !groupsFor(slot, slots, brief).length) ||
      (!slot.itemId && ['Benefits', 'Features', 'Process', 'Gallery', 'Product'].includes(slot.blockType) && !factsFor(slot, brief).length)
    ) {
      const index = proposals.findIndex((p) => p.slotId === slot.id);
      proposals[index] = {
        slotId: slot.id,
        status: 'missing',
        action: 'hide',
        source: 'fallback',
        reason: 'Nguồn chưa xác nhận dữ kiện cho phần này. Duyệt ẩn để bỏ nội dung minh họa.',
      };
    }
  }
  return proposals;
}

export function validateEditorialText(
  text: string,
  slot: TemplateContentSlot,
  brief: TemplateContentBrief,
  factIds: string[],
): boolean {
  const context = brief.sourceContext!,
    facts = context.facts.filter((f) => factIds.includes(f.id));
  if (
    !text ||
    text.length > slot.maxLength ||
    /[<>]|https?:\/\/|```/.test(text) ||
    !facts.length ||
    facts.length !== new Set(factIds).size
  )
    return false;
  if (slot.field === 'headline' && isGenericTemplateHeading(text)) return false;
  if (
    /lợi ích sản phẩm|studio sáng tạo|trao đổi dự án|giải pháp toàn diện cho doanh nghiệp/i.test(
      text,
    )
  )
    return false;
  if (
    /(?:cam kết|đảm bảo|hoàn tiền|chứng chỉ|chứng nhận|ưu đãi|khuyến mãi|miễn phí|tặng kèm|thu nhập|lương\s+\d|lên top sau|\d[\d.,]*\s*(?:triệu|vnđ|vnd|₫|đồng))/i.test(
      text,
    )
  )
    return false;
  const corpus = cleanSourceText(
    [
      brief.productName,
      brief.brandName,
      brief.targetCustomer,
      ...facts.map((f) => `${f.title} ${f.text}`),
    ].join(' '),
  ).toLocaleLowerCase('vi');
  // Citing a fact containing "80" must not authorize "80%", "80 buổi" or free tuition.
  const compactCorpus = corpus.replace(/\s+/g, '');
  for (const amount of text.matchAll(/\d+(?:[.,:]\d+)*(?:\s*(?:%|giờ|ngày|tuần|tháng|năm|buổi|phút))/gi))
    if (!compactCorpus.includes(amount[0].toLocaleLowerCase('vi').replace(/\s+/g, ''))) return false;
  for (const claim of text.matchAll(/miễn phí|24\s*\/\s*7|trọn đời|hàng đầu|duy nhất|tốt nhất/gi))
    if (!compactCorpus.includes(claim[0].toLocaleLowerCase('vi').replace(/\s+/g, ''))) return false;
  for (const number of text.matchAll(/\d+(?:[.,:]\d+)*/g))
    if (
      !new RegExp(`(^|[^\\d])${number[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`).test(
        corpus,
      )
    )
      return false;
  if (
    editorialRole(slot) === 'curriculum' &&
    slot.itemId &&
    !facts.some((f) => f.kind === 'curriculum')
  )
    return false;
  if (
    editorialRole(slot) === 'curriculum' &&
    slot.field === 'description' &&
    slot.editorialFactIds?.some((id) => !factIds.includes(id))
  )
    return false;
  if (/^(?:khóa học|khoá học)\s+(?:giúp|cung cấp|trang bị)/i.test(text)) return false;
  if (
    /sẵn sàng.*(?:công việc|sau tốt nghiệp)|có việc làm|trở thành.*(?:chuyên gia|chuyên nghiệp)|được tặng|cung cấp bộ công cụ/i.test(
      text,
    )
  )
    return false;
  if (
    slot.itemId &&
    slot.editorialFactIds?.length &&
    !slot.editorialFactIds.some((id) => factIds.includes(id))
  )
    return false;
  if (
    editorialRole(slot) === 'curriculum' &&
    slot.field === 'description' &&
    slot.editorialFactIds?.some((id) => {
      const fact = context.facts.find((f) => f.id === id);
      return fact && !coversCurriculumFact(text, fact);
    })
  )
    return false;
  const words = text.toLocaleLowerCase('vi').match(/[\p{L}]{4,}/gu) || [];
  return words.length < 4 || words.filter((w) => corpus.includes(w)).length / words.length >= 0.35;
}
