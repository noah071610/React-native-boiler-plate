import { useQuery } from '@tanstack/react-query';

import { storage } from '@/lib/storage';

/**
 * 현지 날씨 — 백엔드 tRPC(`tabica.weather.current`)를 통해 WeatherAPI.com에서 온다.
 * API 키는 서버에만 있다 (클라이언트 번들에 키를 넣지 않는다).
 *
 * ponytail: @trpc/client을 넣지 않고 tRPC의 GET 쿼리 URL을 fetch로 직접 때린다.
 * 프로시저 하나에 의존성 두 개를 추가할 이유가 없다. 클라이언트가 여러 개 필요해지면
 * 그때 `services/api/`에 tRPC 클라이언트를 세운다.
 */

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export type CurrentWeather = {
  place: string;
  country: string;
  /** 'YYYY-MM-DD HH:mm' — 현지 시각 */
  localTime: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  isDay: boolean;
  /** 한국어 상태 텍스트 ("흐림") */
  condition: string;
  iconUrl: string;
  conditionCode: number;
};

/**
 * 통화 → 조회할 도시. 여행지 좌표를 아직 저장하지 않아 통화가 유일한 단서다.
 * ponytail: trips에 좌표(lat/lon)가 생기면 이 맵 대신 `q = "lat,lon"`을 넘긴다 —
 * 서버 입력이 이미 두 형태를 같은 칸으로 받으므로 이 파일만 고치면 된다.
 */
const CITY_OF_CURRENCY: Record<string, string> = {
  KRW: 'Seoul',
  JPY: 'Tokyo',
  THB: 'Bangkok',
  VND: 'Hanoi',
  TWD: 'Taipei',
  PHP: 'Manila',
  SGD: 'Singapore',
  MYR: 'Kuala Lumpur',
  IDR: 'Jakarta',
  HKD: 'Hong Kong',
  CNY: 'Beijing',
  KHR: 'Phnom Penh',
  LAK: 'Vientiane',
  INR: 'New Delhi',
  NPR: 'Kathmandu',
  MNT: 'Ulaanbaatar',
  USD: 'New York',
  EUR: 'Paris', // 유로존은 나라가 20개다 — 좌표가 붙으면 사라질 근사치
  GBP: 'London',
  CHF: 'Zurich',
  TRY: 'Istanbul',
  AUD: 'Sydney',
  NZD: 'Auckland',
  CAD: 'Toronto',
  MXN: 'Mexico City',
  BRL: 'Sao Paulo',
  AED: 'Dubai',
  EGP: 'Cairo',
  ZAR: 'Cape Town',
  RUB: 'Moscow',
};

async function trpcQuery<T>(procedure: string, input: unknown): Promise<T> {
  const url = `${baseUrl}/api/tabica/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetch(url);
  const body = (await res.json()) as { result?: { data: T }; error?: { message?: string } };
  if (!res.ok || !body.result) throw new Error(body.error?.message ?? 'weather_failed');
  return body.result.data;
}

/** 신선도 한 시간. 그 안에 다시 열면 API를 때리지 않는다. */
const TTL = 60 * 60_000;

type Cached = { data: CurrentWeather; at: number };

/**
 * MMKV 캐시 — react-query 캐시는 앱을 끄면 사라지므로 재접속 때마다 요청이 나간다.
 * 도시별로 한 칸씩 저장하고 타임스탬프로 신선도를 판단한다.
 */
function readCache(q: string): Cached | null {
  const raw = storage.getString(`weather:${q}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cached;
  } catch {
    return null; // 포맷이 바뀌었으면 그냥 다시 받는다
  }
}

/**
 * 여행지 현재 날씨. 값이 없으면 카드가 스스로 자리만 지킨다 (없는 숫자가 틀린 숫자보다 낫다).
 *
 * ponytail: 저장소를 따로 추상화하지 않고 MMKV를 직접 읽고 쓴다.
 * initialDataUpdatedAt에 저장 시각을 넘기면 신선도 판정은 react-query가 한다 —
 * 1시간이 안 지났으면 캐시를 그대로 쓰고, 지났으면 알아서 재요청한다.
 */
export function useCurrentWeather(localCurrency: string) {
  const q = CITY_OF_CURRENCY[localCurrency];
  const cached = q ? readCache(q) : null;

  return useQuery({
    queryKey: ['weather', 'current', q],
    enabled: Boolean(q) && Boolean(baseUrl),
    staleTime: TTL,
    retry: 1,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    queryFn: async () => {
      const data = await trpcQuery<CurrentWeather>('weather.current', { q });
      storage.set(`weather:${q}`, JSON.stringify({ data, at: Date.now() } satisfies Cached));
      return data;
    },
  });
}
