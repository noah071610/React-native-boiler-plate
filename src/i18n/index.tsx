import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  CURRENCIES,
  findCountryByCode,
  findCountryByCurrency,
  type CountryInfo,
} from '@/constants/currencies';
import { categoryLabel as fallbackCategoryLabel } from '@/constants/categories';
import { formatAmount } from '@/lib/money';
import { useSettingsStore, type LanguagePreference } from '@/store/settings';

import en from './en.json';
import ja from './ja.json';
import ko from './ko.json';

export type AppLanguage = Exclude<LanguagePreference, 'system'>;
export type TFunction = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

export const DEFAULT_LANGUAGE: AppLanguage = 'ko';

export const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string; localeTag: string }[] = [
  { value: 'system', label: '기기 설정 따르기', localeTag: 'auto' },
  { value: 'ko', label: '한국어', localeTag: 'ko-KR' },
  { value: 'en', label: 'English', localeTag: 'en-US' },
  { value: 'ja', label: '日本語', localeTag: 'ja-JP' },
];

const localeTags = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
} satisfies Record<AppLanguage, string>;

const resources: Record<AppLanguage, Record<string, string>> = {
  ko,
  en,
  ja,
};

type I18nContextValue = {
  language: LanguagePreference;
  resolvedLanguage: AppLanguage;
  locale: string;
  t: TFunction;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const systemLanguage = (): AppLanguage => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('ja')) return 'ja';
  return DEFAULT_LANGUAGE;
};

const resolveLanguage = (language: LanguagePreference): AppLanguage =>
  language === 'system' ? systemLanguage() : language;

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSettingsStore((s) => s.language);
  const resolvedLanguage = resolveLanguage(language);
  const locale = localeTags[resolvedLanguage];

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      resolvedLanguage,
      locale,
      t: (key, fallback, values) => {
        const text =
          resources[resolvedLanguage][key] ?? resources[DEFAULT_LANGUAGE][key] ?? fallback ?? key;
        if (!values) return text;
        return Object.entries(values).reduce(
          (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
          text,
        );
      },
    }),
    [language, locale, resolvedLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}

export const countryLabel = (country: CountryInfo, t: TFunction) =>
  t(`country.${country.code}`, country.nameKo);

export const destinationLabel = (
  countryCode: string | null | undefined,
  currency: string,
  t: TFunction,
) => {
  const country = findCountryByCode(countryCode) ?? findCountryByCurrency(currency);
  return country ? countryLabel(country, t) : currency;
};

export const currencyName = (currency: string, t: TFunction) =>
  t(`currency.${currency}.name`, CURRENCIES[currency]?.nameKo ?? currency);

export const currencyUnit = (currency: string, t: TFunction) =>
  t(`currency.${currency}.unit`, CURRENCIES[currency]?.unitKo ?? currency);

export const formatMoneyI18n = (
  minor: number,
  currency: string,
  t: TFunction,
  language: AppLanguage,
) => {
  const separator = language === 'en' ? ' ' : '';
  return `${formatAmount(minor, currency)}${separator}${currencyUnit(currency, t)}`;
};

export const categoryDisplayLabel = (
  category: { key: string | null; name: string | null },
  t: TFunction,
) =>
  category.name ??
  (category.key ? t(`category.${category.key}`, fallbackCategoryLabel(category)) : '');
