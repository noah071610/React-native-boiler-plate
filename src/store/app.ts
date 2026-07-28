import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PaymentMethod } from '@/db/schema';
import { mmkvStorage } from '@/lib/storage';

/**
 * 기기 로컬 UI 상태. 여행이 끝나면 버려도 되는 값만 여기 둔다.
 * 여행 / 지출 / 예산 같은 진실의 원본은 SQLite다 (Frontend.md 로컬 저장소 선택).
 */

export type RecentCalc = {
  id: string;
  /** 최소단위 정수 */
  amount: number;
  currency: string;
  baseAmount: number;
  baseCurrency: string;
  rate: number;
  rateDate: string;
  at: number;
};

/** 칩은 한 줄에 보이는 만큼만 남긴다. 그 이상은 타임라인이 할 일이다. */
const RECENT_LIMIT = 3;

type AppState = {
  onboarded: boolean;
  /**
   * 유저 본인의 통화 (기기 지역에서 추론, 설정에서 변경 가능).
   * 지출은 항상 이 통화로 환산해 저장되므로 이것이 "기준 통화"다.
   */
  homeCurrency: string | null;
  /**
   * 환율 페어의 현지 쪽 기본값 — 온보딩에서 고른 나라.
   * 여행이 없거나 여행 기간이 아닐 때만 쓴다 (여행 중이면 여행지 통화가 이긴다).
   * 화면에서 다른 통화로 바꿔 계산할 수 있지만 그 선택은 저장되지 않는다.
   */
  defaultLocalCurrency: string | null;
  /** true면 통화 페어가 뒤집힌 상태 (위가 기준 통화) */
  pairSwapped: boolean;
  recentCalcs: RecentCalc[];
  /** 빠른 기록의 결제수단 기본값. 여행 중엔 같은 수단이 연속되므로 적중률이 높다. */
  lastPaymentMethod: PaymentMethod;
  /** 마지막 동기화 시각. null이면 상대 기록을 아직 한 번도 받지 못한 것이다. */
  lastSyncAt: number | null;
  /**
   * 우편함에 올려둔 내 묶음이 반영한 로컬 변경 시각 (= 그때의 max(updatedAt)).
   * 로컬이 이보다 새로우면 우편함이 오래된 것이다 (use-bundle-upload).
   */
  uploadedVersion: number | null;

  /** 온보딩에서 고른 나라의 통화. 기준 통화는 기기 지역에서 따로 추론한다. */
  completeOnboarding: (defaultLocalCurrency: string, homeCurrency: string) => void;
  setHomeCurrency: (currency: string) => void;
  /** 처음부터 다시 — 나라 선택 화면으로 되돌린다. */
  resetToOnboarding: () => void;
  toggleSwap: () => void;
  setLastPaymentMethod: (method: PaymentMethod) => void;
  markSynced: () => void;
  markUploaded: (version: number) => void;
  addRecentCalc: (calc: Omit<RecentCalc, 'id' | 'at'>) => void;
  clearRecentCalcs: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      homeCurrency: null,
      defaultLocalCurrency: null,
      pairSwapped: false,
      recentCalcs: [],
      lastPaymentMethod: 'card',
      lastSyncAt: null,
      uploadedVersion: null,

      completeOnboarding: (defaultLocalCurrency, homeCurrency) =>
        set({ onboarded: true, defaultLocalCurrency, homeCurrency }),

      setHomeCurrency: (currency) => set({ homeCurrency: currency }),

      resetToOnboarding: () =>
        set({
          onboarded: false,
          homeCurrency: null,
          defaultLocalCurrency: null,
          recentCalcs: [],
          pairSwapped: false,
          lastPaymentMethod: 'card',
          lastSyncAt: null,
          uploadedVersion: null,
        }),

      markSynced: () => set({ lastSyncAt: Date.now() }),

      markUploaded: (version) => set({ uploadedVersion: version }),

      toggleSwap: () => set((s) => ({ pairSwapped: !s.pairSwapped })),

      setLastPaymentMethod: (method) => set({ lastPaymentMethod: method }),

      addRecentCalc: (calc) =>
        set((s) => ({
          recentCalcs: [
            { ...calc, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now() },
            ...s.recentCalcs,
          ].slice(0, RECENT_LIMIT),
        })),

      clearRecentCalcs: () => set({ recentCalcs: [] }),
    }),
    {
      name: 'app',
      // v1: activeTripId / myParticipantId를 버리고 homeCurrency + defaultLocalCurrency로 바꿨다.
      // 활성 여행은 이제 오늘 날짜가 고르고(lib/trip-dates), 내 참가자는 DB의 isMe가 답한다.
      // 옛 저장값에는 두 통화가 없으므로 온보딩을 한 번 다시 받는다.
      version: 1,
      migrate: (state) => ({
        ...(state as AppState),
        onboarded: false,
        homeCurrency: null,
        defaultLocalCurrency: null,
      }),
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
