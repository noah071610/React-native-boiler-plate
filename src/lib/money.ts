import { CURRENCIES } from '@/constants/currencies';

/** 통화의 소수 자리수. 모르는 통화는 2자리로 본다. */
export function digitsOf(currency: string): number {
  return CURRENCIES[currency]?.digits ?? 2;
}

const pow10 = (n: number) => 10 ** n;

/** 사람이 입력한 값 → 최소단위 정수. 320.5 THB → 32050 */
export function toMinor(value: number, currency: string): number {
  return Math.round(value * pow10(digitsOf(currency)));
}

/** 최소단위 정수 → 사람이 읽는 값. 32050 THB → 320.5 */
export function fromMinor(minor: number, currency: string): number {
  return minor / pow10(digitsOf(currency));
}

/** 천단위 구분 + 통화별 소수 자리. 단위는 붙이지 않는다. */
export function formatAmount(minor: number, currency: string): string {
  const d = digitsOf(currency);
  return fromMinor(minor, currency).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/**
 * 입력 중인 문자열에 천단위 구분만 넣는다 ("7820.5" → "7,820.5").
 * 소수부는 손대지 않는다 — 타이핑 중인 "1." 이나 "1.50"이 살아 있어야 한다.
 */
export function groupDigits(entry: string): string {
  const [intPart, decPart] = entry.split('.');
  const grouped = Number(intPart || '0').toLocaleString('en-US');
  return decPart === undefined ? grouped : `${grouped}.${decPart}`;
}

/** 단위까지 붙인 표기. 13894 KRW → "13,894원" */
export function formatMoney(minor: number, currency: string): string {
  const unit = CURRENCIES[currency]?.unitKo ?? currency;
  return `${formatAmount(minor, currency)}${unit}`;
}

/**
 * 최소단위 → 최소단위 환산. rate는 "1 from = rate to".
 * 정수로 반올림하므로 여기서만 환산하고, 결과는 그대로 DB에 박제한다.
 */
export function convertMinor(minor: number, from: string, to: string, rate: number): number {
  const value = fromMinor(minor, from) * rate;
  return toMinor(value, to);
}
