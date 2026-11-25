/**
 * Nhân sự + Tài chính — JWT thật (passport-jwt) trên marketingspa_hrm_finance_qa.
 * Thiếu quyền cấp role / hoàn tiền → 403 cả khi HRM_PERMISSIONS_ENFORCE true và false.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { defaultPermissionCodesForRole } from '../apps/api/dist/common/constants/roles.js';

const SECRET = 'hrm-finance-qa-jwt-secret';
process.env.JWT_SECRET = SECRET;

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + 3600 })).toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

type Row = { name: string; status: 'PASS' | 'FAIL' | 'CHƯA KIỂM CHỨNG'; detail?: string };
const results: Row[] = [];

function record(name: string, status: Row['status'], detail?: string) {
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

function check(name: string, ok: boolean, detail?: string) {
  record(name, ok ? 'PASS' : 'FAIL', detail);
}

async function main() {
  const dbName = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/)?.[1];
  assert.equal(dbName, 'marketingspa_hrm_finance_qa');

  const sale = defaultPermissionCodesForRole('SALE');
  const salesCodes = sale.filter((code) => code.startsWith('sales.')).sort();
  check(
    'Bộ quyền Bán hàng của SALE không đổi',
    JSON.stringify(salesCodes) ===
      JSON.stringify(
        [
          'sales.inventory.read',
          'sales.inventory.write',
          'sales.payment.collect',
          'sales.receive.write',
          'sales.stocktake.write',
        ].sort(),
      ),
    salesCodes.join(','),
  );
  check('SALE không có sales.payment.refund', !sale.includes('sales.payment.refund'));
  check('SALE có finance.read / ghi nhận thanh toán', sale.includes('finance.read') && sale.includes('finance.payment.record'));
  check('SALE không có hoàn tiền hoặc quản lý chi phí tài chính', !sale.includes('finance.payment.refund') && !sale.includes('finance.expense.manage'));
  check('HR có hrm.role.assign, không có hoàn tiền tài chính', defaultPermissionCodesForRole('HR').includes('hrm.role.assign') && !defaultPermissionCodesForRole('HR').includes('finance.payment.refund'));
  check('MANAGER có hoàn tiền và quản lý chi phí', defaultPermissionCodesForRole('MANAGER').includes('finance.payment.refund') && defaultPermissionCodesForRole('MANAGER').includes('finance.expense.manage'));
  const saleDefault = defaultPermissionCodesForRole('SALE');
  check(
    'SALE: CRM đọc/ghi (customer, lead) + order.read/write',
    saleDefault.includes('customer.read') &&
      saleDefault.includes('customer.write') &&
      saleDefault.includes('lead.read') &&
      saleDefault.includes('lead.write') &&
      saleDefault.includes('order.read') &&
      saleDefault.includes('order.write'),
  );
  check(
    'SALE: không hrm.account.manage / hrm.role.assign / finance hoàn-chi / sales hoàn / giá vốn',
    !saleDefault.includes('hrm.account.manage') &&
      !saleDefault.includes('hrm.role.assign') &&
      !saleDefault.includes('finance.payment.refund') &&
      !saleDefault.includes('finance.expense.manage') &&
      !saleDefault.includes('sales.payment.refund') &&
      !saleDefault.includes('sales.cost.view'),
    saleDefault.filter((c) => c.startsWith('finance.')).join(','),
  );
  check('SALE: finance.read + order.manage + payment.record (vận hành POS)', saleDefault.includes('finance.read') && saleDefault.includes('finance.order.manage') && saleDefault.includes('finance.payment.record'));

  const { PrismaService } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { AuditService } = await import('../apps/api/dist/audit/audit.service.js');
  const { EmployeesService } = await import('../apps/api/dist/employees/employees.service.js');
  const { EmployeesController } = await import('../apps/api/dist/employees/employees.controller.js');
  const { HrmEmployeesService } = await import('../apps/api/dist/hrm/hrm-employees.service.js');
  const { HrmEmployeesController } = await import('../apps/api/dist/hrm/hrm-employees.controller.js');
  const { HrmContractsService } = await import('../apps/api/dist/hrm/hrm-contracts.service.js');
  const { HrmDocumentsService } = await import('../apps/api/dist/hrm/hrm-documents.service.js');
  const { FinanceService } = await import('../apps/api/dist/finance/finance.service.js');
  const { FinanceController } = await import('../apps/api/dist/finance/finance.controller.js');
  const { TenantOwnershipService } = await import('../apps/api/dist/common/services/tenant-ownership.service.js');
  const { PipelineService } = await import('../apps/api/dist/crm/pipeline.service.js');
  const bcrypt = await import('bcryptjs');
  const { AuthService } = await import('../apps/api/dist/auth/auth.service.js');
  const { JwtStrategy } = await import('../apps/api/dist/auth/jwt.strategy.js');
  const { JwtAuthGuard } = await import('../apps/api/dist/common/guards/auth.guard.js');
  const { TenantGuard } = await import('../apps/api/dist/common/guards/tenant.guard.js');
  const { PermissionsGuard } = await import('../apps/api/dist/common/guards/permissions.guard.js');

  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const employees = new EmployeesService(prisma, audit);
  const hrmEmployees = new HrmEmployeesService(prisma, audit);
  const contracts = new HrmContractsService(prisma, audit, hrmEmployees);
  const documents = new HrmDocumentsService(
    prisma,
    audit,
    hrmEmployees,
    { get: (key: string) => process.env[key] } as ConfigService,
  );
  const finance = new FinanceService(
    prisma,
    new TenantOwnershipService(prisma),
    { onPayment: async () => undefined, onLeadQualified: async () => undefined } as never,
    audit,
    new PipelineService(prisma),
    { broadcastLeadStatusChanged() {} } as never,
  );

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
      if (!user || !user.isActive || user.deletedAt || !user.role) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.code,
        organizationId: user.organizationId,
        employeeId: user.employeeId,
        permissions: user.role.permissions.map((row: { permission: { code: string } }) => row.permission.code),
      };
    },
  };

  const tag = `HF-${Date.now()}`;
  const orgA = await prisma.organization.create({ data: { name: `${tag}-A`, slug: `hfa-${randomUUID()}` } });
  const orgB = await prisma.organization.create({ data: { name: `${tag}-B`, slug: `hfb-${randomUUID()}` } });
  const grantOrg = await prisma.organization.create({ data: { name: `${tag}-G`, slug: `hfg-${randomUUID()}` } });

  const permCodes = [
    'hrm.employee.read',
    'hrm.employee.write',
    'hrm.account.manage',
    'hrm.role.assign',
    'finance.read',
    'finance.order.manage',
    'finance.payment.record',
    'finance.payment.refund',
    'finance.expense.manage',
    'sales.payment.refund',
    'sales.payment.collect',
    'order.write',
  ];
  for (const code of permCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code, module: code.startsWith('hrm.') ? 'hrm' : code.startsWith('finance.') ? 'finance' : 'sales' },
    });
  }
  const permRows = await prisma.permission.findMany({ where: { code: { in: permCodes } } });
  const permId = new Map(permRows.map((row: { code: string; id: string }) => [row.code, row.id]));

  async function actor(
    orgId: string,
    roleCode: string,
    grant: string[],
    label: string,
    employeeId?: string,
  ) {
    const role = await prisma.role.create({
      data: { organizationId: orgId, code: roleCode, name: label },
    });
    for (const code of grant) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permId.get(code)! },
      });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        roleId: role.id,
        employeeId,
        name: label,
        email: `${label}-${randomUUID()}@example.invalid`,
      },
    });
    const token = signJwt(
      { sub: user.id, email: user.email, organizationId: orgId, role: roleCode },
      SECRET,
    );
    return { user, token, role };
  }

  const profileOnly = await actor(orgA.id, 'PROFILE_CLERK', ['hrm.employee.read', 'hrm.employee.write'], 'profile-only');
  const manager = await actor(
    orgA.id,
    'MANAGER',
    [
      'hrm.employee.read',
      'hrm.employee.write',
      'hrm.account.manage',
      'hrm.role.assign',
      'finance.read',
      'finance.order.manage',
      'finance.payment.record',
      'finance.payment.refund',
      'finance.expense.manage',
    ],
    'manager',
  );
  const staff = await actor(
    orgA.id,
    'SALE',
    ['finance.read', 'finance.order.manage', 'finance.payment.record', 'sales.payment.collect', 'order.write'],
    'staff-no-refund',
  );
  const salesRefundOnly = await actor(orgA.id, 'CASHIER', ['sales.payment.refund', 'finance.read'], 'sales-refund-only');
  const orgBUser = await actor(
    orgB.id,
    'MANAGER',
    ['hrm.employee.read', 'hrm.employee.write', 'hrm.role.assign', 'finance.read', 'finance.payment.refund'],
    'org-b',
  );

  const techRole = await prisma.role.create({
    data: { organizationId: orgA.id, code: 'TECHNICIAN', name: 'KTV' },
  });
  await prisma.role.create({
    data: { organizationId: orgA.id, code: 'MARKETING', name: 'MKT' },
  });
  await prisma.role.create({
    data: { organizationId: orgA.id, code: 'OWNER', name: 'Owner' },
  });

  const targetEmployee = await prisma.employee.create({
    data: { organizationId: orgA.id, name: `${tag}-NV`, position: 'KTV' },
  });
  const oldPasswordHash = await bcrypt.hash('OldPass1', 12);
  const targetUser = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      roleId: techRole.id,
      employeeId: targetEmployee.id,
      name: targetEmployee.name,
      email: `target-${randomUUID()}@example.invalid`,
      passwordHash: oldPasswordHash,
    },
  });
  const highTargetEmployee = await prisma.employee.create({
    data: { organizationId: orgA.id, name: `${tag}-MGR-TGT`, position: 'Quản lý' },
  });
  const highTargetUser = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      roleId: manager.role.id,
      employeeId: highTargetEmployee.id,
      name: highTargetEmployee.name,
      email: `mgr-tgt-${randomUUID()}@example.invalid`,
      passwordHash: oldPasswordHash,
    },
  });

  const selfEmployee = await prisma.employee.create({
    data: { organizationId: orgA.id, name: `${tag}-SELF`, position: 'HR' },
  });
  const selfHr = await actor(
    orgA.id,
    'HR',
    ['hrm.employee.write', 'hrm.role.assign', 'hrm.account.manage'],
    'self-hr',
    selfEmployee.id,
  );
  const bareEmployee = await prisma.employee.create({
    data: { organizationId: orgA.id, name: `${tag}-BARE` },
  });
  const blockedEmployee = await prisma.employee.create({
    data: { organizationId: orgA.id, name: `${tag}-BLOCK` },
  });

  const customer = await prisma.customer.create({
    data: { organizationId: orgA.id, name: `${tag}-KH` },
  });
  const order = await prisma.order.create({
    data: {
      organizationId: orgA.id,
      customerId: customer.id,
      orderNumber: `${tag}-ORD`,
      subtotal: 50000,
      total: 50000,
      items: { create: [{ name: 'Lieu trinh', quantity: 1, unitPrice: 50000, totalPrice: 50000 }] },
    },
  });
  const payment = await prisma.payment.create({
    data: {
      organizationId: orgA.id,
      orderId: order.id,
      amount: 50000,
      method: 'CASH',
      status: 'COMPLETED',
      paidAt: new Date(),
    },
  });

  const legacyManager = await prisma.role.create({
    data: { organizationId: grantOrg.id, code: 'MANAGER', name: 'Legacy manager' },
  });
  const legacyHr = await prisma.role.create({
    data: { organizationId: grantOrg.id, code: 'HR', name: 'Legacy HR' },
  });
  const legacySale = await prisma.role.create({
    data: { organizationId: grantOrg.id, code: 'SALE', name: 'Legacy sale' },
  });
  const refundPerm = permId.get('sales.payment.refund')!;
  await prisma.rolePermission.create({ data: { roleId: legacySale.id, permissionId: refundPerm } });
  const grantOrgClean = await prisma.organization.create({
    data: { name: `${tag}-G2`, slug: `hfg2-${randomUUID()}` },
  });
  const legacySaleClean = await prisma.role.create({
    data: { organizationId: grantOrgClean.id, code: 'SALE', name: 'Legacy sale clean' },
  });

  function runGrant() {
    const preload = resolve('scripts/pnpm-resolve-preload.cjs');
    const args = existsSync(preload)
      ? ['-r', preload, 'scripts/grant-hrm-finance-permissions.cjs']
      : ['scripts/grant-hrm-finance-permissions.cjs'];
    return spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
    });
  }
  const firstGrant = runGrant();
  const firstJson = JSON.parse(firstGrant.stdout.trim().split('\n').pop() || '{}') as { inserted?: number };
  check('Grant lần 1 chạy được', firstGrant.status === 0, firstGrant.stderr?.slice(0, 240));
  check('Grant lần 1 có thêm quyền thiếu', (firstJson.inserted ?? 0) > 0, `inserted=${firstJson.inserted}`);
  const secondGrant = runGrant();
  const secondJson = JSON.parse(secondGrant.stdout.trim().split('\n').pop() || '{}') as {
    inserted?: number;
    saleSalesRefundBefore?: number;
    saleSalesRefundAfter?: number;
    saleFinanceRefundLinks?: number;
  };
  check('Grant chạy lại không thêm dòng mới', secondGrant.status === 0 && secondJson.inserted === 0, `inserted=${secondJson.inserted}`);
  check(
    'Grant không đổi sales.payment.refund của SALE',
    secondJson.saleSalesRefundBefore === secondJson.saleSalesRefundAfter && (secondJson.saleFinanceRefundLinks ?? 1) === 0,
  );

  async function codesOf(roleId: string) {
    const rows = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { code: true } } },
    });
    return new Set(rows.map((row: { permission: { code: string } }) => row.permission.code));
  }
  const managerCodes = await codesOf(legacyManager.id);
  const hrCodes = await codesOf(legacyHr.id);
  const saleCodes = await codesOf(legacySale.id);
  const cleanCodes = await codesOf(legacySaleClean.id);
  check('QA MANAGER được finance.payment.refund và hrm.role.assign', managerCodes.has('finance.payment.refund') && managerCodes.has('hrm.role.assign') && managerCodes.has('finance.expense.manage'));
  check('QA HR được cấp role, không được hoàn tiền tài chính', hrCodes.has('hrm.role.assign') && !hrCodes.has('finance.payment.refund'));
  check('QA SALE được ghi nhận thanh toán, giữ sales.payment.refund cũ, không được hoàn tiền tài chính', saleCodes.has('finance.payment.record') && saleCodes.has('sales.payment.refund') && !saleCodes.has('finance.payment.refund'));
  check('QA SALE chưa có hoàn tiền bán hàng thì grant không thêm', !cleanCodes.has('sales.payment.refund') && !cleanCodes.has('finance.payment.refund') && cleanCodes.has('finance.read'));

  @Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [EmployeesController, HrmEmployeesController, FinanceController],
    providers: [
      { provide: ConfigService, useValue: { get: (key: string) => process.env[key] } },
      { provide: AuthService, useValue: qaAuth },
      JwtStrategy,
      JwtAuthGuard,
      TenantGuard,
      PermissionsGuard,
      { provide: EmployeesService, useValue: employees },
      { provide: HrmEmployeesService, useValue: hrmEmployees },
      { provide: HrmContractsService, useValue: contracts },
      { provide: HrmDocumentsService, useValue: documents },
      { provide: FinanceService, useValue: finance },
    ],
  })
  class QaModule {}

  const app = await NestFactory.create(QaModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  async function hit(method: string, path: string, token: string, body?: unknown) {
    const res = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  async function passwordHashOf(userId: string) {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    return row?.passwordHash ?? null;
  }

  async function roleOfTarget() {
    const row = await prisma.user.findUnique({
      where: { id: targetUser.id },
      include: { role: true },
    });
    return row?.role.code;
  }

  const profileOk = await hit('PATCH', `/employees/${targetEmployee.id}`, profileOnly.token, {
    name: `${tag}-hoso`,
    roleCode: 'TECHNICIAN',
  });
  check(
    'Sửa hồ sơ hợp lệ, giữ role hiện tại',
    profileOk.status === 200 && profileOk.json?.name === `${tag}-hoso` && profileOk.json?.user?.role?.code === 'TECHNICIAN',
    `status=${profileOk.status}`,
  );

  const roleOk = await hit('PATCH', `/employees/${targetEmployee.id}`, manager.token, {
    name: `${tag}-role-ok`,
    roleCode: 'SALE',
  });
  check(
    'Đổi role hợp lệ',
    roleOk.status === 200 && roleOk.json?.user?.role?.code === 'SALE' && roleOk.json?.name === `${tag}-role-ok`,
    `status=${roleOk.status} role=${roleOk.json?.user?.role?.code}`,
  );

  for (const enforce of ['true', 'false']) {
    process.env.HRM_PERMISSIONS_ENFORCE = enforce;
    const denied = await hit('PATCH', `/employees/${targetEmployee.id}`, profileOnly.token, {
      name: `${tag}-khong-doi`,
      roleCode: 'OWNER',
    });
    check(
      `enforce=${enforce} sửa hồ sơ không được đổi role`,
      denied.status === 403 && (await roleOfTarget()) === 'SALE',
      `status=${denied.status} role=${await roleOfTarget()}`,
    );
    const selfDenied = await hit('PATCH', `/employees/${selfEmployee.id}`, selfHr.token, {
      roleCode: 'MANAGER',
    });
    const selfRole = await prisma.user.findUnique({ where: { id: selfHr.user.id }, include: { role: true } });
    check(
      `enforce=${enforce} không tự nâng quyền`,
      selfDenied.status === 403 && selfRole?.role.code === 'HR',
      `status=${selfDenied.status} role=${selfRole?.role.code}`,
    );
    const overRank = await hit('POST', `/hrm/employees/${blockedEmployee.id}/account`, selfHr.token, {
      email: `over-${enforce}-${randomUUID()}@example.invalid`,
      password: 'secret1',
      roleCode: 'OWNER',
      name: blockedEmployee.name,
    });
    const blockedUser = await prisma.user.findFirst({ where: { employeeId: blockedEmployee.id } });
    check(
      `enforce=${enforce} không cấp role vượt thẩm quyền`,
      overRank.status === 403 && !blockedUser,
      `status=${overRank.status}`,
    );
    const refundDenied = await hit('POST', `/finance/payments/${payment.id}/refund`, staff.token);
    check(`enforce=${enforce} nhân viên thiếu quyền hoàn tiền`, refundDenied.status === 403, `status=${refundDenied.status}`);
    const salesAlias = await hit('POST', `/finance/payments/${payment.id}/refund`, salesRefundOnly.token);
    check(
      `enforce=${enforce} sales.payment.refund không mở hoàn tiền tài chính`,
      salesAlias.status === 403,
      `status=${salesAlias.status}`,
    );
    const expenseDenied = await hit('POST', `/finance/expenses`, staff.token, {
      category: 'OTHER',
      description: tag,
      amount: 10,
      expenseDate: new Date().toISOString(),
    });
    check(`enforce=${enforce} nhân viên không quản lý chi phí`, expenseDenied.status === 403, `status=${expenseDenied.status}`);
    const readOk = await hit('GET', '/finance/dashboard', staff.token);
    check(`enforce=${enforce} người có finance.read vẫn đọc được`, readOk.status === 200 && typeof readOk.json?.revenue === 'number', `status=${readOk.status}`);
  }

  const stillPaid = await prisma.payment.findUnique({ where: { id: payment.id } });
  check('Từ chối hoàn tiền không đổi payment', stillPaid?.status === 'COMPLETED');

  const accountOk = await hit('POST', `/hrm/employees/${bareEmployee.id}/account`, selfHr.token, {
    email: `acct-${randomUUID()}@example.invalid`,
    password: 'secret1',
    roleCode: 'TECHNICIAN',
    name: bareEmployee.name,
  });
  check(
    'Tạo tài khoản HRM với role trong thẩm quyền',
    accountOk.status === 201 && accountOk.json?.role?.code === 'TECHNICIAN' && !accountOk.json?.passwordHash,
    `status=${accountOk.status}`,
  );

  const dashB = await hit('GET', '/finance/dashboard', orgBUser.token);
  const ordersB = await hit('GET', '/finance/orders?page=1&pageSize=20', orgBUser.token);
  const foreignIds = Array.isArray(ordersB.json?.items) ? ordersB.json.items.map((row: { id: string }) => row.id) : [];
  check(
    'Tổ chức B không đọc doanh thu và đơn của tổ chức A',
    dashB.status === 200 && Number(dashB.json?.revenue) === 0 && ordersB.status === 200 && !foreignIds.includes(order.id),
    `revenue=${dashB.json?.revenue} status=${ordersB.status}`,
  );
  const editB = await hit('PATCH', `/employees/${targetEmployee.id}`, orgBUser.token, {
    name: `${tag}-hack`,
    roleCode: 'OWNER',
  });
  const refundB = await hit('POST', `/finance/payments/${payment.id}/refund`, orgBUser.token);
  check(
    'Tổ chức B không sửa hồ sơ hoặc hoàn tiền của tổ chức A',
    editB.status === 404 && refundB.status === 404 && (await roleOfTarget()) === 'SALE',
    `edit=${editB.status} refund=${refundB.status}`,
  );

  const expenseOk = await hit('POST', '/finance/expenses', manager.token, {
    category: 'OTHER',
    description: tag,
    amount: 12000,
    expenseDate: new Date().toISOString(),
  });
  check(
    'Người có quyền quản lý chi phí tạo được',
    (expenseOk.status === 200 || expenseOk.status === 201) && expenseOk.json?.description === tag && expenseOk.json?.category === 'OTHER',
    `status=${expenseOk.status} body=${JSON.stringify(expenseOk.json)?.slice(0, 400)}`,
  );

  const hashBeforeTarget = await passwordHashOf(targetUser.id);
  const hashBeforeHigh = await passwordHashOf(highTargetUser.id);

  for (const enforce of ['true', 'false']) {
    process.env.HRM_PERMISSIONS_ENFORCE = enforce;
    const denyNoPerm = await hit('POST', `/hrm/employees/${targetEmployee.id}/account/reset-password`, profileOnly.token, {
      password: 'NewPass9',
    });
    const hashAfterDenyNoPerm = await passwordHashOf(targetUser.id);
    check(
      `enforce=${enforce} thiếu hrm.account.manage reset mật khẩu → 403`,
      denyNoPerm.status === 403 && hashAfterDenyNoPerm === hashBeforeTarget,
      `status=${denyNoPerm.status}`,
    );
    const denyHigh = await hit('POST', `/hrm/employees/${highTargetEmployee.id}/account/reset-password`, selfHr.token, {
      password: 'NewPass9',
    });
    const hashAfterDenyHigh = await passwordHashOf(highTargetUser.id);
    check(
      `enforce=${enforce} HR reset MANAGER cao hơn thẩm quyền → 403`,
      denyHigh.status === 403 && hashAfterDenyHigh === hashBeforeHigh,
      `status=${denyHigh.status}`,
    );
  }

  const resetOk = await hit('POST', `/hrm/employees/${targetEmployee.id}/account/reset-password`, selfHr.token, {
    password: 'NewPass9',
  });
  const hashAfterOk = await passwordHashOf(targetUser.id);
  const matchesNew = hashAfterOk ? await bcrypt.compare('NewPass9', hashAfterOk) : false;
  check(
    'HR reset mật khẩu KTV trong thẩm quyền',
    (resetOk.status === 200 || resetOk.status === 201) &&
      resetOk.json?.success === true &&
      hashAfterOk !== hashBeforeTarget &&
      matchesNew,
    `status=${resetOk.status}`,
  );

  const refundOk = await hit('POST', `/finance/payments/${payment.id}/refund`, manager.token);
  check(
    'Người có quyền hoàn tiền',
    (refundOk.status === 200 || refundOk.status === 201) && refundOk.json?.id === payment.id && refundOk.json?.status === 'REFUNDED',
    `status=${refundOk.status} bodyStatus=${refundOk.json?.status}`,
  );

  record(
    'Browser Tổng quan: thiếu finance.read vẫn thấy lead/lịch/CRM',
    'CHƯA KIỂM CHỨNG',
    'UI: chạy web dev + node scripts/run-hrm-finance-qa-browser.cjs; API QA đã PASS finance 403 / pipeline 200',
  );

  await app.close();
  await prisma.$disconnect();

  const failed = results.filter((row) => row.status === 'FAIL');
  console.log(`\n${results.length - failed.length}/${results.length} không FAIL`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
