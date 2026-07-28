/**
 * 통화 / 나라 상수.
 *
 * 금액은 DB에 정수 최소단위로 저장하므로 소수 자리수(digits)가 여기서 유일한 진실이다.
 * unitKo는 금액 옆에 붙는 한국어 단위 (13,894"원" / 320"바트").
 * i18n이 붙으면 unitKo는 번역 키로 교체된다 — 그래서 나라/통화 이름을 한 곳에 모아둔다.
 */

export type CurrencyInfo = {
  code: string;
  digits: 0 | 2;
  nameKo: string;
  unitKo: string;
  /** 검색 매칭용 별칭 — "바트", "baht" 등 */
  aliases: string[];
};

export const CURRENCIES: Record<string, CurrencyInfo> = {
  KRW: { code: 'KRW', digits: 0, nameKo: '원', unitKo: '원', aliases: ['won', '원화'] },
  JPY: { code: 'JPY', digits: 0, nameKo: '엔', unitKo: '엔', aliases: ['yen', '엔화'] },
  THB: { code: 'THB', digits: 0, nameKo: '바트', unitKo: '바트', aliases: ['baht'] },
  VND: { code: 'VND', digits: 0, nameKo: '동', unitKo: '동', aliases: ['dong'] },
  TWD: { code: 'TWD', digits: 0, nameKo: '대만 달러', unitKo: 'NT$', aliases: ['dollar'] },
  PHP: { code: 'PHP', digits: 2, nameKo: '페소', unitKo: '페소', aliases: ['peso'] },
  SGD: { code: 'SGD', digits: 2, nameKo: '싱가포르 달러', unitKo: 'S$', aliases: ['dollar'] },
  MYR: { code: 'MYR', digits: 2, nameKo: '링깃', unitKo: '링깃', aliases: ['ringgit'] },
  IDR: { code: 'IDR', digits: 0, nameKo: '루피아', unitKo: '루피아', aliases: ['rupiah'] },
  HKD: { code: 'HKD', digits: 2, nameKo: '홍콩 달러', unitKo: 'HK$', aliases: ['dollar'] },
  CNY: { code: 'CNY', digits: 2, nameKo: '위안', unitKo: '위안', aliases: ['yuan', 'rmb'] },
  KHR: { code: 'KHR', digits: 0, nameKo: '리엘', unitKo: '리엘', aliases: ['riel'] },
  LAK: { code: 'LAK', digits: 0, nameKo: '킵', unitKo: '킵', aliases: ['kip'] },
  INR: { code: 'INR', digits: 2, nameKo: '루피', unitKo: '루피', aliases: ['rupee'] },
  NPR: { code: 'NPR', digits: 2, nameKo: '네팔 루피', unitKo: '루피', aliases: ['rupee'] },
  MNT: { code: 'MNT', digits: 0, nameKo: '투그릭', unitKo: '투그릭', aliases: ['tugrik'] },
  USD: { code: 'USD', digits: 2, nameKo: '미국 달러', unitKo: '달러', aliases: ['dollar', '불'] },
  EUR: { code: 'EUR', digits: 2, nameKo: '유로', unitKo: '유로', aliases: ['euro'] },
  GBP: { code: 'GBP', digits: 2, nameKo: '파운드', unitKo: '파운드', aliases: ['pound'] },
  AUD: { code: 'AUD', digits: 2, nameKo: '호주 달러', unitKo: 'A$', aliases: ['dollar'] },
  NZD: { code: 'NZD', digits: 2, nameKo: '뉴질랜드 달러', unitKo: 'NZ$', aliases: ['dollar'] },
  CAD: { code: 'CAD', digits: 2, nameKo: '캐나다 달러', unitKo: 'C$', aliases: ['dollar'] },
  CHF: { code: 'CHF', digits: 2, nameKo: '스위스 프랑', unitKo: '프랑', aliases: ['franc'] },
  TRY: { code: 'TRY', digits: 2, nameKo: '리라', unitKo: '리라', aliases: ['lira'] },
  MXN: { code: 'MXN', digits: 2, nameKo: '멕시코 페소', unitKo: '페소', aliases: ['peso'] },
  BRL: { code: 'BRL', digits: 2, nameKo: '헤알', unitKo: '헤알', aliases: ['real'] },
  AED: { code: 'AED', digits: 2, nameKo: '디르함', unitKo: '디르함', aliases: ['dirham'] },
  EGP: { code: 'EGP', digits: 2, nameKo: '이집트 파운드', unitKo: '파운드', aliases: ['pound'] },
  ZAR: { code: 'ZAR', digits: 2, nameKo: '랜드', unitKo: '랜드', aliases: ['rand'] },
  RUB: { code: 'RUB', digits: 2, nameKo: '루블', unitKo: '루블', aliases: ['ruble'] },
};

