import { useMemo } from 'react';

import { categoryLabel } from '@/constants/categories';
import type { Category, Expense } from '@/db/schema';
import { localDateKey } from '@/hooks/use-active-trip';
import { formatAmount } from '@/lib/money';

export type TimelineDay = {
  /** 'YYYY-MM-DD' */
  key: string;
  /** '7월 26일 (일)' */
  label: string;
  isToday: boolean;
  /** 여행 N일차. 여행 기간 미설정이면 null */
  dayIndex: number | null;
  count: number;
  localMinor: number;
  baseMinor: number;
  /** 0~23 시각 → 그 시간대의 지출. 같은 칸에 여러 건이면 그 칸이 높아진다. */
  byHour: Map<number, Expense[]>;
};

/** 그날 하루의 총합. 필터와 무관하다. */
export type DayTotal = {
  count: number;
  localMinor: number;
  baseMinor: number;
};

export const EMPTY_DAY_TOTAL: DayTotal = { count: 0, localMinor: 0, baseMinor: 0 };

/**
 * 날짜별 총합 — 카테고리 필터와 검색어를 타지 않는다.
 * "오늘 얼마 썼나"는 화면에 무엇을 걸어놨든 같은 숫자여야 하는 지표라
 * `TimelineDay.localMinor`(필터된 합계)와 따로 계산한다.
 */
export function useDayTotals(expenses: Expense[]): Map<string, DayTotal> {
  return useMemo(() => {
    const totals = new Map<string, DayTotal>();
    for (const e of expenses) {
      const key = localDateKey(e.occurredAt);
      const acc = totals.get(key) ?? { count: 0, localMinor: 0, baseMinor: 0 };
      acc.count += 1;
      acc.localMinor += e.amount;
      acc.baseMinor += e.baseAmount;
      totals.set(key, acc);
    }
    return totals;
  }, [expenses]);
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function labelOf(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

function dayIndexOf(key: string, startDate: string | null): number | null {
  if (!startDate || key < startDate) return null;
  const ms = Date.parse(`${key}T00:00:00`) - Date.parse(`${startDate}T00:00:00`);
  return Math.round(ms / 86_400_000) + 1;
}

/** 숫자만 남긴 문자열. "320.50" → "32050" */
const digitsOf = (s: string) => s.replace(/\D/g, '');

/**
 * 금액 검색은 근사 매칭이다 — 120을 검색하면 120밧도 1,200밧도 나오는 편이 낫다
 * (layout-timeline 검색). 그래서 포함 여부만 본다.
 */
function matches(e: Expense, text: string, digits: string, label: string): boolean {
  if (text && [e.memo, e.place, label].some((v) => v?.toLowerCase().includes(text))) return true;
  if (!digits) return false;
  return (
    digitsOf(formatAmount(e.amount, e.currency)).includes(digits) ||
    digitsOf(formatAmount(e.baseAmount, e.baseCurrency)).includes(digits)
  );
}

type Params = {
  expenses: Expense[];
  categories: Category[];
  categoryLabelOf?: (category: Category) => string;
  /** 여행 시작일 'YYYY-MM-DD'. N일차 표기에만 쓴다. */
  startDate: string | null;
  /** 선택된 카테고리 id. 비어 있으면 전체 */
  selectedCategoryIds: string[];
  query: string;
};

/**
 * 지출을 "날짜 → 시간대" 2단으로 묶는다. 날짜는 최신순 고정(정렬 변경 없음),
 * 하루 안에서는 0시→23시 오름차순이다 (캘린더 일별 보기와 같은 방향).
 *
 * 오늘은 기록이 없어도 항상 맨 앞에 둔다. 현재 시각 바가 설 자리가 필요하고,
 * "오늘 뭐 썼지?"에 "아직 없음"으로 답하는 것도 답이기 때문이다.
 */
export function useTimelineDays({
  expenses,
  categories,
  categoryLabelOf = categoryLabel,
  startDate,
  selectedCategoryIds,
  query,
}: Params): TimelineDay[] {
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, categoryLabelOf(c));
    return m;
  }, [categories, categoryLabelOf]);

  return useMemo(() => {
    const text = query.trim().toLowerCase();
    const digits = digitsOf(text);
    const picked = new Set(selectedCategoryIds);
    const todayKey = localDateKey(Date.now());

    const days = new Map<string, TimelineDay>();
    const dayOf = (key: string): TimelineDay => {
      const existing = days.get(key);
      if (existing) return existing;
      const day: TimelineDay = {
        key,
        label: labelOf(key),
        isToday: key === todayKey,
        dayIndex: dayIndexOf(key, startDate),
        count: 0,
        localMinor: 0,
        baseMinor: 0,
        byHour: new Map(),
      };
      days.set(key, day);
      return day;
    };

    dayOf(todayKey);

    for (const e of expenses) {
      if (picked.size > 0 && (!e.categoryId || !picked.has(e.categoryId))) continue;
      if (text && !matches(e, text, digits, labelById.get(e.categoryId ?? '') ?? '')) continue;

      const day = dayOf(localDateKey(e.occurredAt));
      day.count += 1;
      day.localMinor += e.amount;
      day.baseMinor += e.baseAmount;

      const hour = new Date(e.occurredAt).getHours();
      const slot = day.byHour.get(hour);
      if (slot) slot.push(e);
      else day.byHour.set(hour, [e]);
    }

    for (const day of days.values()) {
      for (const slot of day.byHour.values()) slot.sort((a, b) => a.occurredAt - b.occurredAt);
    }

    return [...days.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [expenses, labelById, selectedCategoryIds, query, startDate]);
}
