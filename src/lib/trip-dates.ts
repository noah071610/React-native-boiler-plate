import type { Trip } from '@/db/schema';

export type TripPhase = 'before' | 'during' | 'after' | 'none';

/** 기간이 확정된 여행. 신규 여행은 기간이 필수라 항상 이쪽이다. */
export type DatedTrip = Trip & { startDate: string; endDate: string };

export const isDated = (trip: Trip): trip is DatedTrip =>
  trip.startDate != null && trip.endDate != null;

/**
 * 기간이 하루라도 겹치는 여행. 없으면 null.
 * 겹침은 UI가 아니라 여기서 판단한다 — 메인/설정 두 곳에서 같은 규칙을 써야 한다.
 */
export function findOverlap(
  trips: Trip[],
  startDate: string,
  endDate: string,
  excludeId?: string,
): Trip | null {
  return (
    trips.find(
      (t) =>
        t.id !== excludeId &&
        t.deletedAt == null &&
        isDated(t) &&
        startDate <= t.endDate &&
        endDate >= t.startDate,
    ) ?? null
  );
}

/**
 * 오늘 기준 "지금 보여줄 여행".
 *
 *   진행 중 → 다가오는 것 중 가장 가까운 것 → 가장 최근에 끝난 것 → 없음
 *
 * 여행이 없으면 trip은 null이고 화면은 유저 본인 통화를 기준으로 그린다.
 * 기간이 없는 옛 여행은 위 어디에도 걸리지 않으므로 맨 마지막에만 쓴다.
 */
export function pickActiveTrip(
  trips: Trip[],
  todayKey: string,
): { trip: Trip | null; phase: TripPhase } {
  const alive = trips.filter((t) => t.deletedAt == null);
  const dated = alive.filter(isDated);

  const current = dated.find((t) => t.startDate <= todayKey && todayKey <= t.endDate);
  if (current) return { trip: current, phase: 'during' };

  const upcoming = dated
    .filter((t) => t.startDate > todayKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return { trip: upcoming, phase: 'before' };

  const past = dated
    .filter((t) => t.endDate < todayKey)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (past) return { trip: past, phase: 'after' };

  const undated = alive.find((t) => !isDated(t));
  return undated ? { trip: undated, phase: 'during' } : { trip: null, phase: 'none' };
}

/** 목록용 정렬 — 최근 여행이 위로 (기간 없는 것은 맨 아래) */
export function sortTripsByRecent(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
}
