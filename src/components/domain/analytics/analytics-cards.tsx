import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Section } from '@/components/domain/analytics/section';
import type { Analytics, BaselineRow, Settlement, Usage } from '@/hooks/use-analytics';
import { useTheme } from '@/hooks/use-theme';
import { formatMoneyI18n, useI18n } from '@/i18n';

/** ① 기간 요약 — 초과해도 문구로 지적하지 않는다. 사실과 숫자만 (Master 원칙 3). */
export function SummaryCard({
  analytics,
  budgetAmount,
}: {
  analytics: Analytics;
  budgetAmount: number | null;
}) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const {
    rangeLabel,
    days,
    currency,
    baseCurrency,
    dualCurrency,
    totalMinor,
    totalBaseMinor,
    preTrip,
    budgetPercent,
    overBaseMinor,
    dailyAvgBaseMinor,
  } = analytics;
  const money = (minor: number, code: string) => formatMoneyI18n(minor, code, t, resolvedLanguage);

  return (
    <Section>
      <Text className="text-xs font-bold" style={{ color: scheme.mutedForeground }}>
        {t('analytics.rangeDays', '{{range}} · {{days}}일', { range: rangeLabel, days })}
      </Text>

      <Text className="mt-3 text-xs font-bold" style={{ color: scheme.mutedForeground }}>
        {t('analytics.totalSpent', '총 지출')}
      </Text>
      <Text className="text-3xl font-black text-neutral-900 dark:text-neutral-50">
        {money(totalMinor, currency)}
      </Text>
      {dualCurrency ? (
        <Text className="text-base font-bold" style={{ color: scheme.mutedForeground }}>
          {money(totalBaseMinor, baseCurrency)}
        </Text>
      ) : null}

      <View className="mt-4 gap-1">
        {budgetPercent != null && budgetAmount != null ? (
          <>
            <View
              style={{ backgroundColor: scheme.muted }}
              className="h-2 overflow-hidden rounded-full"
            >
              <View
                style={{
                  backgroundColor: overBaseMinor != null ? scheme.warning : scheme.primary,
                  width: `${Math.min(100, budgetPercent)}%`,
                }}
                className="h-full rounded-full"
              />
            </View>
            <Text className="text-xs font-bold" style={{ color: scheme.mutedForeground }}>
              {t('analytics.budgetAgainst', '예산 {{amount}} 대비 {{percent}}%', {
                amount: money(budgetAmount, baseCurrency),
                percent: budgetPercent,
              })}
              {overBaseMinor != null
                ? t('analytics.overBudgetInline', ' · 초과 {{amount}}', {
                    amount: money(overBaseMinor, baseCurrency),
                  })
                : ''}
            </Text>
          </>
        ) : null}
        <Text className="text-xs font-bold" style={{ color: scheme.mutedForeground }}>
          {t('analytics.dailyAverage', '하루 평균 {{amount}}', {
            amount: money(dailyAvgBaseMinor, baseCurrency),
          })}
          {preTrip ? t('analytics.tripPeriodOnly', ' (여행 기간만)') : ''}
        </Text>
      </View>

      {/* 출발 전 지출 — 총 지출에는 들어 있지만 하루 평균·일별 추이에는 없다.
          그 사실을 말해주지 않으면 "막대를 다 더해도 총액이 안 맞는다"가 된다. */}
      {preTrip ? (
        <View
          className="mt-4 flex-row items-center justify-between rounded-2xl px-3.5 py-3"
          style={{ backgroundColor: scheme.muted }}
        >
          <View className="gap-0.5">
            <Text className="text-xs font-bold" style={{ color: scheme.mutedForeground }}>
              {t('analytics.preTripSpending', '✈️ 출발 전 지출 · {{count}}건', {
                count: preTrip.count,
              })}
            </Text>
            <Text className="text-[11px] font-semibold" style={{ color: scheme.mutedForeground }}>
              {t('analytics.preTripDescription', '총 지출에 포함 · 하루 평균에서는 제외')}
            </Text>
          </View>
          <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
            {money(preTrip.minor, currency)}
          </Text>
        </View>
      ) : null}
    </Section>
  );
}

