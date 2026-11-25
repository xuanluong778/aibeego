/**
 * Serialize JSON-LD for embedding in <script type="application/ld+json">.
 * Escapes characters that could break out of the script context or be parsed as HTML.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}