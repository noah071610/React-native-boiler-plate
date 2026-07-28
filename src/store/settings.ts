import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';
/** 한 / 영 / 일 — 타겟이 국제 커플과 장기 체류자라 언어가 곧 시장이다 (Master §7). */
export type LanguagePreference = 'system' | 'ko' | 'en' | 'ja';

/** Min/max multiplier applied on top of the OS accessibility font scale. */
export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.3;

type SettingsState = {
  theme: ThemePreference;
  fontScale: number;
  language: LanguagePreference;
  haptics: boolean;
  setTheme: (theme: ThemePreference) => void;
  setFontScale: (fontScale: number) => void;
  setLanguage: (language: LanguagePreference) => void;
  setHaptics: (haptics: boolean) => void;
};

const clampScale = (n: number) => Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n));

/** Single app-wide settings store, MMKV-persisted. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      fontScale: 1.0,
      language: 'system',
      haptics: true,
      setTheme: (theme) => set({ theme }),
      setFontScale: (fontScale) => set({ fontScale: clampScale(fontScale) }),
      setLanguage: (language) => set({ language }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
