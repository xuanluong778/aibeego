import type {
  SubscriptionTier,
  SubscriptionUpgradeVariant,
} from '@marketingspa/shared';
import type { TranslateParams } from '@/i18n/types';

type TFn = (key: string, params?: TranslateParams) => string;

export function localizedPlanLabel(
  t: TFn,
  tier: SubscriptionTier,
  trialDays = 3,
): string {
  const catalog = /^(BASIC|VIP)_(1|6|12)M$/.exec(tier);
  if (catalog) return `${catalog[1] === 'BASIC' ? 'Basic' : 'VIP'} · ${catalog[2]} tháng`;
  switch (tier) {
    case 'PRO_1M':
      return t('layout.currentPlan1m');
    case 'PRO_12M':
      return t('layout.currentPlan12m');
    case 'PRO_6M':
      return t('layout.currentPlan6m');
    case 'TRIAL':
      return t('layout.trialPlan', { days: trialDays });
    case 'ADMIN_GIFT':
      return t('layout.giftedPackage');
    case 'FREE':
    default:
      return t('layout.noProPlan');
  }
}

export function localizedUpgradeLabel(
  t: TFn,
  variant: SubscriptionUpgradeVariant,
): string {
  switch (variant) {
    case 'compare_plans':
      return 'Xem các gói';
    case 'upgrade_12m':
      return t('layout.upgradeTo12m');
    case 'current_plan':
      return t('layout.currentPlan12m');
    case 'upgrade_pro':
    default:
      return t('layout.upgradePro');
  }
}
