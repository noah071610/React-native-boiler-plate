import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Section } from '@/components/domain/analytics/section';
import type { Analytics, BaselineRow, Settlement, Usage } from '@/hooks/use-analytics';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

/** ① 기간 요약 — 초과해도 문구로 지적하지 않는다. 사실과 숫자만 (Master 원칙 3). */
export function SummaryCard({
  analytics,
  budgetAmount,
}: {
  analytics: Analytics;
  budgetAmount: number | null;
}) {
  const { scheme } = useTheme();
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

  return (
    <Section>
      <Text className="text-xs font-bold" style={{ color: scheme.mutedForeground }}>
        {rangeLabel} · {days}일
      </Text>

      <Text className="mt-3 text-xs font-bold" style={{ color: scheme.mutedForeground }}>
        총 지출
      </Text>
      <Text className="text-3xl font-black text-neutral-900 dark:text-neutral-50">
        {formatMoney(totalMinor, currency)}
      </Text>
      {dualCurrency ? (
        <Text className="text-base font-bold" style={{ color: scheme.mutedForeground }}>
          {formatMoney(totalBaseMinor, baseCurrency)}
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
              예산 {formatMoney(budgetAmount, baseCurrency)} 대비 {budgetPercent}%
              {overBaseMinor != null
                ? ` · 초과 ${formatMoney(overBaseMinor, baseCurrency)}`
                : ''}
            </Text>
          </>
        ) : null}
        <Text className="text-xs font-bold" style={{ color: scheme.mutedForeground }}>
          하루 평균 {formatMoney(dailyAvgBaseMinor, baseCurrency)}
          {preTrip ? ' (여행 기간만)' : ''}
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
              ✈️ 출발 전 지출 · {preTrip.count}건
            </Text>
            <Text className="text-[11px] font-semibold" style={{ color: scheme.mutedForeground }}>
              총 지출에 포함 · 하루 평균에서는 제외
            </Text>
          </View>
          <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
            {formatMoney(preTrip.minor, currency)}
          </Text>
        </View>
      ) : null}
    </Section>
  );
}

/** ④ 개인 소비 기준선 — 남의 데이터를 쓰지 않는다. 표본이 부족하면 줄을 만들지 않는다. */
export function BaselineCard({ rows, currency }: { rows: BaselineRow[]; currency: string }) {
  const { scheme } = useTheme();

  return (
    <Section title="내 소비 기준선">
      {rows.length === 0 ? (
        <Text className="text-sm font-semibold" style={{ color: scheme.mutedForeground }}>
          기록이 쌓이면 평소 소비 기준을 알려드려요
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
                <Text className="flex-1 text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
                  보통 {formatMoney(row.medianMinor, currency)}
                </Text>
                <Text className="text-sm font-black text-neutral-900 dark:text-neutral-50">
                  {formatMoney(row.latestMinor, currency)}
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
  const { direction, diffMinor, diffBaseMinor, me, other } = settlement;

  return (
    <Section title="정산">
      <Row label="공동 경비" value={formatMoney(settlement.sharedMinor, currency)} strong />
      {settlement.personalMinor > 0 ? (
        <Text className="mt-0.5 text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
          (개인 경비 {formatMoney(settlement.personalMinor, currency)} 제외)
        </Text>
      ) : null}

      <View className="mt-3 gap-1">
        <Row label="1인당" value={formatMoney(settlement.perPersonMinor, currency)} />
        <Row label={`내가 낸 돈`} value={formatMoney(me.minor, currency)} />
        <Row label={`${other.name}가 낸 돈`} value={formatMoney(other.minor, currency)} />
      </View>

      <View
        style={{ borderColor: scheme.border }}
        className="mt-4 border-t pt-3"
      >
        {direction === 'even' ? (
          <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
            정산할 것이 없어요
          </Text>
        ) : (
          <>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {direction === 'other-to-me' ? other.name : '나'}
              </Text>
              <ArrowRight size={16} color={scheme.mutedForeground} />
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {direction === 'other-to-me' ? '나' : other.name}
              </Text>
            </View>
            <Text className="mt-1 text-2xl font-black" style={{ color: scheme.primary }}>
              {formatMoney(diffMinor, currency)}
              {dualCurrency ? (
                <Text className="text-sm font-bold" style={{ color: scheme.mutedForeground }}>
                  {'  '}약 {formatMoney(diffBaseMinor, baseCurrency)}
                </Text>
              ) : null}
            </Text>
          </>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenSync}
        className="mt-3 active:opacity-60"
      >
        <Text className="text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
          {lastSyncAt
            ? `마지막 동기화 ${new Date(lastSyncAt).toLocaleString('ko-KR')} 기준`
            : '아직 상대의 기록을 받지 못했어요. 동기화하면 정산이 정확해져요.'}
        </Text>
        <Text className="mt-0.5 text-xs font-bold" style={{ color: scheme.primary }}>
          동기화하러 가기
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

  return (
    <Section title="누가 얼마나 썼나">
      <View className="gap-4">
        {usage.rows.map((row) => (
          <View key={row.id} className="gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                {row.isMe ? '나' : row.name}
              </Text>
              <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
                {formatMoney(row.totalMinor, currency)}
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
              본인 {formatMoney(row.ownMinor, currency)} · 공용 몫{' '}
              {formatMoney(row.sharedShareMinor, currency)}
            </Text>
          </View>
        ))}
      </View>

      <Text className="mt-3 text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
        공용 {formatMoney(usage.sharedPoolMinor, currency)}을 반씩 나눠 더한 값이에요
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
