import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { landingPagePublicCacheTags, landingPagePublicPath } from '@marketingspa/shared';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;

function readBearerSecret(request: Request): string {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

/** Refresh ISR — bearer nội bộ; tag do server tính từ org/page/slug (không nhận tags tùy ý). */
export async function POST(request: Request) {
  const expected = (
    process.env.LANDING_PAGE_REVALIDATE_SECRET ||
    process.env.LP_REVALIDATE_SECRET ||
    ''
  ).trim();
  if (!expected) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  const provided = readBearerSecret(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let body: { organizationId?: unknown; pageId?: unknown; slug?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(pageId) || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, reason: 'invalid_scope' }, { status: 400 });
  }

  const tags = landingPagePublicCacheTags({ organizationId, pageId, slug });
  for (const tag of tags) {
    revalidateTag(tag);
  }
  revalidatePath(landingPagePublicPath(slug));
  return NextResponse.json({ ok: true, slug, pageId, organizationId, tags });
}