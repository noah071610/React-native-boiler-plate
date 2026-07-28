import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { sqlite } from '@/db';
import { clearTokens } from '@/lib/secure';

/** Single app-wide MMKV instance. Non-sensitive data only — tokens go in secure.ts. */
export const storage = createMMKV();

/** zustand `persist` storage adapter backed by MMKV. */
export const mmkvStorage: StateStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => {
    storage.remove(key);
  },
};

/** 앱 최초 실행 시각을 한 번 기록하고, 그 이후 지난 일수(1일째부터)를 반환한다. */
export function daysSinceInstall(): number {
  let installedAt = storage.getNumber('installedAt');
  if (!installedAt) {
    installedAt = Date.now();
    storage.set('installedAt', installedAt);
  }
  return Math.floor((Date.now() - installedAt) / 86_400_000) + 1;
}

/**
 * 초기화 — SQLite의 모든 행 + MMKV + 키체인 토큰을 지운다.
 *
 * 테이블을 DROP하지 않고 비우기만 한다. DROP하면 마이그레이션이 앱 시작 때만
 * 돌기 때문에(_layout의 useMigrations) 재시작 전까지 테이블이 없는 상태가 된다.
 * 같은 이유로 `__drizzle_migrations`는 남긴다.
 */
export async function clearLocalData(): Promise<void> {
  const tables = sqlite.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
  );
  sqlite.execSync('PRAGMA foreign_keys = OFF;');
  for (const { name } of tables) sqlite.execSync(`DELETE FROM "${name}";`);
  sqlite.execSync('PRAGMA foreign_keys = ON;');

  storage.clearAll();
  await clearTokens();
}
