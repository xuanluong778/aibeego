/**
 * Seed QA overview — chạy trong marketingspa-api (/app).
 */
const { randomUUID } = require('crypto');
const path = require('path');

const ORG_SLUG = 'qa-overview-browser';
const CRM_EMAIL = 'qa-crm-only@example.invalid';
const FIN_EMAIL = 'qa-finance-read@example.invalid';
const PASSWORD = 'QaOverview1!';

async function main() {
  const dbName = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/)?.[1];
  if (dbName !== 'marketingspa_hrm_finance_qa') {
    throw new Error(`Từ chối seed: DB phải là marketingspa_hrm_finance_qa (${dbName})`);
  }

  const bcrypt = require(path.join('/app', 'node_modules/bcryptjs'));
  const { PrismaService } = require(path.join('/app', 'dist/prisma/prisma.service.js'));
  const prisma = new PrismaService();
  await prisma.$connect();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  let org = await prisma.organization.findFirst({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'QA Overview Browser', slug: ORG_SLUG },
    });
  }

  let plan = await prisma.subscriptionPlan.findFirst({ where: { code: 'QA_BROWSER_PLAN' } });
  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        code: 'QA_BROWSER_PLAN',
        name: 'QA Browser',
        priceMonthly: 0,
        priceVnd: 0,
        durationMonths: 1,
        creditsIncluded: 0,
        features: [],
      },
    });
  }
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const sub = await prisma.subscription.findFirst({ where: { organizationId: org.id } });
  if (!sub) {
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });
  } else {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', currentPeriodEnd: periodEnd },
    });
  }

  const permCodes = [
    'lead.read',
    'lead.write',
    'customer.read',
    'customer.write',
    'order.read',
    'finance.read',
    'finance.order.manage',
    'finance.payment.record',
  ];
  for (const code of permCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code, module: code.split('.')[0] },
    });
  }
  const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } } });
  const permId = new Map(perms.map((p) => [p.code, p.id]));

  async function ensureRole(code, name, grant) {
    let role = await prisma.role.findFirst({ where: { organizationId: org.id, code } });
    if (!role) {
      role = await prisma.role.create({ data: { organizationId: org.id, code, name } });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const c of grant) {
      const pid = permId.get(c);
      if (pid) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: pid } });
      }
    }
    return role;
  }

  const crmRole = await ensureRole('QA_CRM_ONLY', 'CRM không finance', [
    'lead.read',
    'lead.write',
    'customer.read',
    'customer.write',
    'order.read',
  ]);
  const finRole = await ensureRole('QA_CRM_FIN', 'CRM + finance.read', [
    'lead.read',
    'lead.write',
    'customer.read',
    'customer.write',
    'order.read',
    'finance.read',
  ]);

  async function ensureUser(email, roleId, name) {
    let user = await prisma.user.findFirst({ where: { email, organizationId: org.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          organizationId: org.id,
          roleId,
          name,
          email,
          passwordHash,
          isActive: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId, passwordHash, isActive: true, deletedAt: null },
      });
    }
    return user;
  }

  await ensureUser(CRM_EMAIL, crmRole.id, 'QA CRM only');
  await ensureUser(FIN_EMAIL, finRole.id, 'QA CRM + Finance');

  const leadCount = await prisma.lead.count({ where: { organizationId: org.id } });
  if (leadCount === 0) {
    await prisma.lead.create({
      data: {
        organizationId: org.id,
        name: 'QA Lead overview',
        phone: `090${String(randomUUID()).replace(/\D/g, '').slice(0, 7)}`,
        pipelineStatus: 'NEW',
      },
    });
  }

  console.log(
    JSON.stringify({
      organizationId: org.id,
      crmOnly: { email: CRM_EMAIL, password: PASSWORD },
      financeRead: { email: FIN_EMAIL, password: PASSWORD },
    }),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});