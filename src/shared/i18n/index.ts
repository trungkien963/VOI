import { useUiStore } from '../../app/ui-store';
import type { SupportedLocale } from '../../domain/types/entities';
import { en, type TranslationDictionary } from './en';
import { vi } from './vi';

export const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en,
  vi,
};

export const t: TranslationDictionary = en;

export function getDictionary(locale: SupportedLocale): TranslationDictionary {
  return DICTIONARIES[locale] ?? en;
}

export interface UseTranslationResult {
  t: TranslationDictionary;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
}

export function useTranslation(): UseTranslationResult {
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const toggleLocale = useUiStore((state) => state.toggleLocale);

  return {
    t: getDictionary(locale),
    locale,
    setLocale,
    toggleLocale,
  };
}

export function getCategoryDisplayName(
  category: { slug: string; name: string },
  dict: TranslationDictionary,
): string {
  return dict.categories[category.slug] ?? category.name;
}

export function formatVnd(amountMinor: number, hidden = false): string {
  if (hidden) {
    return '••••••đ';
  }
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(amountMinor));
  return amountMinor < 0 ? `-${formatted}đ` : `${formatted}đ`;
}

export { en, vi, type TranslationDictionary };
