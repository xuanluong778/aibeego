import { Prisma, PrismaClient, CreditTransactionType } from '@prisma/client';
import { currentBillingMonth, planDefinition } from '@marketingspa/shared';
import { PlanPolicy } from './plan-policy';
import { randomUUID } from 'node:crypto';
import { creditCallContext } from './credit-context';

export type CreditBalanceSnapshot = {
  organizationId: string;
  balance: number;
  reservedBalance: number;
  available: number;
  lifetimeEarned: number;
  lifetimeUsed: number;
  planBalance?: number;
  purchasedBalance?: number;
};

export type CreditMutationResult = {
  transactionId: string;
  idempotent: boolean;
  balance: CreditBalanceSnapshot;
};

export class CreditIdempotentConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Idempotent conflict for key=${idempotencyKey}`);
    this.name = 'CreditIdempotentConflictError';
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

type CreditGrantParams = {
  organizationId: string;
  amount: number;
  idempotencyKey: string;
  referenceId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  source?: string;
  subscriptionId?: string;
  paymentId?: string;
};
type CreditPurchaseParams = CreditGrantParams;
type CreditRefundParams = CreditGrantParams;
type CreditReserveParams = CreditGrantParams & {
  amount: number;
  referenceId: string;
  featureCode?: string;
};
type CreditCommitParams = {
  organizationId: string;
  referenceId: string;
  idempotencyKey: string;
  featureCode?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};
type CreditReleaseParams = CreditCommitParams;
type CreditUsageParams = {
  organizationId: string;
  amount?: number;
  idempotencyKey: string;
  referenceId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  featureCode?: string;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type WalletRow = {
  id: string;
  organizationId: string;
  balance: Prisma.Decimal;
  reservedBalance: Prisma.Decimal;
  lifetimeEarned: Prisma.Decimal;
  lifetimeUsed: Prisma.Decimal;
  planBalance: Prisma.Decimal;
  planPeriodKey: string | null;
};

export class CreditError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CreditError';
  }
}

export type PaidFeatureContext = {
  /** Gọi ngay trước khi request tới provider (OpenAI/STT/vision). */
  markProviderStarted: () => void;
};

export type RunPaidFeatureParams<T> = {
  organizationId: string;
  featureCode: string;
  referenceId: string;
  reason?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  fn: (ctx: PaidFeatureContext) => Promise<T>;
};

/**
 * Multi-tenant credit ledger (organizationId). Nest-free — dùng được từ API và worker.
 */
export class CreditLedger {
  constructor(private readonly prisma: PrismaClient, private readonly now: () => Date = () => new Date()) {}

  async getBalance(organizationId: string): Promise<CreditBalanceSnapshot> {
    const wallet = await this.prisma.$transaction((tx) => this.lockWallet(tx, organizationId));
    return this.snapshot(wallet);
  }

  async checkAvailable(organizationId: string, amount: number): Promise<boolean> {
    this.assertPositiveAmount(amount, 'amount');
    return (await this.getBalance(organizationId)).balance >= amount;
  }

  async getFeatureCost(featureCode: string): Promise<number> {
    const row = await this.prisma.creditFeaturePricing.findFirst({
      where: { featureCode, isActive: true },
    });
    if (!row) {
      throw new CreditError(
        'FEATURE_PRICING_NOT_FOUND',
        `Chưa cấu hình credit cho featureCode=${featureCode}`,
        { featureCode },
      );
    }
    return Number(row.creditCost);
  }

  async resolveFeatureAmount(featureCode: string, overrideAmount?: number): Promise<number> {
    if (overrideAmount != null) {
      this.assertPositiveAmount(overrideAmount, 'overrideAmount');
      return overrideAmount;
    }
    return this.getFeatureCost(featureCode);
  }

  async grant(params: CreditGrantParams, tx?: Prisma.TransactionClient): Promise<CreditMutationResult> {
    return this.creditIn(params, CreditTransactionType.GRANT, { trackLifetimeEarned: true }, tx);
  }

  async purchase(params: CreditPurchaseParams, tx?: Prisma.TransactionClient): Promise<CreditMutationResult> {
    return this.creditIn(params, CreditTransactionType.PURCHASE, { trackLifetimeEarned: true }, tx);
  }

  async refund(params: CreditRefundParams): Promise<CreditMutationResult> {
    return this.creditIn(params, CreditTransactionType.REFUND, { trackLifetimeEarned: false });
  }

  async adjust(
    params: {
      organizationId: string;
      delta: number;
      idempotencyKey: string;
      referenceId?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<CreditMutationResult> {
    if (!params.delta || params.delta === 0) {
      throw new CreditError('INVALID_AMOUNT', 'delta phải khác 0');
    }
    const metadata = { ...(params.metadata ?? {}), delta: params.delta };
    if (params.delta > 0) {
      return this.creditIn(
        {
          organizationId: params.organizationId,
          amount: params.delta,
          idempotencyKey: params.idempotencyKey,
          referenceId: params.referenceId,
          reason: params.reason,
          metadata,
        },
        CreditTransactionType.ADMIN_ADJUST,
        { trackLifetimeEarned: true },
        tx,
      );
    }
    return this.debitOut(
      {
        organizationId: params.organizationId,
        amount: Math.abs(params.delta),
        idempotencyKey: params.idempotencyKey,
        referenceId: params.referenceId,
        reason: params.reason,
        metadata,
      },
      CreditTransactionType.ADMIN_ADJUST,
      { trackLifetimeUsed: true, fromBalance: true },
      tx,
    );
  }

  async usage(params: CreditUsageParams): Promise<CreditMutationResult> {
    let amount = params.amount;
    if (params.featureCode != null) {
      amount = await this.resolveFeatureAmount(params.featureCode, params.amount);
    }
    if (amount == null) {
      throw new CreditError('INVALID_AMOUNT', 'amount hoặc featureCode là bắt buộc');
    }
    return this.debitOut(
      { ...params, amount },
      CreditTransactionType.USAGE,
      { trackLifetimeUsed: true, fromBalance: true },
    );
  }

  async hasCommitted(organizationId: string, referenceId: string): Promise<boolean> {
    const row = await this.prisma.creditTransaction.findFirst({
      where: {
        organizationId,
        referenceId,
        type: CreditTransactionType.USAGE,
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async reserve(params: CreditReserveParams): Promise<CreditMutationResult> {
    this.assertPositiveAmount(params.amount, 'amount');
    this.requireIdempotencyKey(params.idempotencyKey);
    this.requireReferenceId(params.referenceId);

    return this.prisma.$transaction(async (tx) => {
      // Lock first, then re-check idempotency under row lock to avoid double-apply.
      const walletEarly = await this.lockWallet(tx, params.organizationId);
      const existing = await this.findByIdempotency(tx, params.organizationId, params.idempotencyKey);
      if (existing) {
        return { transactionId: existing.id, idempotent: true, balance: this.snapshot(walletEarly) };
      }

      const wallet = walletEarly;
      const balance = Number(wallet.balance);
      const reserved = Number(wallet.reservedBalance);
      if (balance < params.amount) {
        throw new CreditError('INSUFFICIENT_CREDITS', 'Không đủ AI Credit', {
          required: params.amount,
          available: balance,
        });
      }

      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: this.decimal(balance - params.amount),
          planBalance: this.decimal(Math.max(0, Number(wallet.planBalance) - params.amount)),
          reservedBalance: this.decimal(reserved + params.amount),
        },
      });

      try {
        const txn = await tx.creditTransaction.create({
          data: {
            organizationId: params.organizationId,
            walletId: wallet.id,
            type: CreditTransactionType.RESERVE,
            amount: this.decimal(params.amount),
            balanceAfter: updated.balance,
            reservedAfter: updated.reservedBalance,
            reason: params.reason,
            referenceId: params.referenceId,
            idempotencyKey: params.idempotencyKey,
            featureCode: params.featureCode,
            metadata: { ...(params.metadata ?? {}), planCreditAmount: Math.min(Number(wallet.planBalance), params.amount), planPeriodKey: wallet.planPeriodKey } as Prisma.InputJsonValue,
          },
        });
        return { transactionId: txn.id, idempotent: false, balance: this.snapshot(updated) };
      } catch (err) {
        // Abort tx so wallet mutation rolls back; outer helper returns idempotent read.
        this.throwIdempotentConflict(params.idempotencyKey, err);
      }
    }).catch((err) => this.resolveIdempotentAfterRollback(params.organizationId, params.idempotencyKey, err));
  }

  async commit(params: CreditCommitParams): Promise<CreditMutationResult> {
    this.requireIdempotencyKey(params.idempotencyKey);
    this.requireReferenceId(params.referenceId);

    return this.prisma.$transaction(async (tx) => {
      const walletEarly = await this.lockWallet(tx, params.organizationId);
      const existing = await this.findByIdempotency(tx, params.organizationId, params.idempotencyKey);
      if (existing) {
        return { transactionId: existing.id, idempotent: true, balance: this.snapshot(walletEarly) };
      }

      const reserveTx = await this.findOpenReserve(tx, params.organizationId, params.referenceId);
      if (!reserveTx) {
        throw new CreditError(
          'CREDIT_RESERVATION_NOT_FOUND',
          `Không tìm thấy reservation cho referenceId=${params.referenceId}`,
          { referenceId: params.referenceId },
        );
      }

      const amount = Number(reserveTx.amount);
      const wallet = walletEarly;
      const reserved = Number(wallet.reservedBalance);
      if (reserved < amount) {
        throw new CreditError('RESERVE_UNDERFLOW', 'reservedBalance không đủ để commit');
      }

      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          reservedBalance: this.decimal(reserved - amount),
          lifetimeUsed: this.decimal(Number(wallet.lifetimeUsed) + amount),
        },
      });

      try {
        const txn = await tx.creditTransaction.create({
          data: {
            organizationId: params.organizationId,
            walletId: wallet.id,
            type: CreditTransactionType.USAGE,
            amount: reserveTx.amount,
            balanceAfter: updated.balance,
            reservedAfter: updated.reservedBalance,
            reason: params.reason ?? reserveTx.reason,
            referenceId: params.referenceId,
            idempotencyKey: params.idempotencyKey,
            featureCode: params.featureCode ?? reserveTx.featureCode,
            metadata: (params.metadata ?? reserveTx.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
        return { transactionId: txn.id, idempotent: false, balance: this.snapshot(updated) };
      } catch (err) {
        this.throwIdempotentConflict(params.idempotencyKey, err);
      }
    }).catch((err) => this.resolveIdempotentAfterRollback(params.organizationId, params.idempotencyKey, err));
  }

  async release(params: CreditReleaseParams): Promise<CreditMutationResult> {
    this.requireIdempotencyKey(params.idempotencyKey);
    this.requireReferenceId(params.referenceId);

    return this.prisma.$transaction(async (tx) => {
      const walletEarly = await this.lockWallet(tx, params.organizationId);
      const existing = await this.findByIdempotency(tx, params.organizationId, params.idempotencyKey);
      if (existing) {
        return { transactionId: existing.id, idempotent: true, balance: this.snapshot(walletEarly) };
      }

      const reserveTx = await this.findOpenReserve(tx, params.organizationId, params.referenceId);
      if (!reserveTx) {
        throw new CreditError(
          'CREDIT_RESERVATION_NOT_FOUND',
          `Không tìm thấy reservation cho referenceId=${params.referenceId}`,
          { referenceId: params.referenceId },
        );
      }

      const amount = Number(reserveTx.amount);
      const wallet = walletEarly;
      const balance = Number(wallet.balance);
      const reservationMeta = (reserveTx.metadata ?? {}) as Record<string, unknown>;
      const planAmount = Number(reservationMeta.planCreditAmount ?? 0);
      const samePeriod = reservationMeta.planPeriodKey === wallet.planPeriodKey;
      const refundablePlan = samePeriod ? planAmount : 0;
      const refundable = amount - planAmount + refundablePlan;
      const reserved = Number(wallet.reservedBalance);
      if (reserved < amount) {
        throw new CreditError('RESERVE_UNDERFLOW', 'reservedBalance không đủ để release');
      }

      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: this.decimal(balance + refundable),
          planBalance: this.decimal(Number(wallet.planBalance) + refundablePlan),
          reservedBalance: this.decimal(reserved - amount),
        },
      });

      try {
        const txn = await tx.creditTransaction.create({
          data: {
            organizationId: params.organizationId,
            walletId: wallet.id,
            type: CreditTransactionType.RELEASE,
            amount: this.decimal(refundable),
            balanceAfter: updated.balance,
            reservedAfter: updated.reservedBalance,
            reason: params.reason ?? 'Release reservation',
            referenceId: params.referenceId,
            idempotencyKey: params.idempotencyKey,
            featureCode: reserveTx.featureCode,
            metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
        return { transactionId: txn.id, idempotent: false, balance: this.snapshot(updated) };
      } catch (err) {
        this.throwIdempotentConflict(params.idempotencyKey, err);
      }
    }).catch((err) => this.resolveIdempotentAfterRollback(params.organizationId, params.idempotencyKey, err));
  }

  /**
   * CHECK → RESERVE → RUN → COMMIT.
   * Lỗi trước khi provider bắt đầu → RELEASE.
   * Provider đã chạy (markProviderStarted) → COMMIT (đã phát sinh chi phí).
   * Duplicate/retry cùng referenceId đã USAGE → ALREADY_COMMITTED (không gọi fn).
   */
  async runPaidFeature<T>(params: RunPaidFeatureParams<T>): Promise<T> {
    const amount = await this.resolveFeatureAmount(params.featureCode, params.amount);
    const ref = params.referenceId;
    const commitKey = `${ref}:commit`;
    const resource = params.metadata?.meteringAddon === true ? null
      : params.featureCode === 'content_ai.image' ? 'images'
      : params.featureCode === 'chatbot.reply' ? 'chatbotReplies' : null;
    const policy = new PlanPolicy(this.prisma);
    const feature = params.featureCode === 'email.send' ? 'email_marketing'
      : params.featureCode === 'video.transcribe' ? 'video_transcription'
      : params.featureCode.startsWith('landing_page.') ? 'landing_pages'
      : params.featureCode === 'chatbot.reply' ? 'chatbot_cskh'
      : params.featureCode === 'ads_ai.creative' ? 'ads_performance' : 'content_ai';
    await policy.assertFeature(params.organizationId, feature);

    if (await this.hasCommitted(params.organizationId, ref)) {
      throw new CreditError('ALREADY_COMMITTED', 'Credit đã được trừ cho tác vụ này', {
        referenceId: ref,
      });
    }

    const open = await this.prisma.$transaction((tx) =>
      this.findOpenReserve(tx, params.organizationId, ref),
    );
    if (!open) {
      const ok = await this.checkAvailable(params.organizationId, amount);
      if (!ok) {
        const bal = await this.getBalance(params.organizationId);
        throw new CreditError('INSUFFICIENT_CREDITS', 'Không đủ AI Credit', {
          required: amount,
          available: bal.available,
        });
      }
      const releaseCount = await this.prisma.creditTransaction.count({
        where: {
          organizationId: params.organizationId,
          referenceId: ref,
          type: CreditTransactionType.RELEASE,
        },
      });
      await this.reserve({
        organizationId: params.organizationId,
        amount,
        referenceId: ref,
        idempotencyKey: `${ref}:reserve:${releaseCount}`,
        featureCode: params.featureCode,
        reason: params.reason,
        metadata: params.metadata,
      });
    }

    let providerStarted = false;
    try {
      if (resource) await policy.consume(params.organizationId, resource, ref);
      const result = await creditCallContext.run({ organizationId: params.organizationId,
        featureCode: params.featureCode, referenceId: ref, prepaid: true,
        markProviderStarted: () => { providerStarted = true; } }, () => params.fn({
        markProviderStarted: () => {
          providerStarted = true;
        },
      }));
      await this.commit({
        organizationId: params.organizationId,
        referenceId: ref,
        idempotencyKey: commitKey,
        featureCode: params.featureCode,
        reason: params.reason,
        metadata: params.metadata,
      });
      return result;
    } catch (err) {
      if (err instanceof CreditError && err.code === 'ALREADY_COMMITTED') throw err;
      if (providerStarted) {
        await this.commit({
          organizationId: params.organizationId,
          referenceId: ref,
          idempotencyKey: commitKey,
          featureCode: params.featureCode,
          reason: params.reason ?? 'Commit after provider started',
          metadata: params.metadata,
        }).catch(() => undefined);
      } else {
        await this.release({
          organizationId: params.organizationId,
          referenceId: ref,
          idempotencyKey: `${ref}:release:${Date.now()}`,
          reason: params.reason ?? 'Release — provider chưa chạy',
          metadata: params.metadata,
        }).catch(() => undefined);
        if (resource) await policy.release(params.organizationId, resource, ref);
      }
      throw err;
    }
  }

  private async creditIn(
    params: CreditGrantParams,
    type: CreditTransactionType,
    opts: { trackLifetimeEarned: boolean },
    existingTx?: Prisma.TransactionClient,
  ): Promise<CreditMutationResult> {
    this.assertPositiveAmount(params.amount, 'amount');
    this.requireIdempotencyKey(params.idempotencyKey);

    const run = async (tx: Prisma.TransactionClient): Promise<CreditMutationResult> => {
      const walletEarly = await this.lockWallet(tx, params.organizationId);
      const existing = await this.findByIdempotency(tx, params.organizationId, params.idempotencyKey);
      if (existing) {
        return { transactionId: existing.id, idempotent: true, balance: this.snapshot(walletEarly) };
      }

      const wallet = walletEarly;
      const balanceBefore = Number(wallet.balance);
      const data: Prisma.CreditWalletUpdateInput = {
        balance: this.decimal(balanceBefore + params.amount),
      };
      if (opts.trackLifetimeEarned) {
        data.lifetimeEarned = this.decimal(Number(wallet.lifetimeEarned) + params.amount);
      }
      const updated = await tx.creditWallet.update({ where: { id: wallet.id }, data });
      try {
        const txn = await tx.creditTransaction.create({
          data: {
            organizationId: params.organizationId,
            walletId: wallet.id,
            type,
            amount: this.decimal(params.amount),
            balanceBefore: this.decimal(balanceBefore),
            balanceAfter: updated.balance,
            reservedAfter: updated.reservedBalance,
            reason: params.reason,
            referenceId: params.referenceId,
            idempotencyKey: params.idempotencyKey,
            metadata: {
              ...(params.metadata ?? {}),
              ...(params.source ? { source: params.source } : {}),
            } as Prisma.InputJsonValue,
            source: params.source,
            userId: params.userId,
            subscriptionId: params.subscriptionId,
            paymentId: params.paymentId,
          },
        });
        return { transactionId: txn.id, idempotent: false, balance: this.snapshot(updated) };
      } catch (err) {
        this.throwIdempotentConflict(params.idempotencyKey, err);
      }
    };

    if (existingTx) return run(existingTx);
    return this.prisma
      .$transaction(run)
      .catch((err) => this.resolveIdempotentAfterRollback(params.organizationId, params.idempotencyKey, err));
  }

  private async debitOut(
    params: CreditUsageParams & { amount: number },
    type: CreditTransactionType,
    opts: { trackLifetimeUsed: boolean; fromBalance: boolean },
    existingTx?: Prisma.TransactionClient,
  ): Promise<CreditMutationResult> {
    this.assertPositiveAmount(params.amount, 'amount');
    this.requireIdempotencyKey(params.idempotencyKey);

    const run = async (tx: Prisma.TransactionClient): Promise<CreditMutationResult> => {
      // Lock first, then re-check idempotency under row lock (same pattern as creditIn/reserve).
      const walletEarly = await this.lockWallet(tx, params.organizationId);
      const existing = await this.findByIdempotency(tx, params.organizationId, params.idempotencyKey);
      if (existing) {
        return { transactionId: existing.id, idempotent: true, balance: this.snapshot(walletEarly) };
      }

      const wallet = walletEarly;
      const balance = Number(wallet.balance);
      if (opts.fromBalance && balance < params.amount) {
        throw new CreditError('INSUFFICIENT_CREDITS', 'Không đủ AI Credit', {
          required: params.amount,
          available: balance,
        });
      }

      const data: Prisma.CreditWalletUpdateInput = {
        balance: this.decimal(balance - params.amount),
        planBalance: this.decimal(Math.max(0, Number(wallet.planBalance) - params.amount)),
      };
      if (opts.trackLifetimeUsed) {
        data.lifetimeUsed = this.decimal(Number(wallet.lifetimeUsed) + params.amount);
      }
      const updated = await tx.creditWallet.update({ where: { id: wallet.id }, data });
      try {
        const txn = await tx.creditTransaction.create({
          data: {
            organizationId: params.organizationId,
            walletId: wallet.id,
            type,
            amount: this.decimal(params.amount),
            balanceAfter: updated.balance,
            reservedAfter: updated.reservedBalance,
            reason: params.reason,
            referenceId: params.referenceId,
            idempotencyKey: params.idempotencyKey,
            featureCode: params.featureCode,
            metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
        return { transactionId: txn.id, idempotent: false, balance: this.snapshot(updated) };
      } catch (err) {
        this.throwIdempotentConflict(params.idempotencyKey, err);
      }
    };

    if (existingTx) return run(existingTx);
    return this.prisma
      .$transaction(run)
      .catch((err) => this.resolveIdempotentAfterRollback(params.organizationId, params.idempotencyKey, err));
  }

  async ensureWallet(organizationId: string, tx?: PrismaLike): Promise<WalletRow> {
    const client = tx ?? this.prisma;
    const existing = await client.creditWallet.findUnique({ where: { organizationId } });
    if (existing) return existing;
    if (tx) {
      return tx.creditWallet.create({ data: { organizationId, balance: 0 } });
    }
    return this.prisma.creditWallet.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId, balance: 0 },
    });
  }

  private async lockWallet(tx: Prisma.TransactionClient, organizationId: string): Promise<WalletRow> {
    // Also serialize the first request, when no wallet row exists yet.
    const walletId = randomUUID();
    await tx.$executeRaw`INSERT INTO credit_wallets(id, organization_id, updated_at) VALUES (${walletId}, ${organizationId}, NOW()) ON CONFLICT(organization_id) DO NOTHING`;
    await tx.$executeRaw`SELECT id FROM credit_wallets WHERE organization_id = ${organizationId} FOR UPDATE`;
    let wallet = await tx.creditWallet.findUnique({ where: { organizationId } });
    if (!wallet) {
      wallet = await tx.creditWallet.create({ data: { organizationId, balance: 0 } });
      await tx.$executeRaw`SELECT id FROM credit_wallets WHERE organization_id = ${organizationId} FOR UPDATE`;
      wallet = await tx.creditWallet.findUniqueOrThrow({ where: { organizationId } });
    }
    return this.syncMonthlyPlanCredits(tx, wallet);
  }

  /** Lazy monthly refresh under the wallet lock: no cron and no advance annual grant. */
  private async syncMonthlyPlanCredits(tx: Prisma.TransactionClient, wallet: WalletRow): Promise<WalletRow> {
    const now = this.now();
    const sub = await tx.subscription.findFirst({
      where: { organizationId: wallet.organizationId, status: 'ACTIVE', currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
      include: { plan: true }, orderBy: { currentPeriodEnd: 'desc' },
    });
    const definition = planDefinition(sub?.plan.code);
    const period = sub && definition ? currentBillingMonth(sub.currentPeriodStart, now) : null;
    const key = sub && period ? `${sub.id}:${period.start.toISOString()}` : null;
    if (wallet.planPeriodKey === key) {
      if (!key || !definition || !sub) return wallet;
      const original = await tx.creditTransaction.findUnique({ where: {
        organizationId_idempotencyKey: { organizationId: wallet.organizationId, idempotencyKey: `plan-month:${key}` },
      } });
      if (!original) return wallet;
      if (Number(original.amount) >= definition.monthlyCredits) return wallet;
      const previous = await tx.creditTransaction.aggregate({ where: {
        organizationId: wallet.organizationId, referenceId: key, source: 'PLAN_MONTHLY_UPGRADE',
      }, _sum: { amount: true } });
      const delta = definition.monthlyCredits - Number(original.amount) - Number(previous._sum.amount || 0);
      if (delta <= 0) return wallet;
      // Increase only the current month's allowance; spent/purchased credit stays intact.
      const upgraded = await tx.creditWallet.update({ where: { id: wallet.id }, data: {
        balance: { increment: delta }, planBalance: { increment: delta }, lifetimeEarned: { increment: delta },
      } });
      await tx.creditTransaction.create({ data: {
        organizationId: wallet.organizationId, walletId: wallet.id, type: CreditTransactionType.GRANT,
        amount: this.decimal(delta), balanceAfter: upgraded.balance, reservedAfter: upgraded.reservedBalance,
        idempotencyKey: `plan-allowance:${key}:${definition.monthlyCredits}`, referenceId: key,
        subscriptionId: sub.id, source: 'PLAN_MONTHLY_UPGRADE', reason: 'Tăng hạn mức credit tháng',
        metadata: { planCode: sub.plan.code, monthlyAllowance: definition.monthlyCredits },
      } });
      return upgraded;
    }
    const expired = Number(wallet.planBalance);
    const alreadyGranted = key ? await tx.creditTransaction.findUnique({ where: {
      organizationId_idempotencyKey: { organizationId: wallet.organizationId, idempotencyKey: `plan-month:${key}` },
    } }) : null;
    const credits = alreadyGranted ? 0 : definition?.monthlyCredits ?? 0;
    const balance = Number(wallet.balance) - expired + credits;
    const updated = await tx.creditWallet.update({ where: { id: wallet.id }, data: {
      balance: this.decimal(balance), planBalance: this.decimal(credits), planPeriodKey: key,
      lifetimeEarned: { increment: credits },
    } });
    if (expired > 0) await tx.creditTransaction.create({ data: {
      organizationId: wallet.organizationId, walletId: wallet.id, type: CreditTransactionType.ADMIN_ADJUST,
      amount: this.decimal(expired), balanceAfter: this.decimal(Number(wallet.balance) - expired),
      reservedAfter: wallet.reservedBalance, idempotencyKey: `plan-expire:${wallet.planPeriodKey}`,
      reason: 'Credit theo gói hết kỳ tháng', metadata: { delta: -expired, source: 'PLAN_EXPIRY' },
    } });
    if (credits > 0 && key) await tx.creditTransaction.create({ data: {
      organizationId: wallet.organizationId, walletId: wallet.id, type: CreditTransactionType.GRANT,
      amount: this.decimal(credits), balanceAfter: updated.balance, reservedAfter: updated.reservedBalance,
      idempotencyKey: `plan-month:${key}`, subscriptionId: sub!.id,
      reason: `Credit tháng gói ${definition!.name}`, source: 'PLAN_MONTHLY',
      metadata: { planCode: sub!.plan.code, expiresAt: period!.end.toISOString() },
    } });
    return updated;
  }

  private async findByIdempotency(
    tx: Prisma.TransactionClient,
    organizationId: string,
    idempotencyKey: string,
  ) {
    return tx.creditTransaction.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
    });
  }

  private throwIdempotentConflict(idempotencyKey: string, err: unknown): never {
    if (isPrismaUniqueViolation(err) || err instanceof CreditIdempotentConflictError) {
      throw new CreditIdempotentConflictError(idempotencyKey);
    }
    throw err;
  }

  private async resolveIdempotentAfterRollback(
    organizationId: string,
    idempotencyKey: string,
    err: unknown,
  ): Promise<CreditMutationResult> {
    if (!(err instanceof CreditIdempotentConflictError) && !isPrismaUniqueViolation(err)) {
      throw err;
    }
    const existing = await this.prisma.creditTransaction.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
    });
    if (!existing) throw err;
    const wallet = await this.prisma.creditWallet.findUniqueOrThrow({ where: { organizationId } });
    return { transactionId: existing.id, idempotent: true, balance: this.snapshot(wallet) };
  }

  private async findOpenReserve(
    tx: Prisma.TransactionClient,
    organizationId: string,
    referenceId: string,
  ) {
    const reserve = await tx.creditTransaction.findFirst({
      where: { organizationId, referenceId, type: CreditTransactionType.RESERVE },
      orderBy: { createdAt: 'desc' },
    });
    if (!reserve) return null;
    const settled = await tx.creditTransaction.findFirst({
      where: {
        organizationId,
        referenceId,
        type: { in: [CreditTransactionType.USAGE, CreditTransactionType.RELEASE] },
        createdAt: { gte: reserve.createdAt },
      },
    });
    return settled ? null : reserve;
  }

  private snapshot(wallet: WalletRow): CreditBalanceSnapshot {
    const balance = Number(wallet.balance);
    const reservedBalance = Number(wallet.reservedBalance);
    return {
      organizationId: wallet.organizationId,
      balance,
      reservedBalance,
      available: Math.max(0, balance),
      lifetimeEarned: Number(wallet.lifetimeEarned),
      lifetimeUsed: Number(wallet.lifetimeUsed),
      planBalance: Number(wallet.planBalance),
      purchasedBalance: Math.max(0, balance - Number(wallet.planBalance)),
    };
  }

  private decimal(value: number) {
    return new Prisma.Decimal(value);
  }

  private assertPositiveAmount(amount: number, field: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new CreditError('INVALID_AMOUNT', `${field} phải là số dương`);
    }
  }

  private requireIdempotencyKey(key: string) {
    if (!key?.trim()) throw new CreditError('INVALID_IDEMPOTENCY', 'idempotencyKey là bắt buộc');
  }

  private requireReferenceId(referenceId: string) {
    if (!referenceId?.trim()) throw new CreditError('INVALID_REFERENCE', 'referenceId là bắt buộc');
  }
}
