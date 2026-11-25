import { PrismaClient } from '@prisma/client';
import { buildPlanCatalog } from '@marketingspa/shared';

/** Safe to rerun: legacy subscriptions/orders are retained, only new sales are disabled. */
export async function seedSubscriptionCatalog(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPlan.updateMany({
      where: { code: { in: ['starter', 'msp-pro-1m', 'msp-pro-6m', 'msp-pro-12m'] } },
      data: { isActive: false },
    });
    for (const plan of buildPlanCatalog()) {
      await tx.subscriptionPlan.upsert({ where: { code: plan.code }, create: plan, update: plan });
    }
  });
}
