import { useFont } from '@shopify/react-native-skia';
import { and, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

import { db } from '@/db';
import { rateHistory } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';

const PERIODS = [
  { key: '1m', labelKey: 'main.period1m', fallback: '1개월', days: 30 },
  { key: '3m', labelKey: 'main.period3m', fallback: '3개월', days: 90 },
  { key: '1y', labelKey: 'main.period1y', fallback: '1년', days: 365 },
] as const;

const CHART_HEIGHT = 180;

/** 환율은 통화쌍마다 자릿수가 완전히 다르다 (1 THB = 43원, 1 KRW = 0.0027 THB). */
const decimals = (v: number) => (v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : 4);

const formatRate = (v: number) => v.toFixed(decimals(v));

/**
 * date 문자열('YYYY-MM-DD')을 UTC 자정 epoch으로 읽었으므로 라벨도 UTC로 되돌린다.
 * 로컬 getter를 쓰면 KST에서 하루 밀려 "7월 1일"이 "6월 30일"로 보인다.
 */
const formatTick = (t: number, showYear: boolean) => {
  const d = new Date(t);
  const month = d.getUTCMonth() + 1;
  return showYear
    ? `${String(d.getUTCFullYear()).slice(2)}.${month}`
    : `${month}/${d.getUTCDate()}`;
};

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
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('1m');

  // Skia는 축 라벨을 그릴 폰트를 직접 받아야 한다 (RN 텍스트 스타일을 상속하지 않는다).
  const font = useFont(require('../../../../assets/fonts/Pretendard-Regular.otf'), 10);

  const days = PERIODS.find((p) => p.key === period)?.days ?? 30;
  const { data } = useLiveQuery(
    db
      .select({ date: rateHistory.date, rate: rateHistory.rate })
      .from(rateHistory)
      .where(and(eq(rateHistory.base, baseCurrency), eq(rateHistory.quote, localCurrency)))
      .orderBy(desc(rateHistory.date))
      .limit(days),
    // deps가 없으면 기간 버튼을 눌러도 limit이 30에 묶인 첫 쿼리가 그대로 산다
    [baseCurrency, localCurrency, days],
  );

  // 쿼리는 최신순(그래야 limit이 최근 N일이다), 그래프는 과거→현재라 뒤집는다.
  const series = (data ?? [])
    .slice()
    .reverse()
    .map((r) => ({ t: Date.parse(`${r.date}T00:00:00Z`), rate: r.rate }));

  const first = series[0]?.rate;
  const last = series[series.length - 1]?.rate;
  // 기간 등락률 — 그래프의 기울기를 숫자로 한 번 더 말해준다
  const changePercent = first && last ? ((last - first) / first) * 100 : null;
  const rising = (changePercent ?? 0) > 0;

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
        <Text className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
          {t('main.rateTrend', '환율 추이')}
        </Text>
        {expanded ? (
          <ChevronUp size={18} color={scheme.mutedForeground} />
        ) : (
          <ChevronDown size={18} color={scheme.mutedForeground} />
        )}
      </Pressable>

      {expanded ? (
        <View className="mt-4">
          {last != null ? (
            <View className="mb-3 flex-row items-baseline gap-2">
              <Text className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
                {formatRate(last)}
              </Text>
              <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {baseCurrency} / 1 {localCurrency}
              </Text>
              {changePercent != null ? (
                <Text
                  className="ml-auto text-sm font-bold"
                  style={{ color: rising ? '#EF4444' : '#2563EB' }}
                >
                  {rising ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                </Text>
              ) : null}
            </View>
          ) : null}

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
                    {t(p.labelKey, p.fallback)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {series.length >= 2 ? (
            <View style={{ height: CHART_HEIGHT, marginTop: 16 }}>
              <CartesianChart
                data={series}
                xKey="t"
                yKeys={['rate']}
                domainPadding={{ top: 16, bottom: 16 }}
                padding={{ right: 4 }}
                xAxis={{
                  font,
                  tickCount: 4,
                  lineColor: scheme.border,
                  lineWidth: 1,
                  labelColor: scheme.mutedForeground,
                  formatXLabel: (t) => formatTick(t, days > 90),
                }}
                yAxis={[
                  {
                    font,
                    tickCount: 4,
                    lineColor: scheme.border,
                    lineWidth: 1,
                    labelColor: scheme.mutedForeground,
                    formatYLabel: formatRate,
                  },
                ]}
                frame={{ lineWidth: 0 }}
              >
                {/* ponytail: 터치 툴팁은 없다. 필요해지면 useChartPressState로 붙는다 — 설치는 이미 돼 있다. */}
                {({ points }) => (
                  <Line
                    points={points.rate}
                    color={scheme.primary}
                    strokeWidth={2}
                    curveType="linear"
                  />
                )}
              </CartesianChart>
            </View>
          ) : (
            <Text className="mt-6 text-center text-sm font-semibold text-neutral-400">
              {t('main.noRateHistory', '환율 기록을 아직 받지 못했어요')}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