export type CountryInfo = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  flag: string;
  nameKo: string;
  nameEn: string;
  currency: string;
};

/**
 * 온보딩 목록 순서 = 이 배열 순서.
 * 타겟(국제 커플 / 장기 체류자)이 아시아권에 몰려 있어 아시아를 먼저 둔다.
 */
export const COUNTRIES: CountryInfo[] = [
  { code: 'TH', flag: '🇹🇭', nameKo: '태국', nameEn: 'Thailand', currency: 'THB' },
  { code: 'JP', flag: '🇯🇵', nameKo: '일본', nameEn: 'Japan', currency: 'JPY' },
  { code: 'VN', flag: '🇻🇳', nameKo: '베트남', nameEn: 'Vietnam', currency: 'VND' },
  { code: 'TW', flag: '🇹🇼', nameKo: '대만', nameEn: 'Taiwan', currency: 'TWD' },
  { code: 'PH', flag: '🇵🇭', nameKo: '필리핀', nameEn: 'Philippines', currency: 'PHP' },
  { code: 'SG', flag: '🇸🇬', nameKo: '싱가포르', nameEn: 'Singapore', currency: 'SGD' },
  { code: 'MY', flag: '🇲🇾', nameKo: '말레이시아', nameEn: 'Malaysia', currency: 'MYR' },
  { code: 'ID', flag: '🇮🇩', nameKo: '인도네시아', nameEn: 'Indonesia', currency: 'IDR' },
  { code: 'HK', flag: '🇭🇰', nameKo: '홍콩', nameEn: 'Hong Kong', currency: 'HKD' },
  { code: 'CN', flag: '🇨🇳', nameKo: '중국', nameEn: 'China', currency: 'CNY' },
  { code: 'KH', flag: '🇰🇭', nameKo: '캄보디아', nameEn: 'Cambodia', currency: 'KHR' },
  { code: 'LA', flag: '🇱🇦', nameKo: '라오스', nameEn: 'Laos', currency: 'LAK' },
  { code: 'IN', flag: '🇮🇳', nameKo: '인도', nameEn: 'India', currency: 'INR' },
  { code: 'NP', flag: '🇳🇵', nameKo: '네팔', nameEn: 'Nepal', currency: 'NPR' },
  { code: 'MN', flag: '🇲🇳', nameKo: '몽골', nameEn: 'Mongolia', currency: 'MNT' },
  { code: 'KR', flag: '🇰🇷', nameKo: '대한민국', nameEn: 'South Korea', currency: 'KRW' },
  { code: 'US', flag: '🇺🇸', nameKo: '미국', nameEn: 'United States', currency: 'USD' },
  { code: 'DE', flag: '🇩🇪', nameKo: '독일', nameEn: 'Germany', currency: 'EUR' },
  { code: 'FR', flag: '🇫🇷', nameKo: '프랑스', nameEn: 'France', currency: 'EUR' },
  { code: 'IT', flag: '🇮🇹', nameKo: '이탈리아', nameEn: 'Italy', currency: 'EUR' },
  { code: 'ES', flag: '🇪🇸', nameKo: '스페인', nameEn: 'Spain', currency: 'EUR' },
  { code: 'PT', flag: '🇵🇹', nameKo: '포르투갈', nameEn: 'Portugal', currency: 'EUR' },
  { code: 'GB', flag: '🇬🇧', nameKo: '영국', nameEn: 'United Kingdom', currency: 'GBP' },
  { code: 'CH', flag: '🇨🇭', nameKo: '스위스', nameEn: 'Switzerland', currency: 'CHF' },
  { code: 'TR', flag: '🇹🇷', nameKo: '튀르키예', nameEn: 'Turkey', currency: 'TRY' },
  { code: 'AU', flag: '🇦🇺', nameKo: '호주', nameEn: 'Australia', currency: 'AUD' },
  { code: 'NZ', flag: '🇳🇿', nameKo: '뉴질랜드', nameEn: 'New Zealand', currency: 'NZD' },
  { code: 'CA', flag: '🇨🇦', nameKo: '캐나다', nameEn: 'Canada', currency: 'CAD' },
  { code: 'MX', flag: '🇲🇽', nameKo: '멕시코', nameEn: 'Mexico', currency: 'MXN' },
  { code: 'BR', flag: '🇧🇷', nameKo: '브라질', nameEn: 'Brazil', currency: 'BRL' },
  { code: 'AE', flag: '🇦🇪', nameKo: '아랍에미리트', nameEn: 'UAE', currency: 'AED' },
  { code: 'EG', flag: '🇪🇬', nameKo: '이집트', nameEn: 'Egypt', currency: 'EGP' },
  { code: 'ZA', flag: '🇿🇦', nameKo: '남아프리카공화국', nameEn: 'South Africa', currency: 'ZAR' },
  { code: 'RU', flag: '🇷🇺', nameKo: '러시아', nameEn: 'Russia', currency: 'RUB' },
];

