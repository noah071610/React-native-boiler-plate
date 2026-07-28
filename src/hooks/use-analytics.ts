import { useMemo } from 'react';

import { categoryLabel } from '@/constants/categories';
import type { Category, Expense, Participant, Trip } from '@/db/schema';
import { localDateKey } from '@/hooks/use-active-trip';

/** 기준선 한 줄을 만들기 위해 필요한 최소 기록 수. 미만이면 그 줄을 아예 만들지 않는다. */
const MIN_SAMPLES = 4;
/** 일별 추이를 "추이"라고 부를 수 있는 최소 일수 */
export const MIN_TREND_DAYS = 3;
/** 막대가 이보다 많아지면 최근 구간만 그린다 */
const MAX_TREND_DAYS = 60;

export type CategorySlice = {
  id: string;
  icon: string;
  label: string;
  color: string;
  /** 표시 통화 금액 (여행 통화가 하나면 현지 통화, 섞여 있으면 기준 통화) */
  minor: number;
  baseMinor: number;
  percent: number;
};

export type DailyPoint = {
  key: string;
  /** '24' — 막대 아래 라벨 */
  label: string;
  value: number;
  avg: number;
  isToday: boolean;
};

export type BaselineRow = {
  id: string;
  icon: string;
  label: string;
  medianMinor: number;
  latestMinor: number;
  trend: 'up' | 'down' | 'same';
};

export type Settlement = {
  sharedMinor: number;
  sharedBaseMinor: number;
  personalMinor: number;
  perPersonMinor: number;
  me: { name: string; minor: number };
  other: { name: string; minor: number };
  /** 균등 분할과의 차액 (양수). 0이면 정산할 것이 없다. */
  diffMinor: number;
  diffBaseMinor: number;
  /** 'other-to-me' = 상대가 나에게 준다 */
  direction: 'other-to-me' | 'me-to-other' | 'even';
};

export type UsageRow = {
  id: string;
  name: string;
  isMe: boolean;
  /** 본인이 쓴 것으로 지정된 금액 */
  ownMinor: number;
  /** 공용에서 나눠 받은 몫 (공용 합계의 절반) */
  sharedShareMinor: number;
  totalMinor: number;
};

/** ⑥ 개인별 소비 비교 — 참가자 2명일 때만 존재한다 */
export type Usage = {
  rows: UsageRow[];
  /** 공용으로 남아 있는 합계 (반씩 나눠 rows에 들어가 있다) */
  sharedPoolMinor: number;
  /** 막대 길이 기준 */
  maxMinor: number;
};

export type Analytics = {
  /** '7월 22일 – 7월 26일' */
  rangeLabel: string;
  days: number;
  /** 표시 통화 — 여행 내내 한 통화만 썼으면 현지 통화, 섞였으면 기준 통화 */
  currency: string;
  baseCurrency: string;
  /** 표시 통화와 기준 통화가 같으면 병기하지 않는다 */
  dualCurrency: boolean;
  totalMinor: number;
  totalBaseMinor: number;
  budgetPercent: number | null;
  /** 예산을 넘었으면 초과분(기준 통화). 넘지 않았으면 null */
  overBaseMinor: number | null;
  dailyAvgBaseMinor: number;
  categories: CategorySlice[];
  daily: DailyPoint[];
  baseline: BaselineRow[];
  settlement: Settlement | null;
  usage: Usage | null;
};

const MD = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const median = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const addDays = (key: string, n: number) =>
  localDateKey(Date.parse(`${key}T00:00:00`) + n * 86_400_000);

type Params = {
  /** 여행이 아직 없으면 null — 훅은 null을 돌려준다 */
  trip: Trip | null;
  expenses: Expense[];
  categories: Category[];
  participants: Participant[];
  myParticipantId: string | null;
  /** 카테고리 색. scheme.chart1..5를 넘긴다 */
  palette: string[];
};

/**
 * 애널리틱스 전 구간을 한 번에 계산한다.
 *
 * 남의 데이터는 쓰지 않는다 — 국가별 물가 DB 대신 이 유저 본인의 중앙값이
 * "내 기준으로 비싼가"에 답한다 (layout-analytics ④).
 * ponytail: 전부 JS 집계다. 한 여행의 지출은 수백 건 수준이고 useLiveQuery가
 * 변경 시 알아서 다시 돌린다. 수천 건을 넘기면 sum()을 SQL로 내린다.
 */
