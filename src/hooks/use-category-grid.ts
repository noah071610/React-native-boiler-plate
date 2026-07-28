import { asc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useRef } from 'react';

import { db } from '@/db';
import { categories, type Category, type Expense } from '@/db/schema';

/** 첫 행 4칸만 사용 빈도순으로 앞당기고, 나머지는 기본 순서를 그대로 둔다. */
function withFrequentFirst(rows: Category[], expenses: Expense[]): Category[] {
  const count = new Map<string, number>();
  for (const e of expenses) {
    if (e.categoryId) count.set(e.categoryId, (count.get(e.categoryId) ?? 0) + 1);
  }
  const used = rows
    .filter((c) => (count.get(c.id) ?? 0) > 0)
    .sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))
    .slice(0, 4);
  const top = new Set(used.map((c) => c.id));
  return [...used, ...rows.filter((c) => !top.has(c.id))];
}

/**
 * 빠른 기록 그리드용 카테고리 목록.
 *
 * **순서만** 앱 실행당 한 번 고정한다. 저장할 때마다 재정렬하면 칸 위치가 계속
 * 바뀌어 근육 기억이 생기지 않고, 결과적으로 "빠른 입력"이 더 느려진다.
 * 행 자체는 라이브다 — 관리 화면에서 이름/아이콘을 고치거나 추가·삭제한 것이
 * 앱을 껐다 켜지 않아도 바로 보여야 한다.
 */
export function useCategoryGrid(expenses: Expense[]): Category[] {
  const query = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.hiddenAt))
      .orderBy(asc(categories.sortOrder)),
  );
  // 시드는 루트 레이아웃에서 마이그레이션 직후 한 번 돈다 (여기서 돌면 여행이 있어야만 심긴다)
  const rows = query.data;

  /** 고정된 순서를 id로만 들고 있는다 (행 내용은 매번 최신 것을 쓴다) */
  const frozen = useRef<string[] | null>(null);

  return useMemo(() => {
    // '기타'는 그리드에 두지 않는다 — 그 자리는 카테고리 추가 버튼이 쓴다.
    // 행 자체는 남겨둬야 이미 '기타'로 기록한 지출의 이름/아이콘이 유지된다.
    const visible = (rows ?? []).filter((c) => c.key !== 'other');
    if (visible.length === 0) return [];

    if (!frozen.current) frozen.current = withFrequentFirst(visible, expenses).map((c) => c.id);

    const rank = new Map(frozen.current.map((id, i) => [id, i]));
    // 고정 순서에 없는 것(그 뒤에 새로 만든 카테고리)은 sortOrder 순서 그대로 맨 뒤에 붙는다
    return [...visible].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [rows, expenses]);
}
