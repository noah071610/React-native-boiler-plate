import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

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

export async function clearLocalData(): Promise<void> {
  storage.clearAll();
  await clearTokens();
}
