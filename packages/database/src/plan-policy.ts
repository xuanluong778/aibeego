import { PrismaClient, Prisma } from '@prisma/client';
import { currentBillingMonth, planDefinition, type PlanLimit } from '@marketingspa/shared';

export class PlanPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PlanPolicyError';
  }
}
/** Count a Page only once even when used by Auto Post, Inbox and Chatbot. */
export async function planFanpageIds(
  tx: Prisma.TransactionClient | PrismaClient,
  organizationId: string,
) {
  const [posting, chatbot, inbox] = await Promise.all([
    tx.autoPostFacebookPage.findMany({
      where: { connection: { organizationId } },
      select: { pageId: true },
    }),
    tx.chatbotFacebookPage.findMany({
      where: { organizationId, status: 'connected' },
      select: { pageId: true },
    }),
    tx.messagingChannelConnection.findMany({
      where: { organizationId, channel: 'MESSENGER', status: 'ACTIVE' },
      select: { accountRef: true },
    }),
  ]);
  return new Set([
    ...posting.map((row) => row.pageId),
    ...chatbot.map((row) => row.pageId),
    ...inbox.map((row) => row.accountRef),
  ]);
}
export async function organizationPlan(
  db: Prisma.TransactionClient | PrismaClient,
  organizationId: string,
  now = new Date(),
) {
  const subscription = await db.subscription.findFirst({
    where: {
      organizationId,
      status: 'ACTIVE',
      currentPeriodStart: { lte: now },
      currentPeriodEnd: { gt: now },
    },
    include: { plan: true },
    orderBy: { currentPeriodEnd: 'desc' },
  });
  return { subscription, definition: planDefinition(subscription?.plan.code) };
}
export async function assertPlanResource(
  tx: Prisma.TransactionClient,
  organizationId: string,
  resource: PlanLimit,
  count: () => Promise<number>,
  additional = 1,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${organizationId}`}))`;
  const { definition } = await organizationPlan(tx, organizationId);
  if (!definition) return;
  const used = await count();
  if (used + additional > definition.limits[resource])
    throw new PlanPolicyError('PLAN_LIMIT_REACHED', 'Đã đạt giới hạn của gói. Vui lòng nâng gói.', {
      resource,
      used,
      limit: definition.limits[resource],
    });
}

/** Shared by HTTP, background jobs and public chatbot handlers. Legacy plans are unrestricted. */
export class PlanPolicy {
  constructor(private readonly db: PrismaClient) {}
  async usage(organizationId: string, resource: PlanLimit) {
    const { subscription, definition } = await organizationPlan(this.db, organizationId);
    if (!subscription || !definition) return null;
    const period = currentBillingMonth(subscription.currentPeriodStart, new Date());
    const periodKey = `${subscription.id}:${period.start.toISOString()}`;
    const result = await this.db.planUsage.aggregate({
      where: { organizationId, resource, periodKey },
      _sum: { amount: true },
    });
    const used = result._sum.amount ?? 0;
    const limit = definition.limits[resource];
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      allowed: used < limit,
      resetsAt: period.end.toISOString(),
    };
  }
  async assertFeature(organizationId: string, feature: string) {
    const { subscription, definition } = await organizationPlan(this.db, organizationId);
    if (!subscription) {
      const now = new Date();
      const trial = await this.db.subscription.findFirst({
        where: {
          organizationId,
          status: 'TRIALING',
          trialEndsAt: { gt: now },
          currentPeriodEnd: { gt: now },
        },
      });
      if (trial && ['content_ai', 'content_auto_post', 'video_transcription'].includes(feature))
        return;
      throw new PlanPolicyError(
        'SUBSCRIPTION_REQUIRED',
        'Gói đã hết hạn hoặc chưa được kích hoạt.',
      );
    }
    if (definition && !definition.features.includes(feature)) {
      throw new PlanPolicyError('FEATURE_NOT_IN_PLAN', 'Tính năng này cần gói Pro hoặc VIP.', {
        feature,
        tier: definition.tier,
      });
    }
  }
  /** Serialize count + write per tenant; callback must use the supplied transaction. */
  async resource<T>(
    organizationId: string,
    limit: PlanLimit,
    count: (tx: Prisma.TransactionClient) => Promise<number>,
    write: (tx: Prisma.TransactionClient) => Promise<T>,
    additional = 1,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${organizationId}`}))`;
      const { definition } = await organizationPlan(tx, organizationId);
      if (definition) {
        const used = await count(tx);
        if (used + additional > definition.limits[limit]) {
          throw new PlanPolicyError(
            'PLAN_LIMIT_REACHED',
            'Đã đạt giới hạn của gói. Vui lòng nâng gói.',
            { resource: limit, limit: definition.limits[limit], used, tier: definition.tier },
          );
        }
      }
      return write(tx);
    });
  }
  /** Atomic, idempotent usage admission. Count before calling a billable external provider. */
  async consume(organizationId: string, resource: PlanLimit, referenceId: string, amount = 1) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid plan usage amount');
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${organizationId}`}))`;
      const { subscription, definition } = await organizationPlan(tx, organizationId);
      if (!subscription) {
        const trial = await tx.subscription.findFirst({
          where: {
            organizationId,
            status: 'TRIALING',
            trialEndsAt: { gt: new Date() },
            currentPeriodEnd: { gt: new Date() },
          },
        });
        if (trial) return;
        throw new PlanPolicyError(
          'SUBSCRIPTION_REQUIRED',
          'Gói đã hết hạn hoặc chưa được kích hoạt.',
        );
      }
      if (!definition) return;
      const period = currentBillingMonth(subscription.currentPeriodStart, new Date());
      const periodKey = `${subscription.id}:${period.start.toISOString()}`;
      // A retry of the same operation never consumes again, even across a monthly boundary.
      const previous = await tx.planUsage.findUnique({
        where: { organizationId_resource_referenceId: { organizationId, resource, referenceId } },
      });
      if (previous) return;
      const aggregate = await tx.planUsage.aggregate({
        where: { organizationId, resource, periodKey },
        _sum: { amount: true },
      });
      const used = aggregate._sum.amount ?? 0;
      if (used + amount > definition.limits[resource]) {
        throw new PlanPolicyError('PLAN_LIMIT_REACHED', 'Đã hết hạn mức tháng của gói.', {
          resource,
          limit: definition.limits[resource],
          used,
          resetsAt: period.end.toISOString(),
        });
      }
      await tx.planUsage.create({
        data: { organizationId, resource, referenceId, periodKey, amount },
      });
    });
  }
  async release(organizationId: string, resource: PlanLimit, referenceId: string) {
    await this.db.planUsage.deleteMany({ where: { organizationId, resource, referenceId } });
  }
}
