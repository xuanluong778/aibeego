import { load } from 'cheerio';
import TurndownService from 'turndown';

type Source = Record<string, unknown>;
const modelLabel = /^(model|mã model|mã máy)$/i;
export function sourceProductModel(source: Source): string | null {
  for (const attribute of Array.isArray(source.attributes) ? source.attributes : []) {
    if (attribute && modelLabel.test(String(attribute.name || '').trim())) {
      const value = String(attribute.option || '').trim();
      if (value && value.length <= 120) return value;
    }
  }
  for (const html of [source.shortDescription, source.description]) {
    const $ = load(String(html || '').slice(0, 150000));
    $('script,style,iframe,object,svg').remove();
    $('br').replaceWith('\n');
    $('p,li,div,tr,h1,h2,h3,h4,h5,h6').append('\n');
    for (const line of $.root().text().split('\n')) {
      const match = line.trim().match(/^(?:model|mã model|mã máy)\s*[:：]\s*(.{1,120})$/i);
      if (match) return match[1]!.trim();
    }
  }
  return null;
}
export function sourceDescriptionMarkdown(value: unknown): string {
  const $ = load(String(value || '').slice(0, 150000));
  $('script,style,iframe,object,embed,svg,math,form,input,button,noscript').remove();
  const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  return converter.turndown($('body').html() || '').trim();
}
export function sourceImages(source: Source): string[] {
  return [
    ...new Set(
      (Array.isArray(source.images) ? source.images : []).flatMap((value) => {
        try {
          const url = new URL(String(value));
          return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
            ? [url.href]
            : [];
        } catch {
          return [];
        }
      }),
    ),
  ].slice(0, 30);
}
