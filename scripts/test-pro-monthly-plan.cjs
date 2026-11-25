// Run in the built API image with this script mounted at /tmp/test-pro-monthly-plan.cjs.
// All persistence is isolated fixture data; no payment or subscription is written.
const assert = require('node:assert/strict');
const req = require('node:module').createRequire('/app/package.json');
req('reflect-metadata');
const { BillingService } = req('/app/dist/billing/billing.service');
const { buildSubscriptionDisplay } = req('@marketingspa/shared');

async function main() {
  const plan = {
    id: 'monthly-fixture', code: 'msp-pro-1m', name: 'Ai Bee Go Pro — 1 tháng',
    durationMonths: 1, priceVnd: 800000, isActive: true,
  };
  let stored;
  const prisma = {
    subscriptionPlan: {
      findMany: async ({ where }) => {
        assert(where.durationMonths.in.includes(1));
        return [plan];
      },
      findFirst: async ({ where }) => where.code === plan.code ? plan : null,
    },
    paymentOrder: {
      findUnique: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }) => {
        stored = { ...data, id: 'order-fixture', createdAt: new Date(), plan };
        return stored;
      },
    },
  };
  const service = new BillingService(prisma, { get: () => undefined }, { log: async () => {} });
  assert.equal((await service.listPlans())[0].durationMonths, 1);
  const order = await service.createOrder('fixture-org', 'fixture-user', plan.code);
  assert.equal(order.amountVnd, 800000);
  assert.equal(order.status, 'PENDING');
  assert.equal(order.plan.durationMonths, 1);
  assert.equal(new URL(order.qrUrl).searchParams.get('amount'), '800000');
  assert.equal(stored.planId, plan.id);
  const paidAt = new Date('2026-11-22T00:00:00Z');
  const tx = { subscription: {
    findFirst: async () => null,
    create: async ({ data }) => data,
  } };
  const subscription = await service.extendSubscriptionTx(tx, 'fixture-org', plan.id, 1, paidAt);
  assert.equal(subscription.currentPeriodEnd.toISOString(), '2026-12-22T00:00:00.000Z');
  const display = buildSubscriptionDisplay({
    status: 'ACTIVE', planCode: plan.code, durationMonths: 1,
    rawExpiresAt: subscription.currentPeriodEnd, paidPeriodEnd: subscription.currentPeriodEnd,
    now: paidAt.getTime(),
  });
  assert.equal(display.tier, 'PRO_1M');
  assert.equal(display.periodSource, 'PAYMENT');
  assert.equal(display.remainingDays, 30);
  assert.equal(display.planLabel, 'Gói hiện tại 1 tháng');
  const gifted = buildSubscriptionDisplay({
    status: 'ACTIVE', planCode: plan.code, durationMonths: 1,
    rawExpiresAt: subscription.currentPeriodEnd, now: paidAt.getTime(),
  });
  assert.equal(gifted.tier, 'ADMIN_GIFT');
  service.expireTrialIfNeeded = async () => {};
  service.getTrialSettings = async () => ({ enabled: false, trialDays: 3 });
  prisma.trialClaim = { findUnique: async () => null };
  const future = new Date(Date.now() + 30 * 86400000);
  prisma.subscription = { findFirst: async () => ({
    id: 'subscription-fixture', planId: plan.id, plan,
    status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: future,
  }) };
  prisma.paymentOrder.findFirst = async () => ({ id: 'paid-fixture' });
  const current = await service.getCurrentSubscription('fixture-org');
  assert.equal(current.display.tier, 'PRO_1M');
  assert.equal(current.display.periodSource, 'PAYMENT');
  prisma.paymentOrder.findFirst = async () => null;
  assert.equal((await service.getCurrentSubscription('fixture-org')).display.tier, 'ADMIN_GIFT');
  console.log('PASS: monthly plan listing, 800000 VND order/VietQR, one-month activation and subscription display.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
