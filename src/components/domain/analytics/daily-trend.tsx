import { Text, View } from 'react-native';
import { Bar, CartesianChart, Line } from 'victory-native';

import { Section } from '@/components/domain/analytics/section';
import type { DailyPoint } from '@/hooks/use-analytics';
import { useTheme } from '@/hooks/use-theme';
import { currencyUnit, useI18n } from '@/i18n';

const CHART_HEIGHT = 180;
const INSET = 16;

type Props = {
  daily: DailyPoint[];
  currency: string;
};

/**
 * ③ 일별 추이 — 막대 + 평균선. 오늘 막대만 강조색.
 * 보기 전용이다 — 막대를 눌러도 다른 화면으로 나가지 않는다.
 * 예측선은 그리지 않는다 (layout-analytics 만들지 않는 것: 예측은 판단이다).
 */
export function DailyTrend({ daily, currency }: Props) {
  const { scheme } = useTheme();
  const { t } = useI18n();

  const data = daily.map((d, i) => ({ x: i, value: d.value, avg: d.avg }));
  const todayIndex = daily.findIndex((d) => d.isToday);
  const unit = currencyUnit(currency, t);
  // 라벨이 촘촘해지면 건너뛴다 (막대는 그대로 다 그린다)
  const labelStep = Math.ceil(daily.length / 10);

  return (
    <Section title={t('analytics.dailySpendingTitle', '일별 지출')}>
      <Text className="mb-1 text-[11px] font-bold" style={{ color: scheme.mutedForeground }}>
        {t('analytics.dailyTrendCaption', '{{unit}} · 점선 없는 가로선이 평균', { unit })}
      </Text>

      <View style={{ height: CHART_HEIGHT }}>
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['value', 'avg']}
          domainPadding={{ left: INSET, right: INSET, top: 20 }}
        >
          {({ points, chartBounds }) => (
            <>
              <Bar
                points={points.value}
                chartBounds={chartBounds}
                color={scheme.chart2}
                roundedCorners={{ topLeft: 6, topRight: 6 }}
                barCount={data.length}
              />
              {todayIndex >= 0 ? (
                <Bar
                  points={[points.value[todayIndex]]}
                  chartBounds={chartBounds}
                  color={scheme.primary}
                  roundedCorners={{ topLeft: 6, topRight: 6 }}
                  barCount={data.length}
                />
              ) : null}
              <Line points={points.avg} color={scheme.mutedForeground} strokeWidth={1} />
            </>
          )}
        </CartesianChart>
      </View>

      <View className="flex-row" style={{ paddingHorizontal: INSET }}>
        {daily.map((d, i) => (
          <View key={d.key} className="flex-1 items-center">
            <Text
              className="text-[10px] font-bold"
              style={{ color: d.isToday ? scheme.primary : scheme.mutedForeground }}
            >
              {i % labelStep === 0 || d.isToday ? d.label : ''}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}
