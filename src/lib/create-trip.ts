import { CURRENCIES, type CountryInfo } from '@/constants/currencies';
import { db } from '@/db';
import { participants, trips } from '@/db/schema';
import { newId } from '@/lib/utils';

/** 기기 지역 → 기준 통화. 추론이 실패하면 USD로 둔다. */
export function inferBaseCurrency(): string {
  const byRegion: Record<string, string> = {
    KR: 'KRW',
    JP: 'JPY',
    US: 'USD',
    TW: 'TWD',
    HK: 'HKD',
    SG: 'SGD',
    CN: 'CNY',
    GB: 'GBP',
    AU: 'AUD',
    CA: 'CAD',
    NZ: 'NZD',
    CH: 'CHF',
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    PT: 'EUR',
  };
  try {
    const locale = new Intl.NumberFormat().resolvedOptions().locale;
    const region = locale.split('-').pop()?.toUpperCase() ?? '';
    const currency = byRegion[region];
    return currency && CURRENCIES[currency] ? currency : 'USD';
  } catch {
    return 'USD';
  }
}

export type NewTripInput = {
  country: CountryInfo;
  /** 유저 본인 통화 */
  baseCurrency?: string;
  /** 'YYYY-MM-DD'. 기간은 필수다 — 여행은 기간으로 활성화된다 */
  startDate: string;
  endDate: string;
  /** 기준 통화 최소단위. 미설정이면 null */
  budgetAmount?: number | null;
  /** 예산 카드 표시 통화 */
  budgetCurrency?: string | null;
};

/**
 * 여행 하나 + 본인 참가자 1명을 만든다.
 * 메인의 "여행지 추가하기"와 설정의 "새 여행"이 같은 경로를 쓴다.
 *
 * 기간 겹침 검사는 여기서 하지 않는다 — 호출부가 findOverlap으로 먼저 막는다
 * (겹치면 유저에게 어떤 여행과 겹쳤는지 말해줘야 해서 화면이 알아야 한다).
 */
export async function createTrip({
  country,
  baseCurrency = inferBaseCurrency(),
  startDate,
  endDate,
  budgetAmount = null,
  budgetCurrency = null,
}: NewTripInput): Promise<{ tripId: string; participantId: string }> {
  const now = Date.now();
  const tripId = newId();
  const participantId = newId();

  await db.insert(trips).values({
    id: tripId,
    destinationCurrency: country.currency,
    destinationCountryCode: country.code,
    baseCurrency,
    startDate,
    endDate,
    budgetAmount,
    budgetCurrency: budgetAmount != null ? budgetCurrency : null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(participants).values({
    id: participantId,
    tripId,
    name: '나',
    isMe: true,
    joinedAt: now,
    updatedAt: now,
  });

  return { tripId, participantId };
}
