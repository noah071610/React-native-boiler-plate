import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Pie, PolarChart } from 'victory-native';

import { Section } from '@/components/domain/analytics/section';
import { useTheme } from '@/hooks/use-theme';
import type { CategorySlice } from '@/hooks/use-analytics';
import { formatMoneyI18n, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';

const TOP = 5;
const DONUT = 168;

type Props = {
  slices: CategorySlice[];
  currency: string;
  totalMinor: number;
  /** 줄을 탭하면 타임라인이 그 카테고리로 필터된 상태로 열린다 */
  onSelect: (categoryId: string) => void;
};

/**
 * ② 카테고리 분포.
 * 도넛은 비중을 한눈에 보여주는 장식이고, 순위와 금액을 읽는 곳은 아래 막대 목록이다
 * (layout-analytics ②: 도넛보다 가로 막대 목록을 우선한다).
 */
export function CategoryBreakdown({ slices, currency, totalMinor, onSelect }: Props) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const money = (minor: number) => formatMoneyI18n(minor, currency, t, resolvedLanguage);

  const visible = expanded ? slices : slices.slice(0, TOP);
  const pieData = slices.map((s) => ({ label: s.label, value: s.baseMinor, color: s.color }));

  return (
    <Section title={t('analytics.categoriesTitle', '카테고리')}>
      {pieData.length > 1 ? (
        <View className="mb-4 items-center">
          <View style={{ width: DONUT, height: DONUT }}>
            <PolarChart data={pieData} labelKey="label" valueKey="value" colorKey="color">
              <Pie.Chart innerRadius="66%" />
            </PolarChart>
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <Text className="text-[11px] font-bold" style={{ color: scheme.mutedForeground }}>
                {t('analytics.totalSpent', '총 지출')}
              </Text>
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {money(totalMinor)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className="gap-2.5">
        {visible.map((slice) => (
          <Pressable
            key={slice.id}
            accessibilityRole="button"
            accessibilityLabel={t('analytics.viewCategoryExpensesA11y', '{{category}} 지출 보기', {
              category: slice.label,
            })}
            onPress={() => {
              haptics.selection();
              onSelect(slice.id);
            }}
            className="active:opacity-60"
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-sm">{slice.icon}</Text>
              <Text className="flex-1 text-sm font-bold text-neutral-900 dark:text-neutral-50">
                {slice.label}
              </Text>
              <Text className="text-sm font-black text-neutral-900 dark:text-neutral-50">
                {money(slice.minor)}
              </Text>
              <Text
                className="w-10 text-right text-xs font-bold"
                style={{ color: scheme.mutedForeground }}
              >
                {slice.percent}%
              </Text>
            </View>
            <View
              style={{ backgroundColor: scheme.muted }}
              className="mt-1.5 h-2 overflow-hidden rounded-full"
            >
              <View
                style={{ backgroundColor: slice.color, width: `${Math.max(2, slice.percent)}%` }}
                className="h-full rounded-full"
              />
            </View>
          </Pressable>
        ))}
      </View>

      {slices.length > TOP ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((v) => !v)}
          className="mt-3 items-center active:opacity-60"
        >
          <Text className="text-xs font-bold" style={{ color: scheme.primary }}>
            {expanded
              ? t('analytics.collapse', '접기')
              : t('analytics.showMoreCount', '더 보기 ({{count}})', { count: slices.length - TOP })}
          </Text>
        </Pressable>
      ) : null}
    </Section>
  );
}
