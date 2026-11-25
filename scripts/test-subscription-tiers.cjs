// Run after prepare-subscription-tiers-qa.cjs and building shared/database/API.
const path = require('node:path');
process.env.NODE_PATH = path.resolve(__dirname, '../apps/api/node_modules');
require('node:module').Module._initPaths();
require('reflect-metadata');
const assert = require('node:assert/strict');
const {
  PrismaClient,
  CreditLedger,
  PlanPolicy,
  PlanPolicyError,
  planFanpageIds,
} = require('../packages/database/dist');
const {
  buildPlanCatalog,
  billingAnniversary,
  currentBillingMonth,
  buildSubscriptionDisplay,
  requiredPlanFeature,
  planBonusMonths,
} = require('../packages/shared/dist');
const { BillingService } = require('../tmp/subscription-tiers-api/billing/billing.service');
const { writePlanFile } = require('../tmp/subscription-tiers-api/common/uploads/plan-storage');
const db = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://planqa:planqa-local-only@127.0.0.1:15491/plan_tiers_qa_v2?schema=public',
    },
  },
});
const stamp = Date.now();
let seq = 0;
async function fixture(code = 'abg-basic-12m') {
  const organization = await db.organization.create({
    data: { name: 'Plan QA', slug: `plan-qa-${stamp}-${++seq}` },
  });
  const role = await db.role.create({
    data: { organizationId: organization.id, name: 'Owner', code: 'OWNER' },
  });
  const user = await db.user.create({
    data: {
      organizationId: organization.id,
      roleId: role.id,
      email: `plan-${stamp}-${seq}@example.invalid`,
      name: 'QA',
    },
  });
  const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code } });
  return { organizationId: organization.id, user, plan };
}
async function active(f, start = new Date()) {
  return db.subscription.create({
    data: {
      organizationId: f.organizationId,
      planId: f.plan.id,
      status: 'ACTIVE',
      currentPeriodStart: start,
      currentPeriodEnd: billingAnniversary(start, f.plan.durationMonths),
    },
  });
}
function service() {
  const ledger = new CreditLedger(db);
  return new BillingService(
    db,
    { get: (key) => (key === 'SEPAY_API_TOKEN' ? 'isolated-qa-token' : undefined) },
    { log: async () => {} },
    { sendPaymentSuccess: async () => {} },
    { onOrderPaid: async () => {} },
    ledger,
  );
}
async function main() {
  const catalog = buildPlanCatalog();
  assert.equal(catalog.length, 9);
  assert.equal(new Set(catalog.map((p) => p.code)).size, 9);
  for (const plan of catalog)
    await db.subscriptionPlan.upsert({ where: { code: plan.code }, create: plan, update: plan });
  assert.equal((await service().listPlans()).length, 9);
  assert.equal(catalog.find((p) => p.code === 'abg-pro-12m').priceVnd, 8000000);
  assert.equal(catalog.find((p) => p.code === 'abg-pro-6m').priceVnd, 4800000);
  assert.equal(planBonusMonths('abg-pro-6m'), 1);
  assert.equal(planBonusMonths('abg-vip-6m'), 1);
  assert.equal(planBonusMonths('abg-basic-6m'), 0);
  assert.equal(planBonusMonths('abg-pro-12m'), 0);
  assert.equal(
    billingAnniversary(new Date('2026-01-31T12:34:56Z'), 1).toISOString(),
    '2026-02-28T12:34:56.000Z',
  );
  assert.equal(
    currentBillingMonth(new Date('2026-01-31T12:34:56Z'), new Date('2026-03-01T00:00:00Z')).index,
    1,
  );
  for (const tier of ['basic', 'pro', 'vip'])
    for (const months of [1, 6, 12]) {
      const display = buildSubscriptionDisplay({
        status: 'ACTIVE',
        planCode: `abg-${tier}-${months}m`,
        durationMonths: months,
        rawExpiresAt: '2027-11-22T00:00:00Z',
        paidPeriodEnd: '2027-11-22T00:00:00Z',
      });
      assert.equal(display.tier, `${tier.toUpperCase()}_${months}M`);
      assert.equal(display.upgradeButton.href, '/pricing');
    }
  assert.equal(requiredPlanFeature('/api/v1/hrm/employees'), 'hrm');
  assert.equal(requiredPlanFeature('/hrm-fake'), null);
  assert.equal(requiredPlanFeature('/api/v1/HRM/EMPLOYEES'), 'hrm');
  assert.equal(requiredPlanFeature('/api/v1/%68rm/employees'), 'hrm');
  assert.equal(requiredPlanFeature('/email-marketing/automations/123/run'), 'email_automation');
  console.log('PASS: nine plans, prices, display labels, route matching, UTC month boundaries');

  const f = await fixture();
  const start = new Date();
  await active(f, start);
  let now = start;
  const ledger = new CreditLedger(db, () => now);
  let balance = await ledger.getBalance(f.organizationId);
  assert.equal(balance.balance, 5000);
  await Promise.all(Array.from({ length: 6 }, () => ledger.getBalance(f.organizationId)));
  assert.equal(
    await db.creditTransaction.count({
      where: { organizationId: f.organizationId, source: 'PLAN_MONTHLY' },
    }),
    1,
  );
  await ledger.purchase({
    organizationId: f.organizationId,
    amount: 200,
    idempotencyKey: 'purchase',
  });
  await ledger.usage({ organizationId: f.organizationId, amount: 100, idempotencyKey: 'use' });
  await ledger.reserve({
    organizationId: f.organizationId,
    amount: 4950,
    referenceId: 'pending',
    idempotencyKey: 'reserve',
  });
  now = billingAnniversary(start, 1);
  balance = await ledger.getBalance(f.organizationId);
  assert.equal(balance.balance, 5150);
  balance = (
    await ledger.release({
      organizationId: f.organizationId,
      referenceId: 'pending',
      idempotencyKey: 'release',
    })
  ).balance;
  assert.equal(balance.balance, 5200);
  assert.equal(balance.planBalance, 5000);
  assert.equal(balance.purchasedBalance, 200);
  now = billingAnniversary(start, 2);
  balance = await ledger.getBalance(f.organizationId);
  assert.equal(balance.balance, 5200, 'unused monthly credits expire; purchased credits survive');
  assert.equal(balance.planBalance, 5000);
  assert.equal(
    await db.creditTransaction.count({
      where: { organizationId: f.organizationId, source: 'PLAN_MONTHLY' },
    }),
    3,
  );
  now = billingAnniversary(start, 13);
  balance = await ledger.getBalance(f.organizationId);
  assert.equal(balance.balance, 200, 'expired subscription cannot grant more monthly credit');
  console.log(
    'PASS: monthly grant concurrency, expiry, purchased balances, cross-month reservation refund',
  );

  const quota = await fixture();
  await active(quota);
  const policy = new PlanPolicy(db);
  await assert.rejects(
    policy.assertFeature(quota.organizationId, 'marketing_autopilot'),
    (e) => e instanceof PlanPolicyError && e.code === 'FEATURE_NOT_IN_PLAN',
  );
  await policy.assertFeature(quota.organizationId, 'content_ai');
  await policy.consume(quota.organizationId, 'images', 'fill', 9);
  const attempts = await Promise.allSettled(
    ['a', 'b', 'c'].map((ref) => policy.consume(quota.organizationId, 'images', ref)),
  );
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  const used = await db.planUsage.aggregate({
    where: { organizationId: quota.organizationId, resource: 'images' },
    _sum: { amount: true },
  });
  assert.equal(used._sum.amount, 10);
  await policy.consume(quota.organizationId, 'images', 'fill', 9);
  const bots = await Promise.allSettled(
    [1, 2, 3].map((i) =>
      policy.resource(
        quota.organizationId,
        'bots',
        (tx) => tx.chatbotBot.count({ where: { organizationId: quota.organizationId } }),
        (tx) =>
          tx.chatbotBot.create({
            data: { organizationId: quota.organizationId, botName: `QA ${i}` },
          }),
      ),
    ),
  );
  assert.equal(bots.filter((r) => r.status === 'fulfilled').length, 1);
  const other = await fixture();
  await active(other);
  await policy.consume(other.organizationId, 'images', 'fill', 1);
  const firstBalances = await Promise.all(
    Array.from({ length: 5 }, () => new CreditLedger(db).getBalance(other.organizationId)),
  );
  assert(firstBalances.every((balance) => balance.balance === 5000));
  await db.creditFeaturePricing.upsert({
    where: { featureCode: 'content_ai.image' },
    create: { featureCode: 'content_ai.image', name: 'QA image', creditCost: 8 },
    update: { creditCost: 8, isActive: true },
  });
  const aiLedger = new CreditLedger(db);
  let providerCalled = false;
  await assert.rejects(
    aiLedger.runPaidFeature({
      organizationId: quota.organizationId,
      featureCode: 'content_ai.image',
      referenceId: 'over-quota',
      fn: async () => {
        providerCalled = true;
        return 'image';
      },
    }),
    (error) => error.code === 'PLAN_LIMIT_REACHED',
  );
  assert.equal(providerCalled, false);
  assert.equal((await aiLedger.getBalance(quota.organizationId)).balance, 5000);
  await assert.rejects(
    aiLedger.runPaidFeature({
      organizationId: other.organizationId,
      featureCode: 'content_ai.image',
      referenceId: 'before-provider',
      fn: async () => {
        throw new Error('validation failed');
      },
    }),
  );
  assert.equal((await aiLedger.getBalance(other.organizationId)).balance, 5000);
  assert.equal((await policy.usage(other.organizationId, 'images')).used, 1);
  console.log(
    'PASS: feature restrictions, concurrent resource/usage caps, retry idempotency, tenant isolation',
  );
  const pageId = `page-${stamp}`;
  const connection = await db.autoPostFacebookConnection.create({ data: { userId: other.user.id, organizationId: other.organizationId, encryptedAccessToken: 'fixture', status: 'CONNECTED' } });
  await db.autoPostFacebookPage.create({ data: { userId: other.user.id, connectionId: connection.id, pageId, pageName: 'QA', encryptedPageAccessToken: 'fixture' } });
  const bot = await db.chatbotBot.create({ data: { organizationId: other.organizationId, botName: 'QA' } });
  await db.chatbotFacebookPage.create({ data: { organizationId: other.organizationId, botId: bot.id, pageId, pageName: 'QA', pageAccessTokenEncrypted: 'fixture' } });
  await db.messagingChannelConnection.create({ data: { organizationId: other.organizationId, channel: 'MESSENGER', providerKind: 'MESSENGER', accountRef: pageId, encryptedCredentials: 'fixture', status: 'ACTIVE' } });
  assert.equal((await planFanpageIds(db, other.organizationId)).size, 1);
  console.log('PASS: Fanpage slots are shared and deduplicated across posting, chatbot and inbox');

  const fs = require('node:fs/promises');
  const storageDir = path.resolve(__dirname, `../tmp/subscription-tiers-qa/files-${stamp}`);
  await fs.mkdir(storageDir, { recursive: true });
  const file1 = path.join(storageDir, 'first.txt');
  await writePlanFile(db, other.organizationId, file1, 3, () => fs.writeFile(file1, 'abc'));
  assert.equal(
    await db.planStoredFile.count({ where: { organizationId: other.organizationId } }),
    1,
  );
  let wroteOversized = false;
  await assert.rejects(
    writePlanFile(
      db,
      other.organizationId,
      path.join(storageDir, 'oversized'),
      21 * 1024 * 1024,
      async () => {
        wroteOversized = true;
      },
    ),
    (e) => e.code === 'PLAN_LIMIT_REACHED',
  );
  assert.equal(wroteOversized, false);
  await fs.unlink(file1);
  const file2 = path.join(storageDir, 'second.txt');
  await writePlanFile(db, other.organizationId, file2, 3, () => fs.writeFile(file2, 'def'));
  assert.equal(
    await db.planStoredFile.count({ where: { organizationId: other.organizationId } }),
    1,
    'deleted files release quota',
  );
  await fs.unlink(file2);
  console.log('PASS: managed file accounting, per-file size limit and quota release on deletion');

  for (const definition of catalog) {
    const customer = await fixture(definition.code);
    const billing = service();
    const order = await billing.createOrder(
      customer.organizationId,
      customer.user.id,
      definition.code,
    );
    assert.equal(order.amountVnd, definition.priceVnd);
    await db.$transaction((tx) =>
      billing.extendSubscriptionTx(
        tx,
        customer.organizationId,
        customer.plan.id,
        definition.durationMonths,
        new Date(),
      ),
    );
    const current = await billing.getCurrentSubscription(customer.organizationId);
    assert.equal(new Date(current.expiresAt).getTime(), billingAnniversary(
      new Date(current.startedAt), definition.durationMonths + planBonusMonths(definition.code),
    ).getTime(), `Full service term for ${definition.code}`);
    assert.equal(current.planCode, definition.code);
    assert.equal(current.durationMonths, definition.durationMonths);
    assert.equal(
      (await new CreditLedger(db).getBalance(customer.organizationId)).balance,
      definition.creditsIncluded,
    );
    if (planBonusMonths(definition.code)) {
      const bonusMonth = billingAnniversary(new Date(current.startedAt), 6);
      assert.equal((await new CreditLedger(db, () => bonusMonth).getBalance(customer.organizationId)).balance,
        definition.creditsIncluded, 'Bonus month includes the monthly AI credit allowance');
      const renewed = await db.$transaction(tx => billing.extendSubscriptionTx(
        tx, customer.organizationId, customer.plan.id, 6, new Date(),
      ));
      assert.equal(renewed.currentPeriodEnd.getTime(), billingAnniversary(new Date(current.expiresAt), 7).getTime(),
        'Renewal adds seven months after the existing expiry');
    }
  }
  console.log(
    'PASS: checkout, subscription duration and monthly credit for all nine plan variants',
  );

  const buyer = await fixture('abg-pro-6m');
  const billing = service();
  const order = await billing.createOrder(buyer.organizationId, buyer.user.id, buyer.plan.code);
  assert.equal(order.amountVnd, 4800000);
  assert.equal(new URL(order.qrUrl).searchParams.get('amount'), '4800000');
  const payload = {
    id: String(stamp),
    transferType: 'in',
    transferAmount: order.amountVnd,
    accountNumber: order.accountNumber,
    content: order.transferContent,
  };
  const firstPayment = await billing.handleSepayWebhook(
    Buffer.from(JSON.stringify(payload)),
    { authorization: 'Apikey isolated-qa-token' },
    payload,
  );
  assert.equal(firstPayment.activated, true);
  const duplicate = await billing.handleSepayWebhook(
    Buffer.from(JSON.stringify(payload)),
    { authorization: 'Apikey isolated-qa-token' },
    payload,
  );
  assert.equal(duplicate.activated, false);
  assert.equal(await db.subscription.count({ where: { organizationId: buyer.organizationId } }), 1);
  assert.equal(
    (await new CreditLedger(db).getBalance(buyer.organizationId)).balance,
    15000,
    'six months grant one month at a time',
  );
  const before = await db.subscription.findFirstOrThrow({
    where: { organizationId: buyer.organizationId },
  });
  assert.equal(before.currentPeriodEnd.getTime(), billingAnniversary(before.currentPeriodStart, 7).getTime());
  const vip = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: 'abg-vip-1m' } });
  await db.$transaction((tx) =>
    billing.extendSubscriptionTx(tx, buyer.organizationId, vip.id, 1, new Date()),
  );
  const after = await db.subscription.findUniqueOrThrow({ where: { id: before.id } });
  assert.equal(after.planId, buyer.plan.id);
  assert.equal(after.currentPeriodEnd.getTime(), before.currentPeriodEnd.getTime());
  const future = await db.subscription.findFirstOrThrow({
    where: { organizationId: buyer.organizationId, planId: vip.id },
  });
  assert.equal(future.currentPeriodStart.getTime(), before.currentPeriodEnd.getTime());
  assert.equal(
    (await billing.getCurrentSubscription(buyer.organizationId)).planCode,
    buyer.plan.code,
  );
  assert.equal((await billing.getPlanEntitlements(buyer.organizationId)).scheduled.length, 1);
  console.log(
    'PASS: QR amount, fulfillment, monthly credits, scheduled tier change preserving purchased rights',
  );

  const legacyPlan = await db.subscriptionPlan.create({
    data: {
      code: `legacy-${stamp}`,
      name: 'Legacy Pro',
      priceMonthly: 800000,
      priceVnd: 6500000,
      durationMonths: 12,
      isActive: false,
    },
  });
  const legacy = await fixture();
  legacy.plan = legacyPlan;
  await active(legacy);
  await new PlanPolicy(db).assertFeature(legacy.organizationId, 'finance');
  assert.equal((await new CreditLedger(db).getBalance(legacy.organizationId)).balance, 0);
  assert.equal(await billing.isFeatureAllowedForOrg(legacy.organizationId, '/hrm/employees'), true);
  console.log('PASS: legacy contracts remain unrestricted without unexpected credit grants');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
