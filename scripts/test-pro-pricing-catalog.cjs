// Run in the API container. Reads the plan catalog; order writes use fixtures only.
const assert = require('node:assert/strict');
const req = require('node:module').createRequire('/app/package.json');
req('reflect-metadata');
const { prisma } = req('@marketingspa/database');
const { BillingService } = req('/app/dist/billing/billing.service');

async function main() {
  try {
    const plans = await new BillingService(prisma).listPlans();
    const expected = [['msp-pro-1m', 800000], ['msp-pro-6m', 4800000], ['msp-pro-12m', 6500000]];
    const required = [
      'overview', 'marketing_autopilot', 'crm_full', 'landing_pages', 'appointments_services',
      'content_ai', 'brand_building', 'content_ads_check', 'video_transcription', 'teleprompter',
      'content_library', 'content_auto_post', 'post_scheduling', 'fanpage_connections',
      'ads_performance', 'chatbot_cskh', 'messaging_campaigns', 'messaging_audiences',
      'messaging_flows', 'email_marketing', 'zalo_marketing', 'hrm', 'work_management',
      'sales', 'inventory', 'purchasing', 'finance', 'business_goals', 'reports',
      'affiliate', 'ai_credit_management', 'settings_integrations',
    ];
    for (const [code, amount] of expected) {
      const plan = plans.find(p => p.code === code);
      assert(plan, code);
      assert.equal(Number(plan.priceVnd), amount);
      for (const feature of required) assert(plan.features.includes(feature), `${code}: ${feature}`);
      const fixture = {
        subscriptionPlan: { findFirst: async () => plan },
        paymentOrder: {
          findUnique: async () => null,
          updateMany: async () => ({ count: 0 }),
          create: async ({ data }) => ({ ...data, id: 'fixture-order', plan, createdAt: new Date() }),
        },
      };
      const service = new BillingService(fixture, { get: () => undefined }, { log: async () => {} });
      const order = await service.createOrder('fixture-org', 'fixture-user', code);
      assert.equal(order.amountVnd, amount);
      assert.equal(new URL(order.qrUrl).searchParams.get('amount'), String(amount));
    }
    const six = plans.find(p => p.code === 'msp-pro-6m');
    const annual = plans.find(p => p.code === 'msp-pro-12m');
    assert.equal(Number(six.savingsAmount || 0), 0);
    assert.equal(Number(annual.savingsAmount), 2 * Number(six.priceVnd) - Number(annual.priceVnd));
    console.log('PASS: 800000 / 4800000 / 6500000 VND; full features in every plan; order/QR amounts and 3100000 VND annual savings verified.');
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
