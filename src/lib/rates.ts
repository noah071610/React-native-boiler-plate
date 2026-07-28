import { and, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect } from 'react';

import { db } from '@/db';
import { rateHistory } from '@/db/schema';
import { syncRates } from '@/services/api/rates';

/**
 * 환율 조회.
 *
 * 원칙: 앱은 항상 기기에 저장된 환율(`rate_history`)을 먼저 쓴다. 네트워크는 있으면 좋은 것이다.
 * 캐시가 비어 있는 최초 실행에서만 앱에 함께 배포된 시드 환율로 버티고, 어느 쪽을 쓰든
 * 그 기준 날짜를 화면에 그대로 표시한다 (오래된 환율을 유저가 모르는 상태로 두지 않는다).
 */

/** 시드 환율의 기준 날짜. 'YYYY-MM-DD' */
export const SEED_RATE_DATE = '2026-07-24';

/** 1단위당 USD 값. 임의의 두 통화 환율을 이 표 하나로 만든다. */
const USD_PER: Record<string, number> = {
  USD: 1,
  KRW: 0.00072,
  JPY: 0.0064,
  THB: 0.0281,
  VND: 0.000038,
  TWD: 0.0312,
  PHP: 0.0172,
  SGD: 0.752,
  MYR: 0.223,
  IDR: 0.000061,
  HKD: 0.1282,
  CNY: 0.1394,
  KHR: 0.00025,
  LAK: 0.000046,
  INR: 0.0119,
  NPR: 0.0074,
  MNT: 0.00029,
  EUR: 1.09,
  GBP: 1.281,
  AUD: 0.659,
  NZD: 0.601,
  CAD: 0.731,
  CHF: 1.122,
  TRY: 0.0292,
  MXN: 0.0552,
  BRL: 0.181,
  AED: 0.2723,
  EGP: 0.0207,
  ZAR: 0.0553,
  RUB: 0.0112,
};

export type RateQuote = {
  /** 1 quote = rate base */
  rate: number;
  /** 그 환율의 기준 날짜 'YYYY-MM-DD' */
  date: string;
  /** 서버에서 받은 값인지. false면 앱에 심어둔 시드다. */
  fromServer: boolean;
};

/** 서버에서 받아 캐시한 값 중 가장 최신 1건. 없으면 null. */
function cachedRate(quote: string, base: string): RateQuote | null {
  const row = db
    .select({ date: rateHistory.date, rate: rateHistory.rate })
    .from(rateHistory)
    .where(and(eq(rateHistory.base, base), eq(rateHistory.quote, quote)))
    .orderBy(desc(rateHistory.date))
    .limit(1)
    .get();

  return row ? { rate: row.rate, date: row.date, fromServer: true } : null;
}

/** 시드 표에서 만든 값. 서버 환율을 아직 한 번도 못 받았을 때만 쓴다. */
function seedRate(quote: string, base: string): RateQuote | null {
  const q = USD_PER[quote];
  const b = USD_PER[base];
  if (!q || !b) return null;
  return { rate: q / b, date: SEED_RATE_DATE, fromServer: false };
}

/**
 * quote 1단위가 base 몇 단위인지.
 * 값이 없으면 null — 부정확한 숫자보다 없는 숫자가 낫다 (원칙 4).
 */
export function getRate(quote: string, base: string): RateQuote | null {
  if (!quote || !base) return null;
  if (quote === base) return { rate: 1, date: SEED_RATE_DATE, fromServer: false };
  return cachedRate(quote, base) ?? seedRate(quote, base);
}

/**
 * 화면용 환율. 서버에서 새 환율이 들어오면 자동으로 다시 그린다.
 *
 * 마운트할 때 이 통화쌍의 빈 구간을 한 번 받아온다 (캐시가 비었으면 1년치, 있으면 그 뒤부터).
 * 실패해도 화면은 이미 가진 값으로 그대로 돈다.
 */
export function useRate(quote: string, base: string): RateQuote | null {
  const { data } = useLiveQuery(
    db
      .select({ date: rateHistory.date, rate: rateHistory.rate })
      .from(rateHistory)
      .where(and(eq(rateHistory.base, base), eq(rateHistory.quote, quote)))
      .orderBy(desc(rateHistory.date))
      .limit(1),
    [base, quote],
  );

  useEffect(() => {
    void syncRates(base, quote);
  }, [base, quote]);

  if (!quote || !base) return null;
  if (quote === base) return { rate: 1, date: SEED_RATE_DATE, fromServer: false };

  const row = data?.[0];
  return row ? { rate: row.rate, date: row.date, fromServer: true } : seedRate(quote, base);
}

/** "7월 24일 환율" 같은 표기용. */
export function formatRateDate(date: string, locale = 'ko-KR'): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  if (locale.startsWith('ja')) return `${month}月${day}日`;
  if (locale.startsWith('en')) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(year, month - 1, day),
    );
  }
  return `${month}월 ${day}일`;
}
