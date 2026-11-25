'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  useActivateTrial,
  useBillingPlans,
  useCancelPaymentOrder,
  useCreatePaymentOrder,
  useCurrentSubscription,
  usePaymentOrder,
  usePlanEntitlements,
  type BillingPlan,
  type PaymentOrder,
} from '@/hooks/use-billing';
import { useSubscriptionDisplay } from '@/hooks/use-subscription-display';
import { LoadingState, ErrorState } from '@/components/shared/page-state';
import { useCurrentUser } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { authStorage } from '@/lib/auth-storage';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { useT } from '@/i18n/i18n-provider';
import { PLAN_FEATURE_LABELS, PLAN_LIMIT_LABELS, BILLING_MONTHS, type PlanLimit } from '@marketingspa/shared';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  PAID: 'bg-emerald-100 text-emerald-900',
  EXPIRED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
  REVIEW_REQUIRED: 'bg-orange-100 text-orange-900',
};

function planPrice(p: BillingPlan) {
  return Number(p.priceVnd);
}

function PaymentSuccessDialog({
  open,
  order,
  userName,
  onClose,
}: {
  open: boolean;
  order: PaymentOrder | null;
  userName?: string;
  onClose: () => void;
}) {
  const name = userName?.trim() || 'bạn';
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md text-center sm:text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-center text-xl text-emerald-800">
            Thanh toán thành công!
          </DialogTitle>
          <DialogDescription className="text-center text-base text-foreground/80">
            Cảm ơn {name} đã tin tưởng và đồng hành cùng Ai Bee Go.
            <br />
            Thanh toán đã được ghi nhận. Nếu đổi hạng gói, gói mới bắt đầu sau thời hạn đã mua.
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm space-y-1.5">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Mã đơn</span>
              <span className="font-mono font-medium">{order.code}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Số tiền</span>
              <span className="font-medium">{formatCurrency(order.amountVnd)}</span>
            </div>
            {order.plan && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Gói</span>
                <span className="font-medium text-right">{order.plan.name}</span>
              </div>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Chúc bạn kinh doanh thuận lợi và tận dụng tối đa các tính năng của gói đã chọn.
        </p>
        <DialogFooter className="sm:justify-center">
          <Button className="w-full bg-teal-700 hover:bg-teal-800 sm:w-auto" onClick={onClose}>
            Tiếp tục sử dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentModal({
  orderId,
  open,
  onOpenChange,
  userName,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userName?: string;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { data: order, isLoading } = usePaymentOrder(orderId, { poll: true });
  const cancelMut = useCancelPaymentOrder();
  const [copied, setCopied] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const celebratedOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSuccessOpen(false);
      celebratedOrderId.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (order?.status !== 'PAID' || !order.id) return;
    if (celebratedOrderId.current === order.id) return;
    celebratedOrderId.current = order.id;
    setSuccessOpen(true);
    void qc.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    void qc.invalidateQueries({ queryKey: ['billing', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['billing', 'entitlements'] });
    void qc.invalidateQueries({ queryKey: ['credits'] });
  }, [order?.status, order?.id, qc]);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function closeSuccess() {
    setSuccessOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={open && !successOpen}
        onOpenChange={(v) => {
          if (!v && successOpen) return;
          onOpenChange(v);
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:p-5">
          <DialogHeader className="space-y-1 pr-6 text-left">
            <DialogTitle className="text-base sm:text-lg">Thanh toán đơn hàng</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Quét VietQR hoặc chuyển khoản đúng số tiền và nội dung để kích hoạt tự động.
            </DialogDescription>
          </DialogHeader>

          {isLoading || !order ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('pricing.loadingOrder')}
            </div>
          ) : (
            <PaymentOrderBody
              order={order}
              copied={copied}
              onCopy={copy}
              onCancel={() =>
                cancelMut.mutate(order.id, {
                  onSuccess: () => {
                    onOpenChange(false);
                  },
                })
              }
              cancelling={cancelMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <PaymentSuccessDialog
        open={successOpen}
        order={order ?? null}
        userName={userName}
        onClose={closeSuccess}
      />
    </>
  );
}

function PaymentOrderBody({
  order,
  copied,
  onCopy,
  onCancel,
  cancelling,
}: {
  order: PaymentOrder;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <div className="min-h-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground sm:text-sm">Trạng thái</span>
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[order.status] ?? ''}`}
        >
          {order.statusLabel}
        </span>
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-[auto_1fr] sm:gap-4">
        {order.qrUrl && order.status === 'PENDING' && (
          <div className="mx-auto flex shrink-0 justify-center rounded-lg border bg-white p-1.5 sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.qrUrl}
              alt="VietQR"
              className="h-[148px] w-[148px] object-contain sm:h-[168px] sm:w-[168px]"
            />
          </div>
        )}

        <dl className="min-w-0 space-y-0 text-sm">
          <Row
            label="Mã đơn"
            value={order.code}
            copyKey="code"
            copied={copied}
            onCopy={onCopy}
          />
          <Row
            label="Số tiền"
            value={`${formatCurrency(order.amountVnd)}`}
            copyKey="amount"
            copied={copied}
            onCopy={() => onCopy(String(order.amountVnd), 'amount')}
          />
          <Row
            label="Nội dung CK"
            value={order.transferContent}
            copyKey="content"
            copied={copied}
            onCopy={onCopy}
          />
          <Row
            label="Số TK"
            value={order.accountNumber}
            copyKey="account"
            copied={copied}
            onCopy={onCopy}
          />
          <Row
            label="Chủ TK"
            value={order.accountName}
            copyKey="name"
            copied={copied}
            onCopy={onCopy}
          />
          <div className="flex justify-between gap-2 border-b border-dashed py-1 text-xs sm:text-sm">
            <dt className="text-muted-foreground shrink-0">Ngân hàng</dt>
            <dd className="font-medium">{order.bankCode}</dd>
          </div>
          <div className="flex justify-between gap-2 py-1 text-xs sm:text-sm">
            <dt className="text-muted-foreground shrink-0">Hết hạn</dt>
            <dd className="font-medium text-right">{formatDateTime(order.expiresAt)}</dd>
          </div>
          {order.plan && (
            <div className="flex justify-between gap-2 py-1 text-xs sm:text-sm">
              <dt className="text-muted-foreground shrink-0">Gói</dt>
              <dd className="font-medium text-right leading-snug">{order.plan.name}</dd>
            </div>
          )}
        </dl>
      </div>

      {order.reviewNote && (
        <p className="rounded-md bg-orange-50 p-2 text-xs text-orange-900">{order.reviewNote}</p>
      )}

      {order.status === 'PENDING' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onCancel}
          disabled={cancelling}
        >
          Hủy đơn
        </Button>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dashed py-1 text-xs sm:text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 font-medium">
        <span className="truncate text-right">{value}</span>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
          onClick={() => onCopy(value, copyKey)}
          aria-label="Copy"
        >
          {copied === copyKey ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </dd>
    </div>
  );
}

function TrialCard({
  sub,
  onActivate,
  activating,
}: {
  sub: NonNullable<ReturnType<typeof useCurrentSubscription>['data']>;
  onActivate: () => void;
  activating: boolean;
}) {
  const t = useT();
  const trial = sub.trial;
  const status = sub.subscriptionStatus ?? sub.status;

  // Đã kích hoạt / đang trial / hết trial → ẩn CTA kích hoạt
  if (!trial?.enabled) return null;
  if (status === 'ACTIVE' || status === 'EXPIRING') return null;

  if (status === 'TRIALING' && trial) {
    return (
      <section className="rounded-2xl border border-teal-400/50 bg-[#0A3D31] p-6 text-white shadow-md">
        <h2 className="text-lg font-semibold text-heading">{t('pricingPage.usingTrial3')}</h2>
        <p className="mt-1 text-sm text-white/80">
          Bạn đang được dùng Content cơ bản trong thời gian dùng thử.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-white/65">{t('pricingPage.start')}</dt>
            <dd className="font-medium text-white">
              {trial.trialStartedAt ? formatDateTime(trial.trialStartedAt) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-white/65">{t('pricingPage.end')}</dt>
            <dd className="font-medium text-white">
              {trial.trialEndsAt ? formatDateTime(trial.trialEndsAt) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-white/65">Còn lại</dt>
            <dd className="font-semibold text-emerald-300">
              {trial.remainingDays} ngày ({trial.remainingHours} giờ)
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-white/65">Quyền dùng thử</dt>
            <dd className="font-medium text-white">Content &amp; Auto Post</dd>
          </div>
        </dl>
        {trial.warningWithin24h && (
          <p className="mt-3 rounded-md border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-sm text-amber-100">
            Dùng thử còn dưới 24 giờ. Nâng cấp ngay để không bị gián đoạn.
          </p>
        )}
        <Button
          className="mt-4 bg-heading text-white hover:bg-heading/90 hover:text-white"
          asChild
        >
          <a href="#plans">Nâng cấp ngay</a>
        </Button>
      </section>
    );
  }

  if (status === 'TRIAL_EXPIRED' || trial?.status === 'USED' || trial?.activated) {
    return (
      <section className="rounded-2xl border border-red-400/50 bg-[#0A3D31] p-6 text-white shadow-md">
        <h2 className="text-lg font-semibold text-red-300">Dùng thử đã kết thúc</h2>
        <p className="mt-2 text-sm text-white/90">
          Thời gian dùng thử đã kết thúc. Vui lòng thanh toán để tiếp tục sử dụng Ai Bee Go.
        </p>
        {trial?.trialEndsAt && (
          <p className="mt-2 text-xs text-white/65">
            Kết thúc lúc {formatDateTime(trial.trialEndsAt)}
          </p>
        )}
        <Button
          className="mt-4 bg-heading text-white hover:bg-heading/90 hover:text-white"
          asChild
        >
          <a href="#plans">Thanh toán ngay</a>
        </Button>
      </section>
    );
  }

  if (!trial?.eligible) return null;

  return (
    <section className="rounded-2xl border border-teal-400/50 bg-[#0A3D31] p-6 text-white shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge className="mb-2 border-0 bg-emerald-400/20 text-emerald-200 hover:bg-emerald-400/20">
            Miễn phí
          </Badge>
          <h2 className="text-xl font-semibold text-heading">Dùng thử miễn phí 3 ngày</h2>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Kích hoạt khi bạn sẵn sàng — thời gian chỉ bắt đầu sau khi bạn bấm nút. Mỗi email /
            thiết bị chỉ được dùng thử một lần.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-white">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Content Marketing cơ bản
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Auto Post Fanpage
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              {trial.trialDays} ngày kể từ lúc kích hoạt
            </li>
          </ul>
        </div>
        <Button
          className="bg-heading text-white hover:bg-heading/90 hover:text-white"
          onClick={onActivate}
          disabled={activating}
        >
          {activating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang kích hoạt...
            </>
          ) : (
            t('pricingPage.activateTrial3')
          )}
        </Button>
      </div>
    </section>
  );
}

function PricingPageInner() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const { data: plans, isLoading, isError, refetch } = useBillingPlans();
  const { data: sub } = useCurrentSubscription();
  const { data: entitlements } = usePlanEntitlements();
  const { display } = useSubscriptionDisplay();
  const createOrder = useCreatePaymentOrder();
  const activateTrial = useActivateTrial();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const upgradeStarted = useRef(false);
  const reason = searchParams.get('reason');
  const [billingMonths, setBillingMonths] = useState<number>(1);

  const sorted = useMemo(
    () =>
      (plans ?? [])
        .filter((p) => p.durationMonths === billingMonths && p.entitlement)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.durationMonths - b.durationMonths),
    [plans, billingMonths],
  );

  async function register(plan: BillingPlan) {
    if (!authStorage.isAuthenticated() && !user) {
      router.push('/login?next=/pricing');
      return;
    }
    try {
      const order = await createOrder.mutateAsync(plan.code);
      setActiveOrderId(order.id);
      setModalOpen(true);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t('pricingPage.createOrderFailed'));
    }
  }

  // Deep-link từ menu tài khoản: /pricing?upgrade=msp-pro-12m
  useEffect(() => {
    const code = searchParams.get('upgrade');
    if (!code || upgradeStarted.current || !plans?.length) return;
    if (!authStorage.isAuthenticated() && !user) return;
    const plan = plans.find((p) => p.code === code);
    if (!plan) return;
    upgradeStarted.current = true;
    void register(plan).finally(() => {
      router.replace('/pricing', { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi có query upgrade
  }, [searchParams, plans, user]);

  if (isLoading || authLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  async function handleActivateTrial() {
    if (!authStorage.isAuthenticated() && !user) {
      router.push('/login?next=/pricing');
      return;
    }
    try {
      await activateTrial.mutateAsync(getDeviceFingerprint());
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t('pricingPage.activateTrialFailed'));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-12">
      <header className="space-y-3 text-center">
        <p className="text-sm font-medium tracking-wide text-emerald-300">Ai Bee Go — Basic · Pro · VIP</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('pricing.title')}</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">Chọn gói phù hợp với công việc và quy mô kinh doanh của bạn.</p>
        {reason === 'trial_expired' && (
          <p className="mx-auto max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Thời gian dùng thử đã kết thúc. Vui lòng thanh toán để tiếp tục sử dụng Ai Bee Go.
          </p>
        )}
        {reason === 'subscription_required' && (
          <p className="mx-auto max-w-2xl rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Vui lòng thanh toán hoặc kích hoạt dùng thử 3 ngày để sử dụng tính năng.
          </p>
        )}
        {display && display.tier !== 'FREE' && display.tier !== 'TRIAL' && display.expiresAt && (
          <p className="text-sm text-emerald-700">
            {display.planLabel} — còn {display.remainingDays} ngày (đến{' '}
            {formatDateTime(display.expiresAt)})
          </p>
        )}
      </header>

      {sub && (
        <TrialCard
          sub={sub}
          onActivate={() => void handleActivateTrial()}
          activating={activateTrial.isPending}
        />
      )}

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Kỳ thanh toán">
        {BILLING_MONTHS.map((months) => (
          <Button key={months} variant={billingMonths === months ? 'default' : 'outline'}
            aria-pressed={billingMonths === months} onClick={() => setBillingMonths(months)}>
            {months} tháng{months === 12 ? ' · Tiết kiệm 2 tháng' : ''}
          </Button>
        ))}
      </div>
      {entitlements?.scheduled?.map((scheduled) => (
        <p key={scheduled.startsAt} className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm text-teal-900">
          Đã thanh toán {scheduled.name}. Bắt đầu lúc {formatDateTime(scheduled.startsAt)}.
        </p>
      ))}
      {sorted.length === 0 && <p className="text-center text-muted-foreground">Chưa có gói cho kỳ thanh toán này.</p>}
      <div id="plans" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((plan) => {
          const recommended = Boolean(plan.highlightLabel);
          const savings = plan.savingsAmount ? Number(plan.savingsAmount) : 0;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border border-teal-400/50 bg-[#0A3D31] p-6 text-white shadow-md ${
                recommended ? 'ring-1 ring-heading/50' : ''
              }`}
            >
              {recommended && (
                <Badge className="absolute -top-2.5 right-4 border-0 bg-heading text-white hover:bg-heading">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {plan.highlightLabel}
                </Badge>
              )}
              <h2 className="text-xl font-semibold text-heading">{plan.name}</h2>
              <p className="mt-1 text-sm text-white/75">
                {plan.bonusMonths
                  ? `${plan.durationMonths} tháng + tặng ${plan.bonusMonths} tháng · Tổng ${plan.totalUsageMonths} tháng sử dụng`
                  : `${plan.durationMonths} tháng sử dụng`}
              </p>
              {Boolean(plan.bonusMonths) && (
                <p className="mt-2 text-sm font-semibold text-emerald-300">Mua 6 tháng tặng 1 tháng</p>
              )}
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-white">
                  {formatCurrency(planPrice(plan))}
                </span>
                <span className="text-white/75"> / {plan.durationMonths} tháng</span>
              </div>
              {savings > 0 && (
                <p className="mt-2 text-sm font-medium text-emerald-300">
                  Tiết kiệm {formatCurrency(savings)} so với thanh toán từng tháng
                </p>
              )}
              <p className="mt-2 text-sm text-emerald-300">
                {plan.entitlement!.monthlyCredits.toLocaleString('vi-VN')} credit AI mỗi tháng
              </p>
              <p className="mt-1 text-xs text-white/75">Credit theo gói hết hạn cuối kỳ tháng; credit mua thêm được giữ riêng.</p>
              <p className="mt-1 text-xs text-white/75">
                Gợi ý phân bổ {Math.floor(plan.entitlement!.monthlyCredits / 30).toLocaleString('vi-VN')} credit/ngày trong 30 ngày. Số lượt sử dụng tùy tác vụ.
              </p>
              <p className="mt-3 text-sm text-white/90">
                {plan.entitlement!.limits.users} người dùng · {plan.entitlement!.limits.fanpages} Fanpage · {plan.entitlement!.limits.bots} chatbot
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-white/95">
                {plan.entitlement!.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{PLAN_FEATURE_LABELS[feature] ?? feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-6 w-full text-white hover:text-white ${
                  recommended
                    ? 'bg-heading hover:bg-heading/90'
                    : 'bg-teal-500 hover:bg-teal-400'
                }`}
                onClick={() => register(plan)}
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> …
                  </>
                ) : (
                  t('pricingPage.registerNow')
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('pricingPage.compareBenefits')}</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t('pricingPage.benefits')}</th>
                {sorted.map((plan) => (
                  <th key={plan.id} className="px-4 py-3 text-center font-medium whitespace-nowrap">
                    {plan.entitlement!.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PLAN_FEATURE_LABELS).map(([feature, label]) => (
                <tr key={feature} className="border-t">
                  <td className="px-4 py-2.5">{label}</td>
                  {sorted.map((plan) => (
                    <td key={plan.id} className="px-4 py-2.5 text-center">
                      {plan.entitlement!.features.includes(feature) ? '✓' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
              {(['users', 'branches', 'fanpages', 'zaloOas', 'customers', 'landingPages', 'bots', 'knowledgeBases', 'flows', 'chatbotReplies', 'transcriptionMinutes', 'sourcePages', 'emails', 'posts', 'storageMb', 'uploadMb'] as PlanLimit[]).map((limit) => (
                <tr key={limit} className="border-t">
                  <td className="px-4 py-2.5">{PLAN_LIMIT_LABELS[limit]}</td>
                  {sorted.map((plan) => <td key={plan.id} className="px-4 py-2.5 text-center">{plan.entitlement!.limits[limit].toLocaleString('vi-VN')}</td>)}
                </tr>
              ))}
              <tr className="border-t bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{t('pricingPage.price')}</td>
                {sorted.map((plan) => (
                  <td key={plan.id} className="px-4 py-2.5 text-center font-medium whitespace-nowrap">
                    {formatCurrency(planPrice(plan))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Quyền lợi và hạn mức tháng giữ nguyên giữa kỳ 1, 6 và 12 tháng của cùng một hạng gói.
          Credit AI dùng chung cho các tác vụ, được cấp từng tháng và không cộng dồn.
          Phí quảng cáo, tên miền và tin nhắn bên thứ ba được thanh toán riêng.
          Khi đổi hạng, gói mới bắt đầu sau thời hạn gói đã mua; không mất ngày sử dụng còn lại.
        </p>
      </section>

      <PaymentModal
        orderId={activeOrderId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        userName={user?.name}
      />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PricingPageInner />
    </Suspense>
  );
}
