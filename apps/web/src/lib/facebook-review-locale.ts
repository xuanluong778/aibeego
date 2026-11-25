import { setStoredLocale } from '@/i18n/locale-storage';
import type { UiLocale } from '@/i18n/types';

/** Compatibility entry point; every UI uses the same persisted locale key. */
export function persistUiLocale(locale: UiLocale): void {
  setStoredLocale(locale);
}
