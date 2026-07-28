import type { Expense } from '@/db/schema';

/**
 * 동기화의 판단 규칙만 모은 곳. DB도 네트워크도 건드리지 않는다.
 * 여기가 틀리면 남의 기록을 덮어쓰거나 삭제가 되살아나므로, 이 파일만은 따로 돌려볼 수 있게 둔다
 * (`node src/lib/sync-rules.check.ts`).
 */

/** 기록 시각이 이 안이면 같은 결제일 수 있다고 본다 (layout-sync §감지 기준). */
export const DUPLICATE_WINDOW_MS = 15 * 60_000;

export type Syncable = { updatedAt: number; deletedAt: number | null };

/**
 * 들어온 행이 로컬 행을 이기는가.
 * deletedAt이 있는 쪽이 먼저 이기고(삭제는 되살아나지 않는다), 그다음이 updatedAt LWW다.
 */
export function incomingWins(local: Syncable, incoming: Syncable): boolean {
  if (local.deletedAt && !incoming.deletedAt) return false;
  if (!local.deletedAt && incoming.deletedAt) return true;
  return incoming.updatedAt > local.updatedAt;
}

/** 같은 결제를 둘이 각각 기록한 것으로 보이는가. 다섯 조건을 모두 만족해야 한다. */
export function looksDuplicate(a: Expense, b: Expense): boolean {
  return (
    a.tripId === b.tripId &&
    a.authorId !== b.authorId &&
    a.amount === b.amount &&
    a.currency === b.currency &&
    a.categoryId === b.categoryId &&
    Math.abs(a.occurredAt - b.occurredAt) <= DUPLICATE_WINDOW_MS
  );
}