/** 나라 이름 / 통화 코드 / 통화 이름 전부로 매칭한다 (§온보딩 검색 규칙). */
export function searchCountries(
  query: string,
  extraTerms?: (country: CountryInfo, currency: CurrencyInfo | undefined) => string[],
): CountryInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter((c) => {
    const cur = CURRENCIES[c.currency];
    const haystack = [
      c.nameKo,
      c.nameEn,
      c.code,
      c.currency,
      cur?.nameKo ?? '',
      ...(cur?.aliases ?? []),
      ...(extraTerms?.(c, cur) ?? []),
    ];
    return haystack.some((h) => h.toLowerCase().includes(q));
  });
}

/** 국기 이모지 — 통화 코드만 아는 화면(통화 페어 카드)에서 쓴다. */
export function flagOfCurrency(currency: string): string {
  return COUNTRIES.find((c) => c.currency === currency)?.flag ?? '🏳️';
}

export function countryNameOfCurrency(currency: string): string {
  return COUNTRIES.find((c) => c.currency === currency)?.nameKo ?? currency;
}

export function findCountryByCode(code: string | null | undefined): CountryInfo | null {
  return code ? (COUNTRIES.find((c) => c.code === code) ?? null) : null;
}

export function flagOfDestination(
  countryCode: string | null | undefined,
  currency: string,
): string {
  return findCountryByCode(countryCode)?.flag ?? flagOfCurrency(currency);
}

export function countryNameOfDestination(
  countryCode: string | null | undefined,
  currency: string,
): string {
  return findCountryByCode(countryCode)?.nameKo ?? countryNameOfCurrency(currency);
}

/** 통화 코드로 나라를 되찾는다 — 시트가 통화만 들고 여행을 만들 때 쓴다. */
export function findCountryByCurrency(currency: string): CountryInfo | null {
  return COUNTRIES.find((c) => c.currency === currency) ?? null;
}
