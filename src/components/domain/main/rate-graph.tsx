import { and, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { db } from '@/db';
import { rateHistory } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const PERIODS = [
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: '1y', label: '1년', days: 365 },
] as const;

const CHART_HEIGHT = 120;

type Props = {
  localCurrency: string;
  baseCurrency: string;
  /** 여행 전에는 기본 펼침 (환전 타이밍을 재는 시기) */
  defaultExpanded?: boolean;
};

/**
 * §⑥ 환율 그래프 — 여행 중에는 기본 접힘.
 * rate_history(로컬 캐시)만 읽는다. 비어 있으면 그래프 대신 빈 상태를 보여준다.
 * 부정확한 숫자보다 없는 숫자가 낫다 (원칙 4).
 */
export function RateGraph({ localCurrency, baseCurrency, defaultExpanded = false }: Props) {
  const { scheme } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('1m');

  const days = PERIODS.find((p) => p.key === period)?.days ?? 30;
  const { data } = useLiveQuery(
    db
      .select()
      .from(rateHistory)
      .where(and(eq(rateHistory.base, baseCurrency), eq(rateHistory.quote, localCurrency)))
      .orderBy(desc(rateHistory.date))
      .limit(days),
  );

  const series = (data ?? []).slice().reverse();
  const rates = series.map((r) => r.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const span = max - min || 1;
  const points = rates
    .map((r, i) => {
      const x = rates.length > 1 ? (i / (rates.length - 1)) * 100 : 50;
      const y = CHART_HEIGHT - ((r - min) / span) * CHART_HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View
      style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
      className="rounded-3xl border px-5 py-4"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          haptics.selection();
          setExpanded((v) => !v);
        }}
        className="flex-row items-center justify-between active:opacity-60"
      >
        <Text className="text-sm font-bold text-neutral-500 dark:text-neutral-400">환율 추이</Text>
        {expanded ? (
          <ChevronUp size={18} color={scheme.mutedForeground} />
        ) : (
          <ChevronDown size={18} color={scheme.mutedForeground} />
        )}
      </Pressable>

      {expanded ? (
        <View className="mt-4">
          <View className="flex-row gap-2">
            {PERIODS.map((p) => {
              const active = p.key === period;
              return (
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPeriod(p.key)}
                  style={{ backgroundColor: active ? scheme.primary : scheme.muted }}
                  className="rounded-full px-3 py-1.5 active:opacity-70"
                >
                  <Text
                    style={{ color: active ? scheme.primaryForeground : scheme.mutedForeground }}
                    className="text-xs font-bold"
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {rates.length >= 2 ? (
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 100 ${CHART_HEIGHT}`}
              style={{ marginTop: 16 }}
            >
              <Polyline
                points={points}
                fill="none"
                stroke={scheme.primary}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </Svg>
          ) : (
            /* ponytail: 환율 수신 기능이 붙으면 이 빈 상태는 자동으로 사라진다.
               "최근 3개월 평균보다 낮은 편" 같은 한 줄도 그때 history 위에서 계산한다. */
            <Text className="mt-6 text-center text-sm font-semibold text-neutral-400">
              환율 기록을 아직 받지 못했어요
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
