/**
 * Gán quyền nhân sự (cấp role) và tài chính spa còn thiếu. Chạy lại an toàn: chỉ INSERT.
 * Không thêm, không gỡ quyền Bán hàng (sales.* / order.write).
 *
 *   node scripts/grant-hrm-finance-permissions.cjs
 * DATABASE_URL phải là marketingspa_hrm_finance_qa.
 */
const { resolve } = require('path');
const { readFileSync, existsSync } = require('fs');
const { assertHrmFinanceQaDb, toHrmFinanceQaUrl } = require('./hrm-finance-qa-env.cjs');

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if ((key === 'POSTGRES_USER' || key === 'POSTGRES_PASSWORD') && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const sourceUrl = process.env.HRM_FINANCE_QA_DATABASE_URL || process.env.DATABASE_URL;
process.env.DATABASE_URL = toHrmFinanceQaUrl(sourceUrl);
assertHrmFinanceQaDb(process.env.DATABASE_URL);

const FINANCE_ALL = [
  ['finance.read', 'Đọc tài chính'],
  ['finance.order.manage', 'Quản lý đơn tài chính'],
  ['finance.payment.record', 'Ghi nhận thanh toán'],
  ['finance.payment.refund', 'Hoàn tiền tài chính'],
  ['finance.expense.manage', 'Quản lý chi phí'],
];
const FINANCE_STAFF = ['finance.read', 'finance.order.manage', 'finance.payment.record'];
const ROLE_ASSIGN = ['hrm.role.assign', 'Cấp hoặc đổi vai trò nhân viên'];

function grantsFor(code) {
  if (code === 'OWNER' || code === 'MANAGER' || code === 'SUPER_ADMIN') {
    return [...FINANCE_ALL.map(([c]) => c), ROLE_ASSIGN[0]];
  }
  if (code === 'HR') return [ROLE_ASSIGN[0]];
  if (code === 'SALE') return [...FINANCE_STAFF];
  return [];
}

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const defs = [...FINANCE_ALL, ROLE_ASSIGN];
  for (const [code, name] of defs) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name, module: code.startsWith('hrm.') ? 'hrm' : 'finance' },
    });
  }
  const perms = await prisma.permission.findMany({
    where: { code: { in: defs.map(([code]) => code) } },
  });
  const byCode = new Map(perms.map((row) => [row.code, row.id]));
  const saleRefundBefore = await prisma.rolePermission.count({
    where: { role: { code: 'SALE' }, permission: { code: 'sales.payment.refund' } },
  });
  const roles = await prisma.role.findMany({ select: { id: true, code: true } });
  let inserted = 0;
  for (const role of roles) {
    for (const permCode of grantsFor(role.code)) {
      const permissionId = byCode.get(permCode);
      if (!permissionId) continue;
      const exists = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId },
      });
      if (exists) continue;
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
      inserted += 1;
    }
  }
  const saleRefundAfter = await prisma.rolePermission.count({
    where: { role: { code: 'SALE' }, permission: { code: 'sales.payment.refund' } },
  });
  const saleFinanceRefund = await prisma.rolePermission.count({
    where: { role: { code: 'SALE' }, permission: { code: 'finance.payment.refund' } },
  });
  console.log(
    JSON.stringify({
      roles: roles.length,
      inserted,
      saleSalesRefundBefore: saleRefundBefore,
      saleSalesRefundAfter: saleRefundAfter,
      saleFinanceRefundLinks: saleFinanceRefund,
      policy:
        'OWNER/MANAGER/SUPER_ADMIN: finance đầy đủ + hrm.role.assign; HR: hrm.role.assign; SALE: đọc/đơn/ghi nhận thanh toán; không đụng sales.*',
    }),
  );
  if (saleRefundBefore !== saleRefundAfter) {
    throw new Error('Script đã đổi quyền sales.payment.refund của SALE');
  }
  if (saleFinanceRefund !== 0) {
    throw new Error('SALE không được nhận finance.payment.refund');
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
