import type { TemplateContentBrief } from './landing-page-template-content';
import {
  buildEditorialContext,
  cleanSourceText,
  sourceSections,
  type SourceEntry,
  type SourceSection,
} from './landing-page-template-editorial';

export type TemplateUrlSource = {
  sourceId: string;
  sourceUrl: string;
  finalUrl: string;
  readAt: string;
  title: string;
  description: string;
  brand: string;
  text: string;
  images: { url: string; alt: string }[];
  warnings: string[];
  sections?: SourceSection[];
};
export type TemplateUrlReadResult = {
  source: TemplateUrlSource;
  brief: Partial<TemplateContentBrief>;
};

function decode(text: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    lt: '<',
    gt: '>',
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi, (_, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || '';
    const number =
      entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}
function plain(text: string) {
  return decode(text).replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}
function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return result;
}
function publicAsset(base: string, raw?: string): string | undefined {
  if (!raw || raw.length > 2000) return;
  try {
    const url = new URL(raw, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    // Candidate only. DNS/IP and every redirect are checked when importing on the backend.
    return url.href.length <= 2000 ? url.href : undefined;
  } catch {
    return;
  }
}

/** Bounded, inert HTML tokenizer. Never loads resources, executes scripts or follows instructions. */
export function extractTemplateUrlSource(
  html: string,
  sourceUrl: string,
  finalUrl: string,
): Omit<TemplateUrlSource, 'sourceId'> {
  if (html.length > 1_000_000) throw new Error('Trang quá lớn để phân tích.');
  type Segment = {
    text: string[];
    images: { url: string; alt: string }[];
    h1: string;
    entries: SourceEntry[];
  };
  const body: Segment = { text: [], images: [], h1: '', entries: [] },
    mains: Segment[] = [],
    articles: Segment[] = [];
  const stack: {
    tag: string;
    skip: boolean;
    segment?: Segment;
    h1: boolean;
    capture?: SourceEntry;
  }[] = [];
  let order = 0;
  const metadata: Record<string, string> = Object.create(null);
  let title = '',
    inTitle = false;
  const addImage = (segment: Segment, url: string, alt: string) => {
    if (segment.images.length < 30 && !segment.images.some((i) => i.url === url))
      segment.images.push({ url, alt: plain(alt).slice(0, 140) });
  };
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g)) {
    const token = match[0];
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (!token.startsWith('<')) {
      if (inTitle) title += token;
      if (stack.some((frame) => frame.skip)) continue;
      const text = plain(token);
      if (!text) continue;
      body.text.push(text);
      for (const frame of stack) if (frame.segment) frame.segment.text.push(text);
      const capture = [...stack].reverse().find((frame) => frame.capture)?.capture;
      if (capture) capture.text += ` ${text}`;
      else {
        const entry = { tag: 'text', text, order: order++ };
        body.entries.push(entry);
        for (const frame of stack) if (frame.segment) frame.segment.entries.push(entry);
      }
      if (stack.some((frame) => frame.h1)) {
        body.h1 += ` ${text}`;
        for (const frame of stack) if (frame.segment) frame.segment.h1 += ` ${text}`;
      }
      continue;
    }
    const tag = token.match(/^<\/?([a-zA-Z][\w:-]*)/)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (token.startsWith('</')) {
      if (tag === 'title') inTitle = false;
      const index = stack.map((f) => f.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      continue;
    }
    const attrs = attributes(token);
    const skippedParent = stack.some((frame) => frame.skip);
    if (tag === 'meta' && !stack.some((f) => /^(script|style|template|noscript)$/.test(f.tag))) {
      const key = (attrs.property || attrs.name || '').toLowerCase();
      if (key && attrs.content) metadata[key] = plain(attrs.content);
    }
    if (tag === 'title') inTitle = true;
    const skip =
      skippedParent ||
      /^(script|style|noscript|template|iframe|svg|nav|aside|footer|head)$/.test(tag) ||
      /\shidden(?:\s|=|\/?>)/i.test(token) ||
      attrs['aria-hidden'] === 'true' ||
      /^(navigation|banner|contentinfo|menu|dialog)$/.test(attrs.role || '') ||
      /(?:^|[\s_-])(?:ads?|advertisement|advertising|cookie|consent|popup|sidebar|navbar|menu)(?:$|[\s_-])/i.test(
        `${attrs.id || ''} ${attrs.class || ''}`,
      ) ||
      /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs.style || '');
    if (tag === 'img' && !skip) {
      const url = publicAsset(finalUrl, attrs.src || attrs['data-src']);
      if (url) {
        addImage(body, url, attrs.alt || '');
        for (const frame of stack) if (frame.segment) addImage(frame.segment, url, attrs.alt || '');
      }
    }
    if (
      !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) &&
      !token.endsWith('/>')
    ) {
      const segment: Segment | undefined =
        !skip && (tag === 'main' || tag === 'article')
          ? { text: [], images: [], h1: '', entries: [] }
          : undefined;
      if (segment) (tag === 'main' ? mains : articles).push(segment);
      // Bounds pathological nesting without recursive regex / DOM construction.
      if (stack.length > 256)
        throw new Error('Cấu trúc trang quá phức tạp. Hãy nhập nội dung thủ công.');
      const capture =
        !skip && /^(h[1-6]|p|li|blockquote|label)$/.test(tag)
          ? { tag, text: '', order: order++ }
          : undefined;
      if (capture) {
        body.entries.push(capture);
        for (const frame of stack) if (frame.segment) frame.segment.entries.push(capture);
        if (segment) segment.entries.push(capture);
      }
      stack.push({ tag, skip, segment, h1: tag === 'h1', capture });
    }
  }
  const content =
    [...(mains.length ? mains : articles)].sort(
      (a, b) => b.text.join('').length - a.text.join('').length,
    )[0] || body;
  const structured = sourceSections(content.entries);
  const text = structured.text;
  if (
    text.length < 80 ||
    /just a moment|checking your browser|verify you are human|access denied|enable javascript and cookies/i.test(
      text.slice(0, 1000),
    )
  )
    throw new Error(
      'Không đọc được nội dung chính. Trang có thể bị chặn, yêu cầu đăng nhập hoặc chạy JavaScript. Hãy thử lại hoặc nhập thủ công.',
    );
  const images = [...content.images];
  const ogImage = publicAsset(finalUrl, metadata['og:image'] || metadata['twitter:image']);
  if (ogImage && !images.some((i) => i.url === ogImage)) images.unshift({ url: ogImage, alt: '' });
  return {
    sourceUrl,
    finalUrl,
    readAt: new Date().toISOString(),
    title: plain(structured.firstH1 || metadata['og:title'] || title).slice(0, 200),
    description: (metadata.description || metadata['og:description'] || '').slice(0, 500),
    brand: cleanSourceText(
      (metadata['og:site_name'] || metadata['application-name'] || '').split(/[|–—]/)[0] || '',
    ).slice(0, 120),
    text,
    sections: structured.sections,
    images: images.slice(0, 20),
    warnings: [
      'Nội dung nguồn chưa được xác minh độc lập. Kiểm tra dữ kiện trước khi áp dụng.',
      ...(!mains.length && !articles.length
        ? ['Trang không khai báo vùng nội dung chính; đã lọc các vùng điều hướng và nội dung thừa.']
        : []),
    ],
  };
}

