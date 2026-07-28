import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useActiveTrip } from '@/hooks/use-active-trip';
import { dropShareCode, localVersion, uploadMyBundle } from '@/lib/sync';
import { SyncError } from '@/services/api/sync';
import { useAppStore } from '@/store/app';

/**
 * 우편함 최신화 — 초대 코드가 살아 있는 동안, 내 묶음이 오래되면 조용히 다시 올린다.
 *
 * 왜 필요한가: 코드를 만든 뒤 상대가 참가하기까지 며칠이 걸릴 수 있다. 그 사이 기록한 것이
 * 우편함에 없으면 상대는 오래된 스냅샷을 최신인 줄 알고 본다 (Master 원칙 4).
 *
 * 이것은 "자동 동기화"가 아니다. **올리기만** 한다 — 내려받지도 합치지도 않으므로
 * 화면의 숫자가 유저 몰래 바뀌는 일이 없다. 합치기는 여전히 동기화 버튼만 한다.
 *
 * 도는 조건이 좁다. 셋 중 하나라도 아니면 네트워크를 건드리지 않는다:
 *   1) 이 여행에 shareCode가 있다 (혼자 쓰는 여행은 평생 요청 0건)
 *   2) 마지막 업로드 이후 로컬이 실제로 바뀌었다
 *   3) 마지막 시도로부터 COOLDOWN_MS가 지났다
 *
 * 정지 조건: 서버가 404(방 만료·삭제)를 주면 로컬 shareCode를 지운다 → 1)이 깨져 영구 중단.
 */

/** 실패가 반복될 때 앱을 열 때마다 때리지 않게 하는 최소 간격 */
const COOLDOWN_MS = 60_000;

export function useBundleAutoUpload(): void {
  const { trip, myParticipantId } = useActiveTrip();
  const uploadedVersion = useAppStore((s) => s.uploadedVersion);

  const shareCode = trip?.shareCode ?? null;
  const tripId = trip?.id ?? null;

  /** 마지막 "시도" 시각. 성공/실패를 가리지 않는다 — 실패 재시도도 이 간격을 지킨다 */
  const attemptedAt = useRef(0);

  const run = useCallback(async () => {
    if (!shareCode || !tripId || !myParticipantId) return;
    if (Date.now() - attemptedAt.current < COOLDOWN_MS) return;

    // 올릴 것이 없으면 요청 자체를 만들지 않는다. 여행 중 하루 몇 건 수준으로 떨어진다.
    const version = await localVersion();
    if (uploadedVersion != null && version <= uploadedVersion) return;

    attemptedAt.current = Date.now();
    try {
      await uploadMyBundle(shareCode, tripId, myParticipantId);
    } catch (error) {
      // 방이 사라졌다 — 이 코드로는 다시 시도할 이유가 없다
      if (error instanceof SyncError && error.kind === 'not-found') {
        await dropShareCode(tripId);
        return;
      }
      // 오프라인이 기본값이다 (Master 원칙 1). 조용히 넘기고 다음 기회에 다시 올린다.
    }
  }, [shareCode, tripId, myParticipantId, uploadedVersion]);

  // 마운트 · 여행/코드 변경 · 앱이 다시 앞으로 나올 때
  useEffect(() => {
    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => subscription.remove();
  }, [run]);
}