/** ④ 개인 소비 기준선 — 남의 데이터를 쓰지 않는다. 표본이 부족하면 줄을 만들지 않는다. */
export function BaselineCard({ rows, currency }: { rows: BaselineRow[]; currency: string }) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const money = (minor: number) => formatMoneyI18n(minor, currency, t, resolvedLanguage);

  return (
    <Section title={t('analytics.baselineTitle', '내 소비 기준선')}>
      {rows.length === 0 ? (
        <Text className="text-sm font-semibold" style={{ color: scheme.mutedForeground }}>
          {t('analytics.baselineEmpty', '기록이 쌓이면 평소 소비 기준을 알려드려요')}
        </Text>
      ) : (
        <View className="gap-3">
          {rows.map((row) => {
            const color =
              row.trend === 'up'
                ? scheme.warning
                : row.trend === 'down'
                  ? scheme.success
                  : scheme.mutedForeground;
            const Icon =
              row.trend === 'up' ? TrendingUp : row.trend === 'down' ? TrendingDown : Minus;
            return (
              <View key={row.id} className="flex-row items-center gap-2">
                <Text className="text-sm">{row.icon}</Text>
                <Text className="w-14 text-sm font-bold text-neutral-900 dark:text-neutral-50">
                  {row.label}
                </Text>
                <Text
                  className="flex-1 text-xs font-semibold"
                  style={{ color: scheme.mutedForeground }}
                >
                  {t('analytics.usuallyAmount', '보통 {{amount}}', {
                    amount: money(row.medianMinor),
                  })}
                </Text>
                <Text className="text-sm font-black text-neutral-900 dark:text-neutral-50">
                  {money(row.latestMinor)}
                </Text>
                <Icon size={14} color={color} />
              </View>
            );
          })}
        </View>
      )}
    </Section>
  );
}