export function templateUrlBrief(
  source: Omit<TemplateUrlSource, 'sourceId'>,
): Partial<TemplateContentBrief> {
  // Transfer only explicitly labelled, unambiguous facts. Never treat shipping fees,
  // a crossed-out price, several plans or a random amount as the product price.
  const labelled = (label: string, max: number) => {
    const matches = [
      ...source.text.matchAll(
        new RegExp(`(?:^|\\n)(?:${label})\\s*[:：]\\s*([^\\n]{1,${max}})(?=\\n|$)`, 'gi'),
      ),
    ];
    const values = [...new Set(matches.map((match) => match[1]!.trim()))];
    return values.length === 1 ? values[0]! : '';
  };
  const priceLine = labelled('giá bán|giá sản phẩm|học phí|giá|price', 180);
  const amounts = priceLine.match(/\d[\d.,]*\s*(?:đồng|vnđ|vnd|usd|₫|đ|k\b|triệu)/gi) || [];
  const context = buildEditorialContext(source);
  const curriculum =
    context?.facts
      .filter((f) => f.kind === 'curriculum')
      .map((f) => f.title)
      .join('\n') || '';
  const target =
    context?.facts
      .filter((f) => f.kind === 'audience')
      .map((f) => f.title)
      .join('; ') || '';
  return {
    productName: source.title,
    brandName: source.brand,
    description: (source.description || source.text).slice(0, 2400),
    targetCustomer: (target || labelled('đối tượng|dành cho|khách hàng mục tiêu', 400)).slice(
      0,
      400,
    ),
    price: amounts.length === 1 ? priceLine : '',
    offer: labelled('ưu đãi|khuyến mãi|khuyến mại', 600),
    reviews: '',
    policy: '',
    curriculum: curriculum.length <= 2400 ? curriculum : '',
    schedule: '',
    commitments: '',
  };
}
