import type {
  TemplateContentBrief,
  TemplateContentProposal,
  TemplateContentSectionPlan,
  TemplateContentSlot,
} from './landing-page-template-content';
import {
  editorialFallback,
  editorialPlan,
  completeCopy,
  validateEditorialText,
} from './landing-page-template-editorial';
import { enforceTemplatePricingOffer } from './landing-page-template-pricing';
import { isGenericTemplateHeading } from './landing-page-template-copy-quality';

const isCourse = (brief: TemplateContentBrief) =>
  /đào tạo|khóa học|khoá học|học seo|course|training/i.test(
    `${brief.productName} ${brief.description}`,
  );
const subject = (brief: TemplateContentBrief) =>
  /seo/i.test(brief.productName) ? 'SEO' : brief.productName;
const lines = (text?: string) =>
  (text || '')
    .split(/[\n;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
const fit = completeCopy;

/** A single page-wide outline precedes copy. Repeated section types have different editorial purposes. */
export function planTemplateContent(
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
): TemplateContentSectionPlan[] {
  if (brief.sourceContext) return editorialPlan(slots, brief);
  const course = isCourse(brief),
    topic = subject(brief),
    seen = new Set<string>();
  return slots
    .filter((slot) => {
      if (seen.has(slot.blockId)) return false;
      seen.add(slot.blockId);
      return true;
    })
    .map((slot) => {
      const n = slot.occurrence || 0;
      const questions: Record<string, string[]> = course
        ? {
            SEO: ['Thông tin tìm kiếm'],
            Header: ['Thương hiệu'],
            Hero: [`Tìm hiểu đào tạo ${topic}`],
            Benefits: [
              `Ai nên tìm hiểu khóa học ${topic}?`,
              'Bạn muốn giải quyết điều gì?',
              'Điều gì phù hợp với nhu cầu của bạn?',
            ],
            Features: [
              'Học gì?',
              'Cần chuẩn bị gì trước khi đăng ký?',
              'Bạn cần xác nhận thông tin nào?',
            ],
            Product: ['Thông tin khóa học cần biết'],
            Gallery: [`Hình ảnh về đào tạo ${topic}`],
            Process: ['Đăng ký thế nào?', 'Cần xác nhận gì trước khi tham gia?'],
            LeadForm: [`Trao đổi mục tiêu học ${topic}`],
            CTA: [`Trao đổi nhu cầu học ${topic}`, 'Bạn còn câu hỏi về khóa học?'],
            Pricing: ['Học phí và thông tin đăng ký'],
            FAQ: ['Giải đáp trước khi đăng ký'],
            Guarantee: ['Chính sách đã xác nhận'],
            Testimonials: ['Ý kiến học viên đã xác nhận'],
            Countdown: ['Lịch học đã xác nhận'],
            Footer: [brief.brandName],
          }
        : {
            SEO: ['Thông tin tìm kiếm'],
            Header: ['Thương hiệu'],
            Hero: [`${brief.productName} — ${brief.brandName}`],
            Benefits: [
              'Sản phẩm phù hợp với ai?',
              'Bạn đang tìm điều gì?',
              'Lựa chọn theo nhu cầu',
            ],
            Features: [
              'Đặc điểm đã xác nhận',
              'Cần biết gì trước khi lựa chọn?',
              'Thông tin cần làm rõ',
            ],
            Product: ['Tìm hiểu sản phẩm'],
            Gallery: ['Hình ảnh sản phẩm'],
            Process: ['Gửi yêu cầu thế nào?'],
            LeadForm: ['Gửi nhu cầu của bạn'],
            CTA: ['Trao đổi trước khi lựa chọn', 'Bạn cần thêm thông tin?'],
            Pricing: ['Giá và điều kiện mua'],
            FAQ: ['Câu hỏi trước khi lựa chọn'],
            Guarantee: ['Chính sách đã xác nhận'],
            Testimonials: ['Đánh giá đã xác nhận'],
            Countdown: ['Thời gian đã xác nhận'],
            Footer: [brief.brandName],
          };
      const choices = questions[slot.blockType] || [`Tìm hiểu ${brief.productName}`];
      const question = choices[n % choices.length]!;
      return {
        blockId: slot.blockId,
        blockType: slot.blockType,
        occurrence: n,
        question,
        purpose: `${question} ${slot.blockType === 'Features' && n === 0 ? 'Chỉ trình bày giáo trình/đặc điểm được cung cấp; thiếu thì yêu cầu bổ sung.' : 'Viết một ý cho mỗi box, không lặp tiêu đề hay nội dung các section khác.'}`,
      };
    });
}

export function templateContentActionLabel(
  slot: TemplateContentSlot,
  brief: TemplateContentBrief,
): string {
  const course = isCourse(brief);
  if (slot.actionType === 'phone') return 'Gọi để trao đổi';
  if (slot.actionType === 'email') return 'Gửi email';
  if (slot.actionType === 'zalo') return 'Trao đổi qua Zalo';
  if (slot.actionType === 'checkout') return 'Tiếp tục thanh toán';
  if (slot.actionType === 'submit')
    return brief.goal === 'consult'
      ? 'Gửi yêu cầu tư vấn'
      : course
        ? 'Gửi thông tin đăng ký'
        : 'Gửi thông tin đặt mua';
  if (slot.actionType === 'form')
    return brief.goal === 'consult'
      ? course
        ? 'Nhận tư vấn khóa học'
        : 'Nhận tư vấn'
      : course
        ? 'Đăng ký tìm hiểu'
        : 'Gửi yêu cầu đặt mua';
  return 'Xem thông tin';
}

function factualSource(brief: TemplateContentBrief, slot: TemplateContentSlot): string {
  if (slot.role === 'price') return brief.price || '';
  if (slot.role === 'review') return brief.reviews || '';
  if (slot.role === 'policy') return [brief.policy, brief.commitments].filter(Boolean).join('\n');
  if (slot.role === 'schedule') return brief.schedule || '';
  if (slot.role === 'curriculum')
    return brief.curriculum || (!isCourse(brief) ? brief.description : '');
  return [
    brief.productName,
    brief.brandName,
    brief.description,
    brief.targetCustomer,
    brief.price,
    brief.offer,
    brief.policy,
    brief.reviews,
    brief.curriculum,
    brief.schedule,
    brief.commitments,
    brief.sourceText,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Supports paraphrasing, while amounts, schedules, reviews and strong claims remain evidence-bound. */
export function isGroundedTemplateText(
  text: string,
  brief: TemplateContentBrief,
  slot: TemplateContentSlot,
): boolean {
  if (!text.trim() || text.length > slot.maxLength || /[<>]|https?:\/\/|```/i.test(text))
    return false;
  const source = factualSource(brief, slot).toLocaleLowerCase('vi'),
    normalized = text.trim().toLocaleLowerCase('vi');
  if (slot.role === 'cta') return text === templateContentActionLabel(slot, brief);
  if (['price', 'policy', 'review'].includes(slot.role))
    return (
      !!source &&
      (source === normalized || source.split(/[\n;|]+/).some((line) => line.trim() === normalized))
    );
  if (slot.role === 'schedule')
    return (
      !!brief.schedule &&
      (text === brief.schedule || brief.schedule.includes(text)) &&
      !/demo/i.test(text)
    );
  if (slot.role === 'curriculum' && !source.trim()) return false;
  for (const number of normalized.matchAll(/\d+(?:[.,]\d+)*/g))
    if (!source.includes(number[0])) return false;
  for (const amount of normalized.matchAll(
    /\d+(?:[.,]\d+)*(?:\s*(?:ml|lít|giờ|ngày|tuần|tháng|năm|buổi|phút|%|đồng|vnđ|vnd|usd|triệu|₫|đ|k\b|sao\b))/g,
  ))
    if (!source.replace(/\s+/g, '').includes(amount[0].replace(/\s+/g, ''))) return false;
  const claims =
    /miễn phí|ưu đãi|khuyến mãi|khuyến mại|quà tặng|tặng kèm|giảm giá|khách hàng đánh giá cao|khách hàng hài lòng|được khách hàng tin tưởng|cam kết|đảm bảo|bảo hành|hoàn tiền|chứng nhận|chứng chỉ|hàng đầu|tốt nhất|duy nhất|giảng viên|chuyên gia|lên top|top google|thành thạo|nắm vững|tăng doanh thu|thực hành|dự án thực tế|học trọn đời|việc làm|đổi trả|chống nước|giữ nhiệt \d|ISO|FDA/gi;
  for (const match of text.matchAll(claims))
    if (!source.includes(match[0].toLocaleLowerCase('vi'))) return false;
  // A title/caption is still a factual claim. Do not smuggle unconfirmed syllabus,
  // facilities or after-course support into ordinary benefit/FAQ/gallery slots.
  if (isCourse(brief) && !/[?？]\s*$/.test(text)) {
    const courseClaims =
      /(?:khóa học|khoá học|chương trình|học seo)\s+(?:sẽ\s+)?(?:giúp|cung cấp|bao gồm)|kiến thức\s+(?:cơ bản|nền tảng|nâng cao)|kỹ thuật seo|kỹ năng phân tích|hỗ trợ[^.!?]*sau khóa học|không gian học tập|môi trường học tập|đầy đủ tiện nghi|chương trình học đa dạng|nội dung khóa học phong phú|nâng cao khả năng cạnh tranh|phát triển sự nghiệp/gi;
    for (const match of text.matchAll(courseClaims)) {
      if (!source.includes(match[0].toLocaleLowerCase('vi'))) return false;
    }
    // Even an innocuous benefit title can imply a syllabus or result. A minimal
    // brief about learning SEO does not establish advanced skills, tools or jobs.
    const learningConcepts =
      /kiến thức|kỹ năng|kỹ thuật|nghề nghiệp|tối ưu hóa|tối ưu hoá|công cụ seo|seo nâng cao|nghiên cứu từ khóa|phân tích dữ liệu|trang bị|được hướng dẫn|sẽ được|sẽ biết|sẽ nhận|hiểu rõ|tài liệu học tập|xu hướng|giảng dạy|chúng tôi sẽ/gi;
    for (const match of text.matchAll(learningConcepts))
      if (!source.includes(match[0].toLocaleLowerCase('vi'))) return false;
  }
  // Do not invert a supplied negative fact by extracting only its positive half.
  for (const negative of source.matchAll(/không\s+([^\n;.!?]+)/g)) {
    const phrase = negative[1]?.trim();
    if (phrase && normalized.includes(phrase) && !normalized.includes(`không ${phrase}`))
      return false;
  }
  if (isCourse(brief) && /SEO/i.test(brief.productName)) {
    for (const stale of [
      'chiến lược thương hiệu',
      'định vị thương hiệu',
      'hệ thống thông điệp',
      'định hướng hình ảnh',
      'studio sáng tạo',
    ])
      if (normalized.includes(stale) && !source.includes(stale)) return false;
  }
  return true;
}

/** Grounded local fallback follows the same outline and actual button destinations as AI. */
export function fallbackTemplateContent(
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
): TemplateContentProposal[] {
  const outline = new Map(
    planTemplateContent(slots, brief).map((section) => [section.blockId, section]),
  );
  const course = isCourse(brief),
    topic = subject(brief),
    facts = lines(brief.curriculum || (!course ? brief.description : ''));
  let photoIndex = 0;
  const proposals = slots.map((slot): TemplateContentProposal => {
    const missing = (reason: string): TemplateContentProposal => ({
      slotId: slot.id,
      status: 'missing',
      reason,
    });
    if (slot.locked)
      return missing('Vị trí đang khóa hoặc ẩn; giữ nguyên cho đến khi bạn mở khóa.');
    if (slot.field === 'eyebrow')
      return { slotId: slot.id, status: 'unchanged', text: slot.current };
    if (slot.kind === 'visibility')
      return {
        slotId: slot.id,
        status: 'unchanged',
        action: 'hide',
        reason: 'Chỉ ẩn khi bạn duyệt thao tác này.',
      };
    if (slot.kind === 'image') {
      const imageId =
        slot.blockType === 'Hero' || slot.blockType === 'SEO'
          ? brief.primaryImageId || brief.imageIds[0]
          : brief.imageIds[photoIndex++ % Math.max(1, brief.imageIds.length)];
      return imageId
        ? { slotId: slot.id, status: 'ready', imageId }
        : { ...missing('Chọn ảnh từ thư viện hoặc duyệt ẩn ảnh minh họa.'), action: 'hide' };
    }
    if (slot.blockType === 'Countdown' && slot.role === 'price' && !brief.originalPrice && brief.schedule)
      return { slotId: slot.id, status: 'unchanged', text: slot.current };
    const plan = outline.get(slot.blockId),
      index = slot.itemIndex || 0;
    if (brief.sourceText && !brief.brandName && ['Header', 'Footer'].includes(slot.blockType))
      return missing('Nguồn chưa xác định thương hiệu. Bổ sung hoặc duyệt ẩn phần minh họa.');
    let text = '';
    if (slot.blockType === 'SEO')
      text =
        slot.field === 'seo.title'
          ? [brief.productName, brief.brandName].filter(Boolean).join(' | ')
          : brief.sourceText
            ? brief.description
            : `${brief.productName} dành cho ${brief.targetCustomer}. Tìm hiểu thông tin và gửi nhu cầu ${brief.goal === 'consult' ? 'tư vấn' : 'đăng ký'} với ${brief.brandName}.`;
    else if (slot.role === 'cta') text = templateContentActionLabel(slot, brief);
    else if (slot.role === 'alt')
      text =
        `${brief.productName} — ${slot.itemId ? `hình ảnh ${index + 1}` : brief.brandName}`.replace(
          /hình ảnh \d+/,
          'ảnh minh họa',
        );
    else if (slot.role === 'schedule') {
      const schedule = brief.schedule || '';
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(schedule) ||
        !Number.isFinite(Date.parse(schedule))
      )
        return missing(
          'Cần bổ sung mốc ISO có múi giờ đã xác nhận; bạn có thể duyệt ẩn countdown demo.',
        );
      text =
        slot.field === 'eventDate'
          ? schedule.slice(0, 10)
          : slot.field === 'eventTime'
            ? schedule.slice(11, 16)
            : schedule;
    } else if (slot.role === 'price') {
      if (
        slot.field === 'price' &&
        slots.filter((s) => s.blockId === slot.blockId && s.field === 'price').length === 1
      )
        text = brief.price || '';
      else
        return missing(
          'Cần bổ sung dữ liệu đúng từng gói. Không tự gán một mức giá hay giáo trình cho nhiều gói.',
        );
    } else if (slot.role === 'review') {
      const review = lines(brief.reviews)
        [index]?.split('|')
        .map((value) => value.trim());
      text =
        review?.length === 2
          ? slot.field === 'author'
            ? review[0]!
            : slot.field === 'quote'
              ? review[1]!
              : ''
          : '';
      if (!text) return missing('Cần đánh giá thật và tên người đánh giá; có thể duyệt ẩn khối.');
    } else if (slot.role === 'policy') {
      text = brief.policy || brief.commitments || '';
      if (!text) return missing('Cần chính sách / cam kết đã xác nhận hoặc duyệt ẩn khối.');
    } else if (slot.role === 'curriculum') {
      text = facts[index] || '';
      if (!text)
        return missing(
          course
            ? 'Cần bổ sung nội dung giáo trình đã xác nhận. Không suy ra giáo trình từ tên khóa học.'
            : 'Cần đặc điểm sản phẩm đã xác nhận.',
        );
    } else if (slot.blockType === 'Header') text = brief.brandName;
    else if (slot.blockType === 'Footer')
      text =
        slot.field === 'headline' ? brief.brandName : `${brief.brandName} · ${brief.productName}`;
    else if (slot.blockType === 'Hero') {
      if (slot.field === 'headline')
        text = [brief.productName, brief.brandName].filter(Boolean).join(' — ');
      else if (slot.field.startsWith('trustPoints.'))
        text = ['Mục tiêu của bạn', 'Thông tin cần tìm hiểu', 'Câu hỏi trước khi đăng ký'][
          Number(slot.field.split('.')[1]) % 3
        ]!;
      else if (brief.sourceText) text = brief.description;
      else
        text = `Dành cho ${brief.targetCustomer}. Chia sẻ điều bạn muốn tìm hiểu về ${topic} để trao đổi thông tin phù hợp.`;
    } else if (slot.blockType === 'LeadForm') {
      if (slot.field === 'headline') text = plan!.question;
      else if (slot.field === 'successMessage') text = 'Đã nhận thông tin bạn gửi.';
      else if (slot.field === 'footerText')
        text = 'Gửi yêu cầu tư vấn. Bạn chưa thực hiện thanh toán ở bước này.';
      else if (slot.collection === 'fields') {
        const current = `${slot.inputName || ''} ${slot.current}`.toLocaleLowerCase('vi');
        if (/tên|name/.test(current)) text = slot.field === 'label' ? 'Họ và tên' : 'Tên của bạn';
        else if (/điện thoại|zalo|phone/.test(current))
          text = slot.field === 'label' ? 'Số điện thoại / Zalo' : 'Số điện thoại liên hệ';
        else if (/email|e-mail/.test(current))
          text = slot.field === 'label' ? 'Email' : 'Email của bạn';
        else
          text =
            slot.field === 'label'
              ? course
                ? 'Nhu cầu tìm hiểu khóa học'
                : 'Nhu cầu của bạn'
              : `Chia sẻ điều bạn muốn tìm hiểu về ${topic}`;
      } else text = `Gửi câu hỏi hoặc nhu cầu của bạn về ${topic}.`;
    } else if (slot.blockType === 'FAQ') {
      const questions = course
        ? [
            'Khóa học dành cho ai?',
            'Nội dung học cần xác nhận thế nào?',
            'Lịch học được xác nhận ở đâu?',
            'Tôi gửi nhu cầu bằng cách nào?',
            'Cần làm rõ học phí và chính sách ra sao?',
          ]
        : [
            'Sản phẩm dành cho ai?',
            'Tôi tìm hiểu đặc điểm thế nào?',
            'Giá và điều kiện mua được xác nhận ra sao?',
            'Tôi gửi nhu cầu bằng cách nào?',
            'Cần làm rõ chính sách ở đâu?',
          ];
      const answers = [
        `Trang này hướng đến ${brief.targetCustomer}. Bạn có thể chia sẻ nhu cầu riêng trước khi lựa chọn.`,
        `Bạn có thể gửi câu hỏi cụ thể để xác nhận ${course ? 'nội dung chương trình' : 'đặc điểm sản phẩm'} trước khi quyết định.`,
        'Hãy yêu cầu thông tin đã xác nhận trước khi đăng ký; không sử dụng mốc minh họa làm lịch chính thức.',
        'Điền thông tin liên hệ và nhu cầu trong biểu mẫu, sau đó bấm gửi yêu cầu.',
        'Bạn có thể gửi câu hỏi qua biểu mẫu để xác nhận các điều kiện trước khi lựa chọn.',
      ];
      text = !slot.itemId
        ? plan!.question
        : slot.field === 'question'
          ? questions[index % questions.length]!
          : answers[index % answers.length]!;
    } else if (slot.blockType === 'Process') {
      const titles = ['Xem thông tin', 'Ghi nhu cầu', 'Gửi yêu cầu', 'Xác nhận trước khi đăng ký'];
      const descriptions = [
        `Đối chiếu thông tin về ${topic} với điều bạn đang quan tâm.`,
        'Chia sẻ mục tiêu và câu hỏi bạn muốn làm rõ.',
        'Điền thông tin trong biểu mẫu và kiểm tra trước khi gửi.',
        'Rà soát các điều kiện đã được xác nhận trước khi quyết định.',
      ];
      text = !slot.itemId
        ? slot.field === 'headline'
          ? plan!.question
          : 'Các bước bạn có thể chủ động thực hiện.'
        : slot.field === 'title'
          ? titles[index % titles.length]!
          : descriptions[index % descriptions.length]!;
    } else if (slot.blockType === 'Gallery')
      text = !slot.itemId
        ? slot.field === 'headline'
          ? plan!.question
          : `Hình ảnh minh họa cho ${brief.productName}.`
        : slot.field === 'title'
          ? [`Tìm hiểu ${topic}`, 'Góc nhìn tham khảo', 'Thông tin trực quan'][index % 3]!
          : `Ảnh minh họa cho chủ đề ${topic}; đối chiếu với thông tin đã xác nhận.`;
    else if (slot.blockType === 'CTA')
      text =
        slot.field === 'headline'
          ? plan!.question
          : `Gửi câu hỏi bạn muốn làm rõ về ${topic} qua biểu mẫu.`;
    else if (slot.blockType === 'Countdown')
      text =
        slot.field === 'headline'
          ? 'Lịch đã xác nhận'
          : brief.schedule || 'Cần bổ sung lịch chính thức';
    else if (slot.blockType === 'Guarantee')
      text =
        slot.field === 'headline'
          ? 'Chính sách đã xác nhận'
          : brief.policy || brief.commitments || '';
    else if (slot.blockType === 'Pricing')
      text =
        slot.field === 'headline'
          ? plan!.question
          : 'Rà soát giá và điều kiện đã được xác nhận trước khi lựa chọn.';
    else if (slot.blockType === 'Testimonials') text = 'Ý kiến đã được xác nhận';
    else {
      const second = (slot.occurrence || 0) > 0;
      const titles = second
        ? ['Mục tiêu quan tâm', 'Câu hỏi cần làm rõ', 'Thông tin trước khi lựa chọn']
        : ['Nhu cầu tìm hiểu', 'Kinh nghiệm hiện tại', 'Mục tiêu của bạn'];
      const descriptions = second
        ? [
            `Chia sẻ điều bạn muốn tìm hiểu về ${topic}.`,
            'Ghi những câu hỏi bạn muốn trao đổi trước khi đăng ký.',
            'Đối chiếu thông tin với nhu cầu trước khi quyết định.',
          ]
        : [
            `Phù hợp để ${brief.targetCustomer} tìm hiểu thêm thông tin.`,
            `Bạn có thể nêu kinh nghiệm hiện tại khi tìm hiểu về ${topic}.`,
            'Làm rõ điều bạn đang quan tâm để đặt câu hỏi phù hợp.',
          ];
      text = !slot.itemId
        ? slot.field === 'headline'
          ? plan!.question
          : `Tìm hiểu ${topic} từ nhu cầu và mục tiêu của bạn.`
        : slot.field === 'title'
          ? titles[index % titles.length]!
          : descriptions[index % descriptions.length]!;
    }
    text = fit(text, slot.maxLength);
    return isGroundedTemplateText(text, brief, slot)
      ? { slotId: slot.id, text, status: 'ready' }
      : missing('Cần bổ sung dữ liệu phù hợp vị trí; nội dung mẫu chưa được duyệt.');
  });
  // Missing confirmed data is offered as a separate, explicit hide operation, never applied by default.
  for (const slot of slots.filter((s) => s.kind === 'visibility' && !s.locked)) {
    const group = slots.filter((s) => s.blockId === slot.blockId && (!slot.itemId || s.itemId === slot.itemId) && s.kind !== 'visibility');
    const requiresHide = group.some(
      (s) =>
        ['curriculum', 'price', 'review', 'policy', 'schedule'].includes(s.role) &&
        proposals.find((p) => p.slotId === s.id)?.status === 'missing',
    );
    if (requiresHide) {
      const index = proposals.findIndex((p) => p.slotId === slot.id);
      proposals[index] = {
        slotId: slot.id,
        status: 'missing',
        action: 'hide',
        reason:
          'Khối còn dữ liệu minh họa chưa được xác nhận. Duyệt ẩn để không hiển thị demo; cấu hình gốc vẫn được giữ.',
      };
    }
  }
  const result = proposals.map((proposal) => ({ ...proposal, source: 'fallback' as const }));
  return enforceTemplatePricingOffer(slots, brief, brief.sourceContext ? editorialFallback(slots, brief, result) : result);
}

/** Unknown/duplicate IDs reject the response. Individual unsupported assertions get a visible diagnostic. */
export function validateTemplateContentProposals(
  raw: unknown,
  slots: TemplateContentSlot[],
  brief: TemplateContentBrief,
): TemplateContentProposal[] {
  const fallback = fallbackTemplateContent(slots, brief),
    entries = (raw as { proposals?: unknown[] })?.proposals;
  if (!Array.isArray(entries) || entries.length > slots.length) throw new Error('AI_SLOT_COUNT');
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') throw new Error('AI_SLOT_SCHEMA');
    const proposal = entry as Record<string, unknown>;
    if (
      typeof proposal.slotId !== 'string' ||
      !slots.some((s) => s.id === proposal.slotId) ||
      byId.has(proposal.slotId)
    )
      throw new Error('AI_SLOT_ID');
    byId.set(proposal.slotId, proposal);
  }
  return slots.map((slot, index) => {
    const proposal = byId.get(slot.id),
      safe = fallback[index]!;
    if (
      slot.locked ||
      safe.priceControlled ||
      slot.kind === 'visibility' ||
      ['price', 'policy', 'review', 'schedule', 'cta'].includes(slot.role)
    )
      return safe;
    if (!proposal) return { ...safe, validationIssue: 'AI_SLOT_MISSING' };
    if (slot.kind === 'image')
      return typeof proposal.imageId === 'string' && brief.imageIds.includes(proposal.imageId)
        ? ({
            slotId: slot.id,
            source: 'ai',
            status: 'ready',
            imageId:
              slot.blockType === 'Hero'
                ? brief.primaryImageId || proposal.imageId
                : proposal.imageId,
          } as TemplateContentProposal)
        : safe;
    if (proposal.status === 'missing') return safe;
    const text = typeof proposal.text === 'string' ? proposal.text.trim() : '';
    if (slot.field === 'headline' && isGenericTemplateHeading(text))
      return { ...safe, validationIssue: 'AI_GENERIC_HEADING' };
    if (brief.sourceContext) {
      const ids = Array.isArray(proposal.factIds)
        ? proposal.factIds.filter((id): id is string => typeof id === 'string')
        : [];
      if (validateEditorialText(text, slot, brief, ids))
        return {
          slotId: slot.id,
          text,
          status: 'ready',
          source: 'ai',
          evidence: brief.sourceContext.facts.filter((f) => ids.includes(f.id)).map((f) => f.title),
        };
      return {
        ...safe,
        validationIssue: !text
          ? 'AI_TEXT_EMPTY'
          : text.length > slot.maxLength
            ? 'AI_TEXT_TOO_LONG'
            : 'AI_EDITORIAL_EVIDENCE',
      };
    }
    const evidence = Array.isArray(proposal.evidence)
      ? proposal.evidence.filter((value): value is string => typeof value === 'string')
      : [];
    const source = factualSource(brief, slot);
    const evidenceValid =
      (!brief.sourceText || evidence.some((quote) => quote.trim().length >= 8)) &&
      evidence.every((quote) => source.includes(quote));
    if (isGroundedTemplateText(text, brief, slot) && evidenceValid)
      return {
        slotId: slot.id,
        source: 'ai',
        status: 'ready',
        text,
        evidence,
      } as TemplateContentProposal;
    return {
      ...safe,
      validationIssue: !text
        ? 'AI_TEXT_EMPTY'
        : text.length > slot.maxLength
          ? 'AI_TEXT_TOO_LONG'
          : !evidenceValid
            ? 'AI_EVIDENCE_INVALID'
            : 'AI_UNSUPPORTED_ASSERTION',
    };
  });
}
