import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db';
import { expenses, participants, trips, type Expense, type Trip } from '@/db/schema';
import { pickActiveTrip, type TripPhase } from '@/lib/trip-dates';
import { useAppStore } from '@/store/app';

export type { TripPhase } from '@/lib/trip-dates';

export type TripSummary = {
  trip: Trip | null;
  phase: TripPhase;
  /** 기준 통화 최소단위 합계 (tombstone 제외) */
  spentBase: number;
  /** 여행 종료일까지 남은 일수. 기간 미설정이면 null */
  daysLeft: number | null;
  /** 기록이 있는 날 기준 하루 평균 지출 (기준 통화 최소단위) */
  dailyAvg: number | null;
  /** 남은 예산 / 남은 일수. 예산이나 기간이 없으면 null */
  dailyAllowance: number | null;
  today: { count: number; local: number; base: number };
  /** 어제 대비 변화율(%). 어제 기록이 없으면 null */
  vsYesterdayPercent: number | null;
};

/** 로컬 타임존 기준 'YYYY-MM-DD' */
export function localDateKey(ms: number): string {
  const d = new Date(ms);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const ms = Date.parse(`${toKey}T00:00:00`) - Date.parse(`${fromKey}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/**
 * 활성 여행 + 그 여행의 지출 집계.
 *
 * 활성 여행은 저장된 값이 아니라 오늘 날짜가 고른다 (lib/trip-dates).
 * 여행 기간이 아니면 진행 중인 여행이 없고(phase 'before' | 'after' | 'none'),
 * 그때 환율 페어의 현지 쪽은 온보딩에서 고른 기본값(defaultLocalCurrency)이다.
 *
 * 집계는 SQL이 아니라 JS에서 한다 — 한 여행의 지출은 수백 건 수준이고,
 * useLiveQuery가 변경을 감지해 자동으로 다시 계산해준다.
 * ponytail: 건수가 수천을 넘어가면 sum()을 SQL로 내린다.
 */
export function useActiveTrip(): TripSummary & {
  expenses: Expense[];
  /** 삭제되지 않은 전체 여행 (기간 겹침 검사 · 애널리틱스 목록) */
  trips: Trip[];
  /** 활성 여행에서의 내 참가자 id. 여행이 없으면 null */
  myParticipantId: string | null;
  /** 유저 본인 통화 (기기 지역 추론). 날씨처럼 "내 나라"가 필요한 곳이 쓴다 */
  homeCurrency: string;
  /** 화면이 쓸 기준 통화 (여행 > 본인 통화) */
  baseCurrency: string;
  /** 화면이 쓸 현지 통화 (여행 > 온보딩에서 고른 환율 기본값) */
  localCurrency: string;
  loading: boolean;
} {
  const homeCurrency = useAppStore((s) => s.homeCurrency) ?? 'USD';
  const defaultLocalCurrency = useAppStore((s) => s.defaultLocalCurrency) ?? homeCurrency;

  const tripQuery = useLiveQuery(db.select().from(trips).where(isNull(trips.deletedAt)));
  const tripRows = useMemo(() => tripQuery.data ?? [], [tripQuery.data]);

  const { trip, phase } = useMemo(
    () => pickActiveTrip(tripRows, localDateKey(Date.now())),
    [tripRows],
  );
  const tripId = trip?.id ?? '';

  // deps를 넘겨야 활성 여행이 바뀔 때 구독이 다시 걸린다 (기본값 []는 첫 쿼리에 고정된다)
  const expenseQuery = useLiveQuery(
    db
      .select()
      .from(expenses)
      .where(and(eq(expenses.tripId, tripId), isNull(expenses.deletedAt))),
    [tripId],
  );
  const meQuery = useLiveQuery(
    db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.tripId, tripId),
          eq(participants.isMe, true),
          isNull(participants.deletedAt),
        ),
      ),
    [tripId],
  );

  const rows = useMemo(() => expenseQuery.data ?? [], [expenseQuery.data]);

  const summary = useMemo<TripSummary>(() => {
    const todayKey = localDateKey(Date.now());
    const yesterdayKey = localDateKey(Date.now() - 86_400_000);

    let spentBase = 0;
    const perDay = new Map<string, number>();
    const today = { count: 0, local: 0, base: 0 };
    let yesterdayBase = 0;

    for (const e of rows) {
      spentBase += e.baseAmount;
      const key = localDateKey(e.occurredAt);
      perDay.set(key, (perDay.get(key) ?? 0) + e.baseAmount);
      if (key === todayKey) {
        today.count += 1;
        today.base += e.baseAmount;
        if (e.currency === trip?.destinationCurrency) today.local += e.amount;
      }
      if (key === yesterdayKey) yesterdayBase += e.baseAmount;
    }

    const daysLeft =
      trip?.endDate && phase !== 'after'
        ? Math.max(0, daysBetween(todayKey, trip.endDate) + 1)
        : null;

    const dailyAvg = perDay.size > 0 ? Math.round(spentBase / perDay.size) : null;

    const remaining = trip?.budgetAmount != null ? trip.budgetAmount - spentBase : null;
    const dailyAllowance =
      remaining != null && remaining > 0 && daysLeft != null && daysLeft > 0
        ? Math.round(remaining / daysLeft)
        : null;

    const vsYesterdayPercent =
      yesterdayBase > 0 ? Math.round(((today.base - yesterdayBase) / yesterdayBase) * 100) : null;

    return { trip, phase, spentBase, daysLeft, dailyAvg, dailyAllowance, today, vsYesterdayPercent };
  }, [rows, trip, phase]);

  const baseCurrency = trip?.baseCurrency ?? homeCurrency;

  return {
    ...summary,
    expenses: rows,
    trips: tripRows,
    myParticipantId: meQuery.data?.[0]?.id ?? null,
    homeCurrency,
    baseCurrency,
    localCurrency: trip?.destinationCurrency ?? defaultLocalCurrency,
    loading: tripQuery.data === undefined && tripQuery.error === undefined,
  };
}
