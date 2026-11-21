import { load } from 'cheerio/slim';
import TurndownService from 'turndown';

/** Parse only the already bounded HTML returned by the SSRF-safe fetcher. No network or JS. */
export function ragWebsiteMarkdown(html: string, pageUrl: string): string {
  const $ = load(html.replace(/\[\/?ux_(?:slider2type|image2type)\b[^\]]*\]/gi, ''));
  $(
    'script,style,noscript,iframe,svg,canvas,form,button,input,select,textarea,template,nav,[role="navigation"],[role="banner"],[role="contentinfo"],body > header,body > footer,.site-header,.site-footer,#header,#footer,.sidebar,.widget-area,.breadcrumbs,.breadcrumb,.cookie-banner,.cookie-notice,[hidden],[aria-hidden="true"]',
  ).remove();
  let root: ReturnType<typeof $> = $('body');
  if (!root.length) root = $.root();
  // Prefer a complete main region, rather than the first article/product on a listing page.
  for (const selector of ['main', '[role="main"]', '#main', '#content', '.site-content']) {
    const candidate = $.root().find(selector).first();
    if (candidate.text().trim().length >= 120) {
      root = candidate;
      break;
    }
  }
  root.find('a').each((_, el) => {
    const a = $(el);
    try {
      const url = new URL(a.attr('href') || '', pageUrl);
      if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol))
        a.attr('href', url.toString());
      else a.removeAttr('href');
    } catch {
      a.removeAttr('href');
    }
  });
  // Images/tracking pixels add noise and must never trigger remote requests in the preview.
  root.find('img,picture,source,video,audio').remove();
  root.find('a').each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });
  // Responsive layouts often repeat the same whole block for desktop/mobile.
  // Only remove exact multi-block copies, including their links; keep repeated facts
  // inside lists/tables and never confuse an ancestor with its own child.
  const seen = new Map<string, ReturnType<typeof root.toArray>[number]>();
  root.find('section,article,div').each((_, el) => {
    const block = $(el);
    if (block.closest('table,ul,ol').length || block.find('p,div,h1,h2,h3,h4,h5,h6,li').length < 2)
      return;
    const text = block.text().replace(/\s+/g, ' ').trim();
    if (text.length < 100) return;
    const key = JSON.stringify([
      text,
      block
        .find('a[href]')
        .map((__, a) => $(a).attr('href'))
        .get(),
    ]);
    const previous = seen.get(key);
    if (previous) {
      for (let parent = el.parent; parent; parent = parent.parent) if (parent === previous) return;
      block.remove();
    } else seen.set(key, el);
  });
  const converter = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    hr: '---',
  });
  converter.addRule('page-heading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement: (content, node) =>
      `\n\n${'#'.repeat(Math.min(6, Number(node.nodeName.slice(1)) + 2))} ${content.trim()}\n\n`,
  });
  // Convert tables before Turndown so prices, labels and dates stay associated.
  root.find('table').each((_, table) => {
    const rows: string[][] = [];
    $(table)
      .find('tr')
      .each((__, tr) => {
        const cells = $(tr)
          .children('th,td')
          .map((___, cell) =>
            converter
              .turndown($(cell).html() || '')
              .replace(/\n+/g, ' ')
              .replace(/\|/g, '\\|')
              .trim(),
          )
          .get();
        if (cells.length) rows.push(cells);
      });
    if (!rows.length) return;
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) =>
      `| ${Array.from({ length: width }, (_, i) => r[i] || '').join(' | ')} |`;
    const markdown = [
      line(rows[0]!),
      line(Array(width).fill('---')),
      ...rows.slice(1).map(line),
    ].join('\n');
    // A text node avoids interpreting the converted content as HTML again.
    const replacement = $('<div></div>').text(`\n\n${markdown}\n\n`);
    $(table).replaceWith(replacement);
  });
  // Table pipes must stay literal; escaping by the default text rule would break GFM.
  converter.addRule('markdown-table', {
    filter: (node) =>
      node.nodeName === 'DIV' && /^\s*\|[^\n]*\|\n\| ---/.test(node.textContent || ''),
    replacement: (_, node) => `\n\n${node.textContent?.trim()}\n\n`,
  });
  return converter
    .turndown(root.html() || '')
    .normalize('NFC')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
