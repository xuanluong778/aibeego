/**
 * LP cache HTTP QA — refresh (trang còn) + retry (token sau xóa).
 * DB: marketingspa_hrm_finance_qa
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { LandingPageStatus } from '@marketingspa/database';

const requireShared = createRequire(__filename);
const sharedDist =
  process.env.LP_QA_SHARED_DIST ||
  join(__dirname, '..', 'packages', 'shared', 'dist');
const { createBlankLandingPageSpec } = requireShared(
  join(sharedDist, 'landing-page-blank-starter.js'),
);

const SECRET = 'landing-page-cache-qa-jwt-secret';
process.env.JWT_SECRET = SECRET;
process.env.LANDING_PAGE_REVALIDATE_SECRET = 'lp-cache-qa-revalidate-secret-32ch';

function signJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + 3600 })).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const cacheCalls: Array<{ organizationId: string; pageId: string; slug: string }> = [];

async function main() {
  console.log('[lp-cache-http] bootstrap');
  const dbName = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/)?.[1];
  assert.equal(dbName, 'marketingspa_hrm_finance_qa');

  const { PrismaService } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { RateLimitService } = await import('../apps/api/dist/common/services/rate-limit.service.js');
  const { LandingPagesController } = await import('../apps/api/dist/landing-pages/landing-pages.controller.js');
  const { LandingPagesService } = await import('../apps/api/dist/landing-pages/landing-pages.service.js');
  const { LandingPagePublicCacheService } = await import(
    '../apps/api/dist/landing-pages/landing-page-public-cache.service.js'
  );
  const { LandingPageTemplatePackService } = await import(
    '../apps/api/dist/landing-pages/landing-page-template-pack.service.js'
  );
  const { LeadsService } = await import('../apps/api/dist/leads/leads.service.js');
  const { AutomationEngineService } = await import('../apps/api/dist/crm/automation-engine.service.js');
  const { LandingPageAiService } = await import('../apps/api/dist/landing-pages/landing-page-ai.service.js');
  const { CreditService } = await import('../apps/api/dist/credit/credit.service.js');
  const { LandingPageChatbotService } = await import('../apps/api/dist/landing-pages/landing-page-chatbot.service.js');
  const { AuthService } = await import('../apps/api/dist/auth/auth.service.js');
  const { JwtStrategy } = await import('../apps/api/dist/auth/jwt.strategy.js');
  const { JwtAuthGuard } = await import('../apps/api/dist/common/guards/auth.guard.js');
  const { TenantGuard } = await import('../apps/api/dist/common/guards/tenant.guard.js');
  const { PermissionsGuard } = await import('../apps/api/dist/common/guards/permissions.guard.js');

  const prisma = new PrismaService();
  await prisma.$connect();

  const qaAuth = {
    async validateUser(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          deletedAt: true,
          organizationId: true,
          employeeId: true,
          role: {
            select: {
              code: true,
              permissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      });
      if (!user?.isActive || user.deletedAt || !user.role) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.code,
        organizationId: user.organizationId,
        employeeId: user.employeeId,
        permissions: user.role.permissions.map((r) => r.permission.code),
      };
    },
  };

  class QaLandingPagePublicCacheService extends LandingPagePublicCacheService {
    async refreshAfterPublication(input: { organizationId: string; pageId: string; slug: string }) {
      cacheCalls.push({ ...input });
      return { ok: true, attempts: 1 };
    }
  }

  const noop = {};

  @Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [LandingPagesController],
    providers: [
      { provide: ConfigService, useValue: { get: (key: string) => process.env[key] } },
      { provide: AuthService, useValue: qaAuth },
      JwtStrategy,
      JwtAuthGuard,
      TenantGuard,
      PermissionsGuard,
      LandingPagesService,
      QaLandingPagePublicCacheService,
      { provide: LandingPagePublicCacheService, useExisting: QaLandingPagePublicCacheService },
      PrismaService,
      RateLimitService,
      { provide: LeadsService, useValue: noop },
      { provide: AutomationEngineService, useValue: { dispatch: async () => undefined } },
      { provide: LandingPageAiService, useValue: noop },
      { provide: CreditService, useValue: noop },
      { provide: LandingPageChatbotService, useValue: noop },
      { provide: LandingPageTemplatePackService, useValue: noop },
    ],
  })
  class QaModule {}

  const app = await NestFactory.create(QaModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
  );
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  function postOk(status: number) {
    return status === 200 || status === 201;
  }

  async function hit(method: string, path: string, token: string, body?: unknown) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  const tag = `LPC-${Date.now()}`;
  const orgA = await prisma.organization.create({ data: { name: `${tag}-A`, slug: `lpa-${randomUUID()}` } });
  const orgB = await prisma.organization.create({ data: { name: `${tag}-B`, slug: `lpb-${randomUUID()}` } });

  for (const code of ['lead.read', 'lead.write']) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code, module: 'crm' },
    });
  }
  const perms = await prisma.permission.findMany({ where: { code: { in: ['lead.read', 'lead.write'] } } });
  const permId = new Map(perms.map((p) => [p.code, p.id]));

  async function userWith(orgId: string, grants: string[], label: string) {
    const role = await prisma.role.create({
      data: { organizationId: orgId, code: `${label}-${randomUUID().slice(0, 8)}`, name: label },
    });
    for (const c of grants) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permId.get(c)! } });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        roleId: role.id,
        name: label,
        email: `${label}-${randomUUID()}@example.invalid`,
      },
    });
    return {
      user,
      token: signJwt({ sub: user.id, email: user.email, organizationId: orgId, role: role.code }),
    };
  }

  const writerA = await userWith(orgA.id, ['lead.read', 'lead.write'], 'writer-a');
  const readerA = await userWith(orgA.id, ['lead.read'], 'reader-a');
  const writerB = await userWith(orgB.id, ['lead.read', 'lead.write'], 'writer-b');

  const spec = createBlankLandingPageSpec() as object;
  const page = await prisma.landingPage.create({
    data: {
      organizationId: orgA.id,
      name: `${tag} page`,
      slug: `qa-${randomUUID().slice(0, 8)}`,
      status: LandingPageStatus.PUBLISHED,
      draftSpec: spec,
      publishedSpec: spec,
      publishedAt: new Date(),
    },
  });

  let ok = 0;
  const pass = (name: string, cond: boolean, detail?: string) => {
    console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
    if (cond) ok++;
    else process.exitCode = 1;
  };

  const refresh = await hit('POST', `/landing-pages/${page.id}/refresh-public-cache`, writerA.token, {});
  pass(
    'Refresh trang còn — có lead.write',
    postOk(refresh.status) &&
      refresh.json?.pageId === page.id &&
      refresh.json?.slug === page.slug &&
      refresh.json?.organizationId === orgA.id &&
      (refresh.json?.cache as { ok?: boolean })?.ok === true,
    `status=${refresh.status}`,
  );

  const cross = await hit('POST', `/landing-pages/${page.id}/refresh-public-cache`, writerB.token, {});
  pass('Refresh — org khác → 404', cross.status === 404, `status=${cross.status}`);

  for (const enforce of ['true', 'false'] as const) {
    process.env.HRM_PERMISSIONS_ENFORCE = enforce;
    const r = await hit('POST', `/landing-pages/${page.id}/refresh-public-cache`, readerA.token, {});
    pass(`Refresh thiếu lead.write enforce=${enforce} → 403`, r.status === 403, `status=${r.status}`);
  }

  process.env.HRM_PERMISSIONS_ENFORCE = 'false';
  for (const enforce of ['true', 'false'] as const) {
    process.env.HRM_PERMISSIONS_ENFORCE = enforce;
    const r = await hit('POST', '/landing-pages/actions/retry-public-cache', readerA.token, {
      cacheRetryToken: 'invalid.token',
    });
    pass(`Retry thiếu lead.write enforce=${enforce} → 403`, r.status === 403, `status=${r.status}`);
  }

  const del = await hit('DELETE', `/landing-pages/${page.id}`, writerA.token);
  const retryToken = del.json?.cacheRetryToken as string | undefined;
  pass(
    'Delete published trả cacheRetryToken',
    postOk(del.status) &&
      del.json?.success === true &&
      typeof retryToken === 'string' &&
      retryToken.includes('.'),
    `status=${del.status} ${del.json?.message ? String(del.json.message) : ''}`,
  );

  const refreshGone = await hit('POST', `/landing-pages/${page.id}/refresh-public-cache`, writerA.token, {});
  pass('Refresh sau xóa → 404', refreshGone.status === 404, `status=${refreshGone.status}`);

  const callsBefore = cacheCalls.length;
  const retryOk = await hit('POST', '/landing-pages/actions/retry-public-cache', writerA.token, {
    cacheRetryToken: retryToken,
  });
  pass(
    'Retry token hợp lệ sau xóa',
    postOk(retryOk.status) && (retryOk.json?.cache as { ok?: boolean })?.ok === true,
    `status=${retryOk.status}`,
  );
  pass('Retry dùng scope từ token (DB không còn trang)', cacheCalls.length > callsBefore);

  const retryOtherOrg = await hit('POST', '/landing-pages/actions/retry-public-cache', writerB.token, {
    cacheRetryToken: retryToken,
  });
  pass('Retry token org A với user org B → 403', retryOtherOrg.status === 403, `status=${retryOtherOrg.status}`);

  await app.close();
  await prisma.$disconnect();

  console.log(`\n[lp-cache-http] ${ok} assertions passed`);
  if ((process.exitCode ?? 0) !== 0) {
    throw new Error('Một hoặc nhiều assertion FAIL');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});