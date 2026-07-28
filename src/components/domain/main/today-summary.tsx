import { asc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ReceiptText } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { db } from '@/db';
import { categories, type Expense } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayLabel, formatMoneyI18n, useI18n, type TFunction } from '@/i18n';

type Props = {
  count: number;
  localMinor: number;
  localCurrency: string;
  baseMinor: number;
  baseCurrency: string;
  /** 어제 대비 변화율. null이면 둘째 줄 생략 */
  vsYesterdayPercent: number | null;
  /** 여행 후에는 '오늘'이 아니라 '여행 전체' 요약이 된다 */
  label?: string;
  /** 요약 아래에 최신순으로 쭉 뿌릴 기록 */
  items: Expense[];
  onPress: () => void;
};

const paymentLabel = (method: string, t: TFunction) =>
  t(
    `main.payment.${method}`,
    method === 'cash' ? '현금' : method === 'card' ? '카드' : method === 'other' ? '기타' : 'QR',
  );

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
};

/**
 * §④ 오늘 요약 — 요약 한두 줄 + 그날의 기록 목록.
 * 타임라인과 달리 시간 격자도 편집도 없다. 자세히 볼 사람은 타임라인으로 간다.
 * ponytail: 행마다 탭/롱프레스를 달지 않는다. 제목 탭 → 타임라인이면 충분하다.
 */
export function TodaySummary({
  count,
  localMinor,
  localCurrency,
  baseMinor,
  baseCurrency,
  vsYesterdayPercent,
  label,
  items,
  onPress,
}: Props) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const titleLabel = label ?? t('dashboard.today', '오늘');
  const diff = vsYesterdayPercent;
  const money = (minor: number, currency: string) =>
    formatMoneyI18n(minor, currency, t, resolvedLanguage);

  const categoryQuery = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.hiddenAt))
      .orderBy(asc(categories.sortOrder)),
  );
  const categoryRows = useMemo(() => categoryQuery.data ?? [], [categoryQuery.data]);

  const sorted = useMemo(() => [...items].sort((a, b) => b.occurredAt - a.occurredAt), [items]);

  const chart = [scheme.chart1, scheme.chart2, scheme.chart3, scheme.chart4, scheme.chart5];
  const metaOf = (expense: Expense) => {
    const index = categoryRows.findIndex((c) => c.id === expense.categoryId);
    const category = index >= 0 ? categoryRows[index] : null;
    return {
      icon: category?.icon ?? '💸',
      label: category ? categoryDisplayLabel(category, t) : t('timeline.expenseFallback', '지출'),
      color: chart[(index < 0 ? 0 : index) % chart.length],
    };
  };

  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="gap-2 px-1 active:opacity-60"
      >
        <View className="flex-row items-baseline gap-2">
          <Text className="text-lg font-black text-neutral-900 dark:text-neutral-50">
            {t('main.summaryTitle', '{{label}} 기록', { label: titleLabel })}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
            {t('main.recordCountValue', '{{count}}건', { count })}
          </Text>
        </View>

        {count === 0 ? (
          <View
            className="mt-1 items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-6"
            style={{ borderColor: scheme.border, backgroundColor: `${scheme.mutedForeground}08` }}
          >
            <ReceiptText size={22} color={scheme.mutedForeground} style={{ opacity: 0.6 }} />
            <Text className="text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">
              {t('timeline.emptyTitle', '아직 기록이 없어요')}
            </Text>
            <Text
              className="text-center text-xs font-medium"
              style={{ color: scheme.mutedForeground }}
            >
              {t('main.recordEmptyHint', '환율을 계산하고 지출을 기록해 보세요')}
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
              {localMinor > 0 ? `${money(localMinor, localCurrency)} ` : ''}
              {localMinor > 0
                ? `(${money(baseMinor, baseCurrency)})`
                : money(baseMinor, baseCurrency)}
            </Text>
            {diff != null && diff !== 0 ? (
              <Text className="text-sm font-semibold text-neutral-400">
                {t(
                  diff > 0 ? 'main.moreThanYesterday' : 'main.lessThanYesterday',
                  diff > 0
                    ? '어제보다 {{percent}}% 많게 쓰는 중'
                    : '어제보다 {{percent}}% 적게 쓰는 중',
                  { percent: Math.abs(diff) },
                )}
              </Text>
            ) : null}
          </>
        )}
      </Pressable>

      {sorted.map((expense) => {
        const meta = metaOf(expense);
        return (
          <View
            key={expense.id}
            style={{ backgroundColor: `${meta.color}26`, borderLeftColor: meta.color }}
            className="rounded-lg border-l-[3px] px-2.5 py-1.5"
          >
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xs">{meta.icon}</Text>
              <Text
                numberOfLines={1}
                className="flex-1 text-[13px] font-bold text-neutral-900 dark:text-neutral-50"
              >
                {expense.memo || expense.place || meta.label}
              </Text>
              <Text className="text-[13px] font-black text-neutral-900 dark:text-neutral-50">
                {money(expense.amount, expense.currency)}
              </Text>
            </View>

            <View className="mt-0.5 flex-row items-center gap-1.5">
              <Text className="text-[11px] font-semibold" style={{ color: scheme.mutedForeground }}>
                {hhmm(expense.occurredAt)}
                {expense.paymentMethod ? ` · ${paymentLabel(expense.paymentMethod, t)}` : ''}
              </Text>
              {expense.isPersonal ? (
                <Text className="text-[10px] font-bold" style={{ color: scheme.warning }}>
                  {t('main.personal', '개인')}
                </Text>
              ) : null}
              <View className="flex-1" />
              <Text className="text-[11px] font-semibold" style={{ color: scheme.mutedForeground }}>
                {money(expense.baseAmount, expense.baseCurrency)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