/** ⑤ 정산 — 참가자 2명일 때만 렌더한다. 균등 분할만 (v1). */
export function SettlementCard({
  settlement,
  currency,
  baseCurrency,
  dualCurrency,
  lastSyncAt,
  onOpenSync,
}: {
  settlement: Settlement;
  currency: string;
  baseCurrency: string;
  dualCurrency: boolean;
  lastSyncAt: number | null;
  onOpenSync: () => void;
}) {
  const { scheme } = useTheme();
  const { locale, resolvedLanguage, t } = useI18n();
  const { direction, diffMinor, diffBaseMinor, me, other } = settlement;
  const money = (minor: number, code: string) => formatMoneyI18n(minor, code, t, resolvedLanguage);

  return (
    <Section title={t('expense.settlement', '정산')}>
      <Row
        label={t('analytics.sharedExpense', '공동 경비')}
        value={money(settlement.sharedMinor, currency)}
        strong
      />
      {settlement.personalMinor > 0 ? (
        <Text className="mt-0.5 text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
          {t('analytics.personalExcludedInline', '(개인 경비 {{amount}} 제외)', {
            amount: money(settlement.personalMinor, currency),
          })}
        </Text>
      ) : null}

      <View className="mt-3 gap-1">
        <Row
          label={t('analytics.perPerson', '1인당')}
          value={money(settlement.perPersonMinor, currency)}
        />
        <Row label={t('analytics.paidByMe', '내가 낸 돈')} value={money(me.minor, currency)} />
        <Row
          label={t('analytics.paidByName', '{{name}}가 낸 돈', { name: other.name })}
          value={money(other.minor, currency)}
        />
      </View>

      <View style={{ borderColor: scheme.border }} className="mt-4 border-t pt-3">
        {direction === 'even' ? (
          <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
            {t('analytics.noSettlement', '정산할 것이 없어요')}
          </Text>
        ) : (
          <>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {direction === 'other-to-me' ? other.name : t('expense.me', '나')}
              </Text>
              <ArrowRight size={16} color={scheme.mutedForeground} />
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {direction === 'other-to-me' ? t('expense.me', '나') : other.name}
              </Text>
            </View>
            <Text className="mt-1 text-2xl font-black" style={{ color: scheme.primary }}>
              {money(diffMinor, currency)}
              {dualCurrency ? (
                <Text className="text-sm font-bold" style={{ color: scheme.mutedForeground }}>
                  {'  '}
                  {t('analytics.approxAmount', '약 {{amount}}', {
                    amount: money(diffBaseMinor, baseCurrency),
                  })}
                </Text>
              ) : null}
            </Text>
          </>
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={onOpenSync} className="mt-3 active:opacity-60">
        <Text className="text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
          {lastSyncAt
            ? t('analytics.lastSyncBasis', '마지막 동기화 {{date}} 기준', {
                date: new Date(lastSyncAt).toLocaleString(locale),
              })
            : t(
                'analytics.syncNeededForSettlement',
                '아직 상대의 기록을 받지 못했어요. 동기화하면 정산이 정확해져요.',
              )}
        </Text>
        <Text className="mt-0.5 text-xs font-bold" style={{ color: scheme.primary }}>
          {t('analytics.goSync', '동기화하러 가기')}
        </Text>
      </Pressable>
    </Section>
  );
}

/**
 * ⑥ 개인별 소비 비교 — 연동(참가자 2명)일 때만 렌더한다.
 * 정산이 "누가 냈는가"라면 여기는 "누가 썼는가"다. 공용은 반씩 나눠 두 막대에 넣고
 * 진한 칸(본인 지정) / 연한 칸(공용 몫)으로 갈라 어디서 벌어졌는지 보이게 한다.
 */
export function UsageCard({ usage, currency }: { usage: Usage; currency: string }) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const money = (minor: number) => formatMoneyI18n(minor, currency, t, resolvedLanguage);

  return (
    <Section title={t('analytics.usageTitle', '누가 얼마나 썼나')}>
      <View className="gap-4">
        {usage.rows.map((row) => (
          <View key={row.id} className="gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                {row.isMe ? t('expense.me', '나') : row.name}
              </Text>
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {money(row.totalMinor)}
              </Text>
            </View>

            <View
              style={{ backgroundColor: scheme.muted }}
              className="h-2.5 flex-row overflow-hidden rounded-full"
            >
              <View
                style={{
                  backgroundColor: scheme.primary,
                  width: `${(row.ownMinor / usage.maxMinor) * 100}%`,
                }}
                className="h-full"
              />
              <View
                style={{
                  backgroundColor: scheme.primary,
                  opacity: 0.35,
                  width: `${(row.sharedShareMinor / usage.maxMinor) * 100}%`,
                }}
                className="h-full"
              />
            </View>

            <Text className="text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
              {t('analytics.usageBreakdown', '본인 {{own}} · 공용 몫 {{shared}}', {
                own: money(row.ownMinor),
                shared: money(row.sharedShareMinor),
              })}
            </Text>
          </View>
        ))}
      </View>

      <Text className="mt-3 text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
        {t('analytics.sharedPoolDescription', '공용 {{amount}}을 반씩 나눠 더한 값이에요', {
          amount: money(usage.sharedPoolMinor),
        })}
      </Text>
    </Section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { scheme } = useTheme();
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className="text-sm font-semibold" style={{ color: scheme.mutedForeground }}>
        {label}
      </Text>
      <Text
        className={
          strong
            ? 'text-xl font-black text-neutral-900 dark:text-neutral-50'
            : 'text-sm font-bold text-neutral-900 dark:text-neutral-50'
        }
      >
        {value}
      </Text>
    </View>
  );
}
