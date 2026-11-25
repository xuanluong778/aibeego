/**
 * Phiên đăng nhập QA — refresh nguyên tử, upload Bearer/signed, HTTP thật.
 * DB: marketingspa_hrm_finance_qa (fixture) hoặc DATABASE_URL hiện có.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { HttpException } from '@nestjs/common';

const results: Array<{ name: string; status: 'PASS' | 'FAIL' | 'CHƯA KIỂM CHỨNG'; detail?: string }> = [];

function record(name: string, status: 'PASS' | 'FAIL' | 'CHƯA KIỂM CHỨNG', detail?: string) {
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (status === 'FAIL') process.exitCode = 1;
}

function refreshErrCode(err: unknown): string | undefined {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'object' && body && 'code' in body) {
      return String((body as { code: string }).code);
    }
  }
  return undefined;
}

function signAccessJwt(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function main() {
  console.log('[auth-session] bootstrap');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'auth-session-qa-jwt-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  process.env.UPLOAD_SIGNING_SECRET = process.env.UPLOAD_SIGNING_SECRET || 'auth-session-upload-sign-32chars-min';

  const { PrismaService } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { AuthService } = await import('../apps/api/dist/auth/auth.service.js');
  const { RateLimitService } = await import('../apps/api/dist/common/services/rate-limit.service.js');
  const { AuditService } = await import('../apps/api/dist/audit/audit.service.js');
  const { AuthMailService } = await import('../apps/api/dist/auth/auth-mail.service.js');
  const { GoogleTokenVerifier } = await import('../apps/api/dist/auth/google-token.verifier.js');
  const { AffiliateService } = await import('../apps/api/dist/affiliate/affiliate.service.js');

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      JwtModule.register({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    ],
    providers: [
      PrismaService,
      RateLimitService,
      { provide: AuditService, useValue: { log: async () => undefined } },
      { provide: AuthMailService, useValue: {} },
      { provide: GoogleTokenVerifier, useValue: { verify: async () => null } },
      { provide: AffiliateService, useValue: { ensureProfile: async () => undefined } },
      AuthService,
    ],
  })
  class QaModule {}

  const app = await NestFactory.create(QaModule, { logger: false });
  const auth = app.get(AuthService);
  const prisma = app.get(PrismaService);
  await prisma.$connect();

  const tag = `AUTH-${Date.now()}`;
  const org = await prisma.organization.create({
    data: { name: `${tag}-org`, slug: `auth-${randomUUID().slice(0, 8)}` },
  });
  const role = await prisma.role.create({
    data: { organizationId: org.id, code: `owner-${randomUUID().slice(0, 6)}`, name: 'Owner' },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'Auth QA',
      email: `auth-qa-${randomUUID()}@example.invalid`,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    include: { role: true },
  });

  const { refreshToken } = await auth.issueTokens(
    {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: { code: user.role.code },
    },
    { ip: '127.0.0.1' },
  );

  const [a, b] = await Promise.allSettled([
    auth.refresh(refreshToken, { ip: '127.0.0.1' }),
    auth.refresh(refreshToken, { ip: '127.0.0.1' }),
  ]);
  const ok = [a, b].filter((r) => r.status === 'fulfilled').length;
  const reusedNest = [a, b].filter(
    (r) => r.status === 'rejected' && refreshErrCode(r.reason) === 'REFRESH_ALREADY_USED',
  ).length;

  record(
    'Refresh đồng thời — đúng 1 thành công',
    ok === 1 && (reusedNest >= 1 || ok === 1) ? 'PASS' : 'FAIL',
    `fulfilled=${ok} reused=${reusedNest}`,
  );

  const winner = a.status === 'fulfilled' ? a : b.status === 'fulfilled' ? b : null;
  if (winner?.status === 'fulfilled') {
    try {
      await auth.refresh(refreshToken, { ip: '127.0.0.1' });
      record('Refresh token cũ sau xoay → REFRESH_ALREADY_USED', 'FAIL', 'unexpected ok');
    } catch (e) {
      record(
        'Refresh token cũ sau xoay → REFRESH_ALREADY_USED',
        refreshErrCode(e) === 'REFRESH_ALREADY_USED' ? 'PASS' : 'FAIL',
        refreshErrCode(e) || 'no code',
      );
    }
  }

  const activeSessions = await prisma.authSession.count({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  record(
    'Concurrent refresh — đúng 1 phiên active trong DB',
    activeSessions === 1 ? 'PASS' : 'FAIL',
    `active=${activeSessions}`,
  );

  // --- HTTP thật: song song qua POST /auth/refresh + cookie ---
  const { AuthController } = await import('../apps/api/dist/auth/auth.controller.js');
  const { REFRESH_COOKIE_NAME } = await import('../apps/api/dist/auth/auth-cookie.util.js');
  const { PassportModule } = await import('@nestjs/passport');
  const { JwtStrategy } = await import('../apps/api/dist/auth/jwt.strategy.js');

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    ],
    controllers: [AuthController],
    providers: [
      PrismaService,
      RateLimitService,
      { provide: AuditService, useValue: { log: async () => undefined } },
      { provide: AuthMailService, useValue: {} },
      { provide: GoogleTokenVerifier, useValue: { verify: async () => null } },
      { provide: AffiliateService, useValue: { ensureProfile: async () => undefined } },
      AuthService,
      JwtStrategy,
    ],
  })
  class HttpQaModule {}

  const httpApp = await NestFactory.create(HttpQaModule, { logger: false });
  const express = httpApp.getHttpAdapter().getInstance();
  express.set('trust proxy', 1);
  httpApp.use(cookieParser());
  httpApp.setGlobalPrefix('api/v1');
  process.env.AUTH_SESSION_QA_HOLD_MS = process.env.AUTH_SESSION_QA_HOLD_MS || '300';
  await httpApp.listen(0, '127.0.0.1');
  const httpPort = (httpApp.getHttpServer().address() as { port: number }).port;
  const httpBase = `http://127.0.0.1:${httpPort}`;

  const user2 = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'HTTP QA',
      email: `auth-http-${randomUUID()}@example.invalid`,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    include: { role: true },
  });
  const issued2 = await auth.issueTokens(
    {
      id: user2.id,
      email: user2.email,
      organizationId: user2.organizationId,
      role: { code: user2.role.code },
    },
    { ip: '10.0.0.1' },
  );
  const rt2 = issued2.refreshToken;
  const cookieHdr = `${REFRESH_COOKIE_NAME}=${rt2}`;

  function readSetCookie(res: Response): string {
    if (typeof res.headers.getSetCookie === 'function') {
      return res.headers.getSetCookie().join('; ');
    }
    return res.headers.get('set-cookie') ?? '';
  }

  function parseRefreshSid(refreshTok: string): string | null {
    try {
      const part = refreshTok.split('.')[1];
      if (!part) return null;
      const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sid?: string };
      return typeof payload.sid === 'string' ? payload.sid : null;
    } catch {
      return null;
    }
  }

  async function waitForRotatedSession(userId: string, rootSid: string, timeoutMs = 8000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM auth_sessions
        WHERE user_id = ${userId}
          AND rotation_root_id = ${rootSid}
          AND id::text <> ${rootSid}
          AND revoked_at IS NULL
          AND expires_at > NOW()
      `;
      if ((rows[0]?.c ?? 0) >= 1) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    return false;
  }

  function parseRefreshCookie(setCookie: string): { header: string; token: string } | null {
    if (!setCookie) return null;
    const m = /ms_refresh_token=([^;]+)/.exec(setCookie);
    if (!m?.[1]) return null;
    const token = decodeURIComponent(m[1].trim());
    return { header: `${REFRESH_COOKIE_NAME}=${token}`, token };
  }

  async function httpRefresh(
    refreshTok: string,
    refreshCookie: string,
    opts?: { holdResponse?: boolean },
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: refreshCookie,
    };
    if (opts?.holdResponse) headers['x-auth-session-qa-hold'] = '1';
    const res = await fetch(`${httpBase}/api/v1/auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken: refreshTok }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const setCookie = readSetCookie(res);
    return { status: res.status, body, setCookie };
  }

  async function httpLogout(accessTok: string, refreshCookie: string) {
    const res = await fetch(`${httpBase}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessTok}`,
        Cookie: refreshCookie,
      },
    });
    return { status: res.status, setCookie: readSetCookie(res) };
  }

  const [h1, h2] = await Promise.all([httpRefresh(rt2, cookieHdr), httpRefresh(rt2, cookieHdr)]);
  const httpOk = [h1, h2].filter((r) => r.status === 200 || r.status === 201).length;
  const httpReused = [h1, h2].filter(
    (r) => r.status === 401 && typeof r.body.code === 'string' && r.body.code === 'REFRESH_ALREADY_USED',
  ).length;
  record(
    'HTTP — hai refresh đồng thời: 1×200, 1×401 REFRESH_ALREADY_USED',
    httpOk === 1 && httpReused === 1 ? 'PASS' : 'FAIL',
    `ok=${httpOk} reused=${httpReused} s1=${h1.status} s2=${h2.status} c1=${h1.body?.code ?? '-'} c2=${h2.body?.code ?? '-'}`,
  );

  const loser = h1.status === 401 ? h1 : h2;
  const winnerHttp = h1.status === 200 || h1.status === 201 ? h1 : h2;
  record(
    'HTTP — response thua không ghi đè cookie thắng',
    loser.setCookie === '' || !loser.setCookie.includes(REFRESH_COOKIE_NAME) ? 'PASS' : 'FAIL',
    loser.setCookie ? 'loser had Set-Cookie' : 'no Set-Cookie on loser',
  );
  record(
    'HTTP — response thắng có accessToken',
    typeof winnerHttp.body.accessToken === 'string' && winnerHttp.body.accessToken.length > 10 ? 'PASS' : 'FAIL',
  );

  express.set('trust proxy', false);
  let got429Direct = false;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${httpBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `198.51.100.${i}`,
      },
      body: JSON.stringify({ email: `qa-direct-${i}@example.invalid`, password: 'wrong-qa-pass' }),
    });
    if (res.status === 429) {
      got429Direct = true;
      break;
    }
  }
  record(
    'HTTP direct — rate limit theo IP Express (XFF giả không né)',
    got429Direct ? 'PASS' : 'FAIL',
    got429Direct ? '429' : 'no 429 in 20 tries',
  );

  const user3 = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'Logout race',
      email: `auth-race-${randomUUID()}@example.invalid`,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    include: { role: true },
  });
  const issued3 = await auth.issueTokens(
    {
      id: user3.id,
      email: user3.email,
      organizationId: user3.organizationId,
      role: { code: user3.role.code },
    },
    { ip: '127.0.0.1' },
  );
  const cookie3 = `${REFRESH_COOKIE_NAME}=${issued3.refreshToken}`;
  const refreshLateP = httpRefresh(issued3.refreshToken, cookie3);
  const logout3 = await httpLogout(issued3.accessToken, cookie3);
  const refreshLateRes = await refreshLateP;
  const refreshAgain3 = await httpRefresh(issued3.refreshToken, cookie3);
  record(
    'HTTP — logout API thành công (B, cookie cùng tài khoản)',
    logout3.status === 200 || logout3.status === 201 ? 'PASS' : 'FAIL',
    `status=${logout3.status}`,
  );
  record(
    'HTTP — A refresh + B logout → không refresh lần 2 (cookie/token cũ)',
    refreshAgain3.status === 401 ? 'PASS' : 'FAIL',
    `late=${refreshLateRes.status} again=${refreshAgain3.status}`,
  );
  const reloadRefresh3 = await fetch(`${httpBase}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie3 },
    body: JSON.stringify({ refreshToken: issued3.refreshToken }),
  });
  const reloadEmpty3 = await fetch(`${httpBase}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  record(
    'HTTP — reload (không cookie) sau logout → từ chối',
    reloadEmpty3.status === 401 && reloadRefresh3.status === 401 ? 'PASS' : 'FAIL',
    `body=${reloadRefresh3.status} empty=${reloadEmpty3.status}`,
  );
  let activeAfterLogout = await prisma.authSession.count({
    where: { userId: user3.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  record(
    'HTTP — sau logout race (cookie cũ) không còn phiên active DB',
    activeAfterLogout === 0 ? 'PASS' : 'FAIL',
    `active=${activeAfterLogout}`,
  );

  const user4 = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'Late Set-Cookie',
      email: `auth-late-${randomUUID()}@example.invalid`,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    include: { role: true },
  });
  const issued4 = await auth.issueTokens(
    {
      id: user4.id,
      email: user4.email,
      organizationId: user4.organizationId,
      role: { code: user4.role.code },
    },
    { ip: '127.0.0.1' },
  );
  const issued4Other = await auth.issueTokens(
    {
      id: user4.id,
      email: user4.email,
      organizationId: user4.organizationId,
      role: { code: user4.role.code },
    },
    { ip: '127.0.0.2', userAgent: 'AuthQA-OtherDevice' },
  );
  const cookie4 = `${REFRESH_COOKIE_NAME}=${issued4.refreshToken}`;
  const rootSid4 = parseRefreshSid(issued4.refreshToken);
  const refreshLateP4 = httpRefresh(issued4.refreshToken, cookie4, { holdResponse: true });
  const rotatedBeforeLogout =
    rootSid4 != null ? await waitForRotatedSession(user4.id, rootSid4) : false;
  record(
    'HTTP — refresh xoay phiên mới trước khi gọi logout',
    rotatedBeforeLogout ? 'PASS' : 'FAIL',
    `rootSid=${rootSid4 ?? 'n/a'}`,
  );
  const logoutOld4 = await httpLogout(issued4.accessToken, cookie4);
  const refreshLate4 = await refreshLateP4;
  const lateParsed = parseRefreshCookie(refreshLate4.setCookie);
  const refreshCreatedSession =
    (refreshLate4.status === 200 || refreshLate4.status === 201) && !!lateParsed;

  record(
    'HTTP — chỉ logout (cookie đăng nhập) trước response refresh giữ lại',
    logoutOld4.status === 200 || logoutOld4.status === 201 ? 'PASS' : 'FAIL',
    `logout=${logoutOld4.status} lateRefresh=${refreshLate4.status}`,
  );

  if (refreshCreatedSession && lateParsed) {
    record(
      'HTTP — refresh tạo phiên mới trước khi trả Set-Cookie muộn',
      lateParsed.token !== issued4.refreshToken ? 'PASS' : 'FAIL',
      `newRt=yes`,
    );
    const probeNew = await httpRefresh(lateParsed.token, lateParsed.header);
    record(
      'HTTP — cookie mới sau một lần logout → refresh 401',
      probeNew.status === 401 ? 'PASS' : 'FAIL',
      `status=${probeNew.status}`,
    );
  } else {
    const probeOld = await httpRefresh(issued4.refreshToken, cookie4);
    record(
      'HTTP — refresh thua / không Set-Cookie mới sau logout',
      refreshLate4.status === 401 ? 'PASS' : 'FAIL',
      `late=${refreshLate4.status}`,
    );
    record(
      'HTTP — cookie đăng nhập sau logout → refresh 401',
      probeOld.status === 401 ? 'PASS' : 'FAIL',
      `status=${probeOld.status}`,
    );
    record('HTTP — cookie mới sau một lần logout → refresh 401', 'FAIL', 'no late Set-Cookie');
  }

  const activeLogoutChain = await prisma.authSession.count({
    where: {
      userId: user4.id,
      ipAddress: '127.0.0.1',
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  record(
    'HTTP — DB không phiên active lần đăng nhập vừa thoát',
    activeLogoutChain === 0 ? 'PASS' : 'FAIL',
    `activeChain=${activeLogoutChain}`,
  );
  const activeOtherDevice = await prisma.authSession.count({
    where: {
      userId: user4.id,
      ipAddress: '127.0.0.2',
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  record(
    'HTTP — phiên đăng nhập khác (thiết bị khác) vẫn active',
    activeOtherDevice === 1 ? 'PASS' : 'FAIL',
    `activeOther=${activeOtherDevice}`,
  );

  await httpApp.close();

  const { signUploadPath, verifyUploadSignature } = await import(
    '../apps/api/dist/common/uploads/upload-signed-url.js'
  );
  const { createAuthenticatedUploadsHandler } = await import(
    '../apps/api/dist/common/middleware/authenticated-uploads.middleware.js'
  );

  const { exp, sig } = signUploadPath(`hrm/${org.id}/doc.pdf`, 120);
  record('Upload signed URL verify', verifyUploadSignature(`hrm/${org.id}/doc.pdf`, exp, sig) ? 'PASS' : 'FAIL');

  const jwt = app.get(JwtService);
  const orgB = await prisma.organization.create({
    data: { name: `${tag}-B`, slug: `authb-${randomUUID().slice(0, 8)}` },
  });
  const foreignToken = signAccessJwt(
    { sub: user.id, organizationId: orgB.id, role: 'OWNER' },
    process.env.JWT_SECRET!,
  );

  const uploadsRoot = join(process.cwd(), 'qa-uploads-fixture');
  mkdirSync(join(uploadsRoot, 'hrm', org.id), { recursive: true });
  const fixtureName = 'qa-doc.pdf';
  const fixtureRel = `hrm/${org.id}/${fixtureName}`;
  const fixtureAbs = join(uploadsRoot, 'hrm', org.id, fixtureName);
  writeFileSync(fixtureAbs, '%PDF-1.4 qa fixture\n');

  const ownToken = signAccessJwt(
    { sub: user.id, organizationId: org.id, role: user.role.code },
    process.env.JWT_SECRET!,
  );

  const uploadsHandler = createAuthenticatedUploadsHandler({
    uploadsDir: uploadsRoot,
    jwt,
  });

  async function probeUpload(
    relPath: string,
    opts: { bearer?: string; exp?: number; sig?: string } = {},
  ): Promise<number> {
    return new Promise((resolve) => {
      const req = {
        path: `/uploads/${relPath}`,
        headers: opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {},
        query: {} as Record<string, string | number>,
      } as import('express').Request;
      if (opts.exp != null && opts.sig) {
        req.query = { exp: String(opts.exp), sig: opts.sig };
      }
      let status = 0;
      const sink = new PassThrough();
      const res = Object.assign(sink, {
        statusCode: 200,
        headers: {} as Record<string, string>,
        status(code: number) {
          status = code;
          (res as { statusCode: number }).statusCode = code;
          return res;
        },
        setHeader() {
          return res;
        },
        json() {
          resolve(status || 401);
        },
      }) as unknown as import('express').Response;
      sink.on('finish', () => resolve(status || 200));
      sink.on('error', () => resolve(500));
      void uploadsHandler(req, res, () => resolve(status));
    });
  }

  const sameOrgStatus = await probeUpload(fixtureRel, { bearer: ownToken });
  record(
    'Upload — cùng tổ chức Bearer tải được (HTTP handler)',
    sameOrgStatus === 200 ? 'PASS' : 'FAIL',
    `status=${sameOrgStatus}`,
  );

  const foreignStatus = await probeUpload(fixtureRel, { bearer: foreignToken });
  record(
    'Upload — JWT org khác → 403',
    foreignStatus === 403 ? 'PASS' : 'FAIL',
    `status=${foreignStatus}`,
  );

  const { exp: goodExp, sig: goodSig } = signUploadPath(fixtureRel, 120);
  const signedOk = await probeUpload(fixtureRel, { exp: goodExp, sig: goodSig });
  record('Upload — link ký hợp lệ', signedOk === 200 ? 'PASS' : 'FAIL', `status=${signedOk}`);

  const expiredExp = Math.floor(Date.now() / 1000) - 60;
  const expiredSig = createHmac('sha256', process.env.UPLOAD_SIGNING_SECRET!)
    .update(`upload:${fixtureRel}:${expiredExp}`)
    .digest('hex');
  const signedBad = await probeUpload(fixtureRel, { exp: expiredExp, sig: expiredSig });
  record(
    'Upload — link ký hết hạn bị chặn',
    signedBad === 401 || signedBad === 403 ? 'PASS' : 'FAIL',
    `status=${signedBad}`,
  );

  const { EventsGateway } = await import('../apps/api/dist/events/events.gateway.js');
  const { ConfigService } = await import('@nestjs/config');
  const configSvc = new ConfigService();
  const gateway = new EventsGateway(jwt, configSvc, prisma);
  const socketToken = signAccessJwt(
    { sub: user.id, organizationId: org.id },
    process.env.JWT_SECRET!,
  );
  let sockDisconnected = false;
  function mockSocket(token: string, userId: string, orgId: string) {
    const disconnectListeners: Array<() => void> = [];
    return {
      handshake: { auth: { token }, query: {} },
      data: {} as Record<string, unknown>,
      join() {
        return undefined;
      },
      on(ev: string, fn: () => void) {
        if (ev === 'disconnect') disconnectListeners.push(fn);
      },
      disconnect() {
        sockDisconnected = true;
        for (const fn of disconnectListeners) fn();
      },
    };
  }
  const activeSocket = mockSocket(socketToken, user.id, org.id);
  await gateway.handleConnection(activeSocket as import('socket.io').Socket);
  record('Socket — user active + đúng org vào room', sockDisconnected ? 'FAIL' : 'PASS');
  activeSocket.disconnect();

  const inactiveUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'Inactive',
      email: `auth-inact-${randomUUID()}@example.invalid`,
      isActive: false,
      emailVerifiedAt: new Date(),
    },
  });
  const inactToken = signAccessJwt(
    { sub: inactiveUser.id, organizationId: org.id },
    process.env.JWT_SECRET!,
  );
  sockDisconnected = false;
  const inactSocket = mockSocket(inactToken, inactiveUser.id, org.id);
  await gateway.handleConnection(inactSocket as import('socket.io').Socket);
  record('Socket — user inactive bị disconnect (fixture)', sockDisconnected ? 'PASS' : 'FAIL');

  const liveUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'Socket live',
      email: `auth-sock-${randomUUID()}@example.invalid`,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  const liveTok = signAccessJwt({ sub: liveUser.id, organizationId: org.id }, process.env.JWT_SECRET!);
  sockDisconnected = false;
  let leftRoom = false;
  const liveSocket = {
    handshake: { auth: { token: liveTok }, query: {} },
    data: {
      userId: liveUser.id,
      organizationId: org.id,
      orgRoom: `org:${org.id}`,
    } as Record<string, unknown>,
    join() {
      return undefined;
    },
    leave() {
      leftRoom = true;
    },
    disconnect() {
      sockDisconnected = true;
    },
    on() {
      return undefined;
    },
  };
  const liveOk = await gateway.enforceSocketMembership(liveSocket as import('socket.io').Socket);
  record('Socket — enforceMembership user active', liveOk ? 'PASS' : 'FAIL');
  await prisma.user.update({ where: { id: liveUser.id }, data: { isActive: false } });
  const liveBad = await gateway.enforceSocketMembership(liveSocket as import('socket.io').Socket);
  record(
    'Socket — enforceMembership sau vô hiệu hóa → leave + disconnect',
    !liveBad && leftRoom && sockDisconnected ? 'PASS' : 'FAIL',
  );

  record('Google OAuth browser QA', 'CHƯA KIỂM CHỨNG', 'cần browser thật + Google client QA');
  record('OTP đăng ký browser QA', 'CHƯA KIỂM CHỨNG', 'cần mail catcher / OTP fixture E2E');
  record('Socket.IO reconnect sau refresh', 'CHƯA KIỂM CHỨNG', 'xem RealtimeProvider + auth-coordinator');
  record('Reload + multi-tab browser', 'CHƯA KIỂM CHỨNG', 'xem test-auth-session-browser.cjs');
  record('Logout khi đang refresh (browser)', 'CHƯA KIỂM CHỨNG', 'epoch — xem browser suite');
  record('Thông báo mất giữa các tab (browser)', 'CHƯA KIỂM CHỨNG', 'BroadcastChannel ms-auth-v1');

  await app.close();
  await prisma.$disconnect();

  const pass = results.filter((r) => r.status === 'PASS').length;
  console.log(`\n[auth-session] ${pass}/${results.length} PASS (+ CHƯA KIỂM CHỨNG)`);
  if ((process.exitCode ?? 0) !== 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});