export function useAnalytics({
  trip,
  expenses,
  categories,
  participants,
  myParticipantId,
  palette,
}: Params): Analytics | null {
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  return useMemo(() => {
    if (!trip || expenses.length === 0) return null;

    // 여행 내내 한 통화만 썼으면 현지 통화로 말한다. 여러 나라를 연달아 다녔으면
    // 합계가 성립하는 통화는 기준 통화뿐이다 (스냅샷 환율로 이미 환산돼 있다).
    const uniform = expenses.every((e) => e.currency === trip.destinationCurrency);
    const currency = uniform ? trip.destinationCurrency : trip.baseCurrency;
    const valueOf = (e: Expense) => (uniform ? e.amount : e.baseAmount);

    const dayKeys = expenses.map((e) => localDateKey(e.occurredAt)).sort();
    const todayKey = localDateKey(Date.now());
    const firstKey = trip.startDate ?? dayKeys[0];
    const lastRecorded = dayKeys[dayKeys.length - 1];
    const lastKey =
      trip.endDate && trip.endDate < todayKey
        ? trip.endDate
        : lastRecorded > todayKey
          ? lastRecorded
          : todayKey;

    const span =
      Math.round(
        (Date.parse(`${lastKey}T00:00:00`) - Date.parse(`${firstKey}T00:00:00`)) / 86_400_000,
      ) + 1;
    const days = Math.max(1, span);

    /* ① 기간 요약 */
    let totalMinor = 0;
    let totalBaseMinor = 0;
    const perDay = new Map<string, number>();
    for (const e of expenses) {
      totalMinor += valueOf(e);
      totalBaseMinor += e.baseAmount;
      const key = localDateKey(e.occurredAt);
      perDay.set(key, (perDay.get(key) ?? 0) + valueOf(e));
    }

    const budgetPercent =
      trip.budgetAmount && trip.budgetAmount > 0
        ? Math.round((totalBaseMinor / trip.budgetAmount) * 100)
        : null;
    const overBaseMinor =
      trip.budgetAmount != null && totalBaseMinor > trip.budgetAmount
        ? totalBaseMinor - trip.budgetAmount
        : null;

    /* ② 카테고리 분포 */
    const byCategory = new Map<string, { minor: number; baseMinor: number }>();
    for (const e of expenses) {
      const id = e.categoryId ?? 'other';
      const acc = byCategory.get(id) ?? { minor: 0, baseMinor: 0 };
      acc.minor += valueOf(e);
      acc.baseMinor += e.baseAmount;
      byCategory.set(id, acc);
    }
    const categorySlices: CategorySlice[] = [...byCategory.entries()]
      .sort((a, b) => b[1].baseMinor - a[1].baseMinor)
      .map(([id, acc], i) => {
        const category = categoryById.get(id);
        return {
          id,
          icon: category?.icon ?? '💸',
          label: category ? categoryLabel(category) : '기타',
          color: palette[i % palette.length],
          minor: acc.minor,
          baseMinor: acc.baseMinor,
          percent: totalBaseMinor > 0 ? Math.round((acc.baseMinor / totalBaseMinor) * 100) : 0,
        };
      });

    /* ③ 일별 추이 */
    const trendFrom = span > MAX_TREND_DAYS ? addDays(lastKey, -(MAX_TREND_DAYS - 1)) : firstKey;
    const trendLength = Math.min(span, MAX_TREND_DAYS);
    const values: { key: string; value: number }[] = Array.from(
      { length: trendLength },
      (_, i) => {
        const key = addDays(trendFrom, i);
        return { key, value: perDay.get(key) ?? 0 };
      },
    );
    const avg = values.length > 0 ? values.reduce((s, v) => s + v.value, 0) / values.length : 0;
    const daily: DailyPoint[] = values.map(({ key, value }) => ({
      key,
      label: `${new Date(`${key}T00:00:00`).getDate()}`,
      value,
      avg,
      isToday: key === todayKey,
    }));

    /* ④ 개인 소비 기준선 — 표본이 부족한 카테고리는 줄 자체를 만들지 않는다 */
    const samples = new Map<string, Expense[]>();
    for (const e of expenses) {
      if (!e.categoryId) continue;
      const list = samples.get(e.categoryId);
      if (list) list.push(e);
      else samples.set(e.categoryId, [e]);
    }
    const baseline: BaselineRow[] = [...samples.entries()]
      .filter(([, list]) => list.length >= MIN_SAMPLES)
      .map(([id, list]) => {
        const category = categoryById.get(id);
        // 평균이 아니라 중앙값이다. 숙박 한 건이 식비 감각을 왜곡하지 않도록.
        const medianMinor = median(list.map(valueOf).sort((a, b) => a - b));
        const latest = list.reduce((a, b) => (a.occurredAt > b.occurredAt ? a : b));
        const latestMinor = valueOf(latest);
        return {
          id,
          icon: category?.icon ?? '💸',
          label: category ? categoryLabel(category) : '기타',
          medianMinor,
          latestMinor,
          trend:
            latestMinor > medianMinor * 1.1
              ? ('up' as const)
              : latestMinor < medianMinor * 0.9
                ? ('down' as const)
                : ('same' as const),
        };
      })
      .sort((a, b) => b.medianMinor - a.medianMinor);

    /* ⑤ 정산 · ⑥ 개인별 소비 — 참가자가 정확히 2명일 때만 존재한다 */
    let settlement: Settlement | null = null;
    let usage: Usage | null = null;
    const me = participants.find((p) => p.id === myParticipantId);
    const other = participants.find((p) => p.id !== myParticipantId);
    if (participants.length === 2 && me && other) {
      let sharedMinor = 0;
      let sharedBaseMinor = 0;
      let personalMinor = 0;
      const paid = new Map<string, number>();
      for (const e of expenses) {
        if (e.isPersonal) {
          personalMinor += valueOf(e);
          continue;
        }
        sharedMinor += valueOf(e);
        sharedBaseMinor += e.baseAmount;
        // 기록자가 곧 결제자다 (Master §11). "누가 냈는가"를 따로 묻지 않는다.
        paid.set(e.authorId, (paid.get(e.authorId) ?? 0) + valueOf(e));
      }
      const perPersonMinor = Math.round(sharedMinor / 2);
      const minePaid = paid.get(me.id) ?? 0;
      const diff = minePaid - perPersonMinor;
      settlement = {
        sharedMinor,
        sharedBaseMinor,
        personalMinor,
        perPersonMinor,
        me: { name: me.name, minor: minePaid },
        other: { name: other.name, minor: paid.get(other.id) ?? 0 },
        diffMinor: Math.abs(diff),
        diffBaseMinor:
          sharedMinor > 0 ? Math.round((Math.abs(diff) / sharedMinor) * sharedBaseMinor) : 0,
        direction: diff === 0 ? 'even' : diff > 0 ? 'other-to-me' : 'me-to-other',
      };

      /* ⑥ 누가 얼마나 썼는가 — "누가 냈는가"(정산)와 다른 질문이다.
         usedBy가 비어 있으면 공용으로 본다. 단, 개인 지출 플래그는 기록자 본인 몫이다
         (그 체크박스의 뜻이 "나만 쓴 돈"이므로 usedBy를 따로 고르지 않아도 성립한다). */
      const own = new Map<string, number>();
      let sharedPoolMinor = 0;
      for (const e of expenses) {
        const user = e.usedBy ?? (e.isPersonal ? e.authorId : null);
        if (!user) {
          sharedPoolMinor += valueOf(e);
          continue;
        }
        own.set(user, (own.get(user) ?? 0) + valueOf(e));
      }
      const half = Math.round(sharedPoolMinor / 2);
      const rows: UsageRow[] = [me, other].map((p) => {
        const ownMinor = own.get(p.id) ?? 0;
        return {
          id: p.id,
          name: p.name,
          isMe: p.id === me.id,
          ownMinor,
          sharedShareMinor: half,
          totalMinor: ownMinor + half,
        };
      });
      usage = {
        rows,
        sharedPoolMinor,
        maxMinor: Math.max(1, ...rows.map((r) => r.totalMinor)),
      };
    }

    return {
      rangeLabel: `${MD(firstKey)} – ${MD(lastKey)}`,
      days,
      currency,
      baseCurrency: trip.baseCurrency,
      dualCurrency: currency !== trip.baseCurrency,
      totalMinor,
      totalBaseMinor,
      budgetPercent,
      overBaseMinor,
      dailyAvgBaseMinor: Math.round(totalBaseMinor / days),
      categories: categorySlices,
      daily,
      baseline,
      settlement,
      usage,
    };
  }, [expenses, trip, categoryById, participants, myParticipantId, palette]);
}
