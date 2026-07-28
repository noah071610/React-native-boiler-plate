import type { SyncBundle } from '@/lib/sync';

/**
 * 동기화 우편함 클라이언트.
 *
 * 서버는 기록의 원본이 아니라 우편함일 뿐이다 (layout-sync §서버의 역할).
 * 한쪽이 자기 묶음을 올려두면 다른 쪽이 코드로 내려받고, 합치기는 각자의 기기에서 한다.
 * 그래서 이 파일에는 병합 로직이 하나도 없다 — 올리고 내려받는 것이 전부다.
 *
 * ponytail: hono client(api)를 쓰지 않고 fetch를 직접 쓴다. 이 기능에는 인증(Bearer)이
 * 존재하지 않아서(코드가 곧 인증) client.ts의 토큰 회전 fetch가 할 일이 없다.
 */

/** 백엔드는 앱별로 경로가 갈린다 (`/api/<appId>/...`). */
const baseUrl = `${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/tabica`;

/** v1은 여행당 2명. 세 번째 참가는 서버가 409로 거절한다. */
export const MAX_PARTICIPANTS = 2;

export type SyncErrorKind = 'offline' | 'not-found' | 'full' | 'server';

/** 실패 이유를 유저 문구로 바로 옮길 수 있게 종류를 나눠 던진다 (layout-sync §실패 처리). */
export class SyncError extends Error {
  readonly kind: SyncErrorKind;

  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
  }
}

export const syncErrorMessage = (error: unknown): string =>
  error instanceof SyncError ? error.message : '동기화하지 못했어요. 잠시 뒤 다시 해보세요.';

/** 참가자 명함. 이름은 상대 화면에 그대로 보인다. */
export type RoomParticipant = { id: string; name: string };

/**
 * 우편함 하나 = 여행 하나. 코드 발급 시점에는 여기 담긴 것 외에 아무 데이터도 오가지 않는다.
 * tripId를 공유하는 것이 핵심이다 — 두 기기의 지출이 같은 여행에 속해야 합계와 정산이 성립한다.
 */
export type SyncRoom = {
  code: string;
  tripId: string;
  destinationCurrency: string;
  destinationCountryCode?: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  /** 참가하는 쪽이 그대로 따라갈 여행 메타 — 동기화 전에도 같은 화면이 되어야 한다 */
  name: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  participants: RoomParticipant[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    // fetch가 던지는 것은 사실상 네트워크 실패뿐이다 (오프라인 / DNS / 타임아웃)
    throw new SyncError('offline', '인터넷에 연결되어 있지 않아요');
  }

  if (res.status === 404)
    throw new SyncError('not-found', '식별되지 않은 코드에요. 다시 확인해주세요.');
  if (res.status === 409) throw new SyncError('full', '이미 등록된 코드에요.');
  if (!res.ok) throw new SyncError('server', '서버가 응답하지 않아요. 잠시 뒤 다시 해보세요.');

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** 초대 코드 발급. 지출은 오가지 않고, 상대가 여행을 알아볼 만큼의 메타만 올라간다. */
export function createRoom(input: {
  tripId: string;
  destinationCurrency: string;
  destinationCountryCode: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  name: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  participant: RoomParticipant;
}): Promise<SyncRoom> {
  return request<SyncRoom>('/sync/rooms', { method: 'POST', body: JSON.stringify(input) });
}

/** 코드 확인. 참가 전에 목적지 통화와 기간을 먼저 보여주기 위해 쓴다. */
export function getRoom(code: string): Promise<SyncRoom> {
  return request<SyncRoom>(`/sync/rooms/${encodeURIComponent(code)}`);
}

export function joinRoom(code: string, participant: RoomParticipant): Promise<SyncRoom> {
  return request<SyncRoom>(`/sync/rooms/${encodeURIComponent(code)}/participants`, {
    method: 'POST',
    body: JSON.stringify(participant),
  });
}

/** 내 묶음을 올린다. 같은 참가자가 다시 올리면 덮어쓴다 (우편함에는 최신 묶음 하나면 된다). */
export function putBundle(code: string, bundle: SyncBundle): Promise<void> {
  return request<void>(`/sync/rooms/${encodeURIComponent(code)}/bundles`, {
    method: 'PUT',
    body: JSON.stringify(bundle),
  });
}

/** 상대의 묶음만 내려받는다. 아직 아무도 올리지 않았으면 빈 배열이다. */
export function fetchBundles(code: string, exclude: string): Promise<SyncBundle[]> {
  return request<SyncBundle[]>(
    `/sync/rooms/${encodeURIComponent(code)}/bundles?exclude=${encodeURIComponent(exclude)}`,
  );
}

/**
 * 방을 통째로 없앤다 (코드 재발급 시 옛 코드를 무효화하는 용도).
 * 실패해도 치명적이지 않다 — 방에는 TTL이 걸려 있어 결국 사라진다.
 */
export function deleteRoom(code: string): Promise<void> {
  return request<void>(`/sync/rooms/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

/** 참가자 목록에서 상대를 제거한다. 이미 합쳐진 기록은 각자 기기에 그대로 남는다. */
export function removeParticipant(code: string, participantId: string): Promise<void> {
  return request<void>(
    `/sync/rooms/${encodeURIComponent(code)}/participants/${encodeURIComponent(participantId)}`,
    { method: 'DELETE' },
  );
}
