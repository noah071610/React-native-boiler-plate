import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { rateHistory } from '@/db/schema';

/**
 * 환율 수신.
 *
 * 서버는 환율을 배포하기만 한다. 앱은 받은 것을 `rate_history`에 넣고, 계산할 때는
 * 절대 네트워크를 타지 않는다 — 비행기모드에서도 계산과 1년 그래프가 그대로 돈다.
 *
 * 인증 없는 공개 엔드포인트라 `services/api/client.ts`(Bearer + 401 회전)를 쓰지 않는다.
 */

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

/** 그래프가 1년을 그린다. 캐시가 비어 있으면 이만큼 한 번에 받는다. */
const BACKFILL_DAYS = 365;

/** SQLite 바인딩 한도(999) / 컬럼 5개 → 한 문장에 넉넉히 100행. */
const ROWS_PER_INSERT = 100;

/**
 * 백필 완료로 인정하는 여유. 환율은 주말·공휴일에 발표가 없어서 가장 오래된 행이
 * 정확히 365일 전일 수 없다. 이 여유가 없으면 매번 구멍으로 오인해 1년치를 다시 받는다.
 */
const BACKFILL_SLACK_DAYS = 7;

type RatesResponse = { base: string; quote: string; rates: { date: string; rate: number }[] };

const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const edgeDate = (base: string, quote: string, oldest: boolean): string | null =>
  db
    .select({ date: rateHistory.date })
    .from(rateHistory)
    .where(and(eq(rateHistory.base, base), eq(rateHistory.quote, quote)))
    .orderBy(oldest ? asc(rateHistory.date) : desc(rateHistory.date))
    .limit(1)
    .get()?.date ?? null;

/**
 * 어느 날짜부터 받아야 하는지.
 *
 * 캐시가 비었거나 앞쪽이 잘려 있으면 1년치를 통째로 받는다. 첫 동기화가 중간에
 * 끊기면 최신 몇 건만 남는데, 마지막 날짜만 보고 이어받으면 그래프가 1년 버튼을
 * 눌러도 영원히 짧은 채로 굳는다. 서버는 upsert라 다시 받아도 행이 늘지 않는다.
 */
function syncFrom(base: string, quote: string): string {
  const oldest = edgeDate(base, quote, true);
  const fullYear = isoDaysAgo(BACKFILL_DAYS);
  if (!oldest || oldest > isoDaysAgo(BACKFILL_DAYS - BACKFILL_SLACK_DAYS)) return fullYear;
  return edgeDate(base, quote, false) ?? fullYear;
}

/**
 * 서버에서 이 통화쌍의 빈 구간만 받아 캐시에 넣는다.
 *
 * 실패는 조용히 삼킨다 — 오프라인은 정상 상태이고, 화면은 이미 가진 환율로 계속 돈다.
 * 반환값은 새로 저장한 행 수(0이면 받을 게 없었거나 실패).
 */
const inflight = new Map<string, Promise<number>>();

export function syncRates(base: string, quote: string): Promise<number> {
  if (!baseUrl || !base || !quote || base === quote) return Promise.resolve(0);

  // 같은 통화쌍을 여러 화면이 동시에 마운트한다 (메인·타임라인·설정·여행 시트).
  // 합치지 않으면 캐시가 비었을 때 전부 "받은 게 없다"고 읽고 1년치를 각자 받는다.
  const key = `${base}/${quote}`;
  const running = inflight.get(key);
  if (running) return running;

  const task = fetchRates(base, quote).finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

async function fetchRates(base: string, quote: string): Promise<number> {
  const from = syncFrom(base, quote);
  const url = `${baseUrl}/api/tabica/rates?base=${base}&quote=${quote}&from=${from}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (__DEV__) console.warn(`[rates] ${res.status} ${url}`);
      return 0;
    }

    const body = (await res.json()) as RatesResponse;
    const rows = (body.rates ?? []).filter((r) => r.date && r.rate > 0);
    if (rows.length === 0) {
      if (__DEV__) console.warn(`[rates] 빈 응답 ${url} — 서버 daily_rates가 비었는지 확인`);
      return 0;
    }

    const fetchedAt = Date.now();
    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      await db
        .insert(rateHistory)
        .values(
          rows.slice(i, i + ROWS_PER_INSERT).map((r) => ({
            base,
            quote,
            date: r.date,
            rate: r.rate,
            fetchedAt,
          })),
        )
        // 같은 날짜를 다시 받으면 갱신한다. 여러 번 호출해도 행이 늘지 않는다.
        .onConflictDoUpdate({
          target: [rateHistory.base, rateHistory.quote, rateHistory.date],
          set: { rate: sql`excluded.rate`, fetchedAt },
        });
    }

    if (__DEV__) console.log(`[rates] ${base}/${quote} ${rows.length}건 저장 (${from} 이후)`);
    return rows.length;
  } catch (error) {
    // 오프라인은 정상 상태라 유저에게는 안 알린다. 다만 개발 중엔 이유가 보여야 한다
    // (서버 주소 오타/LAN 미개방을 조용히 삼키면 시드 환율이 계속 맞는 것처럼 보인다).
    if (__DEV__) console.warn(`[rates] 동기화 실패 ${url}:`, error);
    return 0;
  }
}
