/**
 * Gán quyền sales chi tiết cho role hiện có. Chạy lại an toàn (chỉ INSERT thiếu).
 * Không cấp quyền tài chính (giá vốn, lợi nhuận, hoàn tiền, xuất CSV) cho role khác MANAGER/OWNER.
 *
 *   node scripts/grant-sales-granular-permissions.cjs
 * DATABASE_URL phải là marketingspa_sales_idem_qa (guard).
 */
const { resolve } = require('path');
const { readFileSync, existsSync } = require('fs');
const { buildSalesIdemQaDatabaseUrl, assertSalesIdemQaDb } = require('./sales-idem-qa-env.cjs');

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
const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
process.env.DATABASE_URL = buildSalesIdemQaDatabaseUrl(
  process.env.SALES_IDEM_QA_DATABASE_URL ||
    `postgresql://${user}:${pass}@postgres:5432/marketingspa_sales_idem_qa?schema=public`,
);
assertSalesIdemQaDb(process.env.DATABASE_URL);

const DEFS = [
  ['sales.inventory.read', 'Xem tồn kho / lô'],
  ['sales.inventory.write', 'Nhập/xuất/điều chỉnh kho'],
  ['sales.receive.write', 'Nhận hàng PO'],
  ['sales.stocktake.write', 'Kiểm kê kho'],
  ['sales.payment.collect', 'Thu tiền đơn bán'],
  ['sales.payment.refund', 'Hoàn tiền đơn bán'],
  ['sales.cost.view', 'Xem giá vốn'],
  ['sales.profit.view', 'Xem lợi nhuận / COGS'],
  ['sales.report.export', 'Xuất báo cáo bán hàng'],
];
const FINANCIAL = new Set([
  'sales.payment.refund',
  'sales.cost.view',
  'sales.profit.view',
  'sales.report.export',
]);
const OPS = DEFS.map(([code]) => code).filter((c) => !FINANCIAL.has(c));

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let inserted = 0;
  for (const [code, name] of DEFS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name, module: 'sales' },
    });
  }
  const perms = await prisma.permission.findMany({
    where: { code: { in: DEFS.map(([c]) => c) } },
  });
  const byCode = new Map(perms.map((p) => [p.code, p.id]));
  const roles = await prisma.role.findMany({ select: { id: true, code: true, organizationId: true } });
  for (const role of roles) {
    const code = role.code;
    const grant =
      code === 'OWNER' || code === 'MANAGER'
        ? DEFS.map(([c]) => c)
        : code === 'SALE'
          ? OPS
          : [];
    for (const permCode of grant) {
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
  const saleFinancial = await prisma.rolePermission.count({
    where: {
      role: { code: 'SALE' },
      permission: { code: { in: [...FINANCIAL] } },
    },
  });
  console.log(
    JSON.stringify({
      roles: roles.length,
      inserted,
      saleFinancialLinks: saleFinancial,
      policy: 'MANAGER/OWNER: full granular; SALE: ops only; other roles: unchanged',
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
