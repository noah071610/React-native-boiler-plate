import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { db } from '@/db';
import { categories } from '@/db/schema';

/**
 * 기본 카테고리 시드. **id를 key와 같게 쓴다** — 여러 번 돌아도 중복되지 않고,
 * 기기가 달라도 같은 id가 나온다. 동기화가 성립하는 이유가 이것이다.
 *
 * 빠른 기록 그리드가 처음 열릴 때만 돌면 안 된다. 상대 묶음을 합칠 때 이 행들이
 * 없으면 들어온 지출의 categoryId가 참조할 곳이 없어 insert가 통째로 실패한다.
 */
export async function seedDefaultCategories(): Promise<void> {
  const now = Date.now();
  await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c, i) => ({
        id: c.key,
        key: c.key,
        icon: c.icon,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
}
