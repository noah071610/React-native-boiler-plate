import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BaselineCard,
  SettlementCard,
  SummaryCard,
  UsageCard,
} from '@/components/domain/analytics/analytics-cards';
import { CategoryBreakdown } from '@/components/domain/analytics/category-breakdown';
import { DailyTrend } from '@/components/domain/analytics/daily-trend';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { SectionHeader } from '@/components/ui/section-header';
import { countryNameOfCurrency } from '@/constants/currencies';
import { db } from '@/db';
import { categories, expenses, participants, trips } from '@/db/schema';
import { localDateKey } from '@/hooks/use-active-trip';
import { MIN_TREND_DAYS, useAnalytics } from '@/hooks/use-analytics';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app';

/**
 * 여행 하나의 애널리틱스 — 단일 스크롤. 탭이나 페이지 전환을 두지 않는다.
 * 목록(애널리틱스 탭)에서 여행을 골라 들어온다. 합계는 그 여행 기간 것만이다.
 * 여행이 끝났으면 ①과 ⑤가 위로 올라온다. 그 시점의 유일한 관심사이기 때문이다.
 */
export default function TripAnalyticsScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  const { tripId: param } = useLocalSearchParams<{ tripId?: string }>();
  const tripId = param ?? '';

  const tripQuery = useLiveQuery(db.select().from(trips).where(eq(trips.id, tripId)), [tripId]);
  const expenseQuery = useLiveQuery(
    db
      .select()
      .from(expenses)
      .where(and(eq(expenses.tripId, tripId), isNull(expenses.deletedAt))),
    [tripId],
  );
  const categoryQuery = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.hiddenAt))
      .orderBy(asc(categories.sortOrder)),
  );
  const participantQuery = useLiveQuery(
    db.select().from(participants).where(eq(participants.tripId, tripId)),
    [tripId],
  );

  const trip = tripQuery.data?.[0] ?? null;
  const rows = useMemo(() => expenseQuery.data ?? [], [expenseQuery.data]);
  const categoryRows = useMemo(() => categoryQuery.data ?? [], [categoryQuery.data]);
  // 연동을 끊으면 상대 행이 tombstone이 된다 — 정산과 개인별 소비도 같이 사라져야 한다
  const participantRows = useMemo(
    () => (participantQuery.data ?? []).filter((p) => p.deletedAt == null),
    [participantQuery.data],
  );
  const myParticipantId = participantRows.find((p) => p.isMe)?.id ?? null;

  const palette = useMemo(
    () => [scheme.chart1, scheme.chart2, scheme.chart3, scheme.chart4, scheme.chart5],
    [scheme],
  );

  const analytics = useAnalytics({
    trip,
    expenses: rows,
    categories: categoryRows,
    participants: participantRows,
    myParticipantId,
    palette,
  });

  if (tripQuery.data === undefined) return <FullScreenLoader title="분석하는 중" />;
  if (!trip) {
    return (
      <View className="flex-1" style={{ backgroundColor: scheme.background }}>
        <SectionHeader title="애널리틱스" onBack={() => router.back()} />
        <View className="items-center gap-2 py-24">
          <Text className="text-lg font-black text-neutral-900 dark:text-neutral-50">
            여행을 찾을 수 없어요
          </Text>
        </View>
      </View>
    );
  }

  const ended = trip.endDate != null && trip.endDate < localDateKey(Date.now());

  const content = () => {
    if (!analytics) {
      return (
        <View className="items-center gap-2 py-24">
          <Text className="text-lg font-black text-neutral-900 dark:text-neutral-50">
            아직 분석할 기록이 없어요
          </Text>
          <Text className="text-sm font-semibold" style={{ color: scheme.mutedForeground }}>
            지출이 쌓이면 여기에서 소비 흐름을 보여드려요
          </Text>
        </View>
      );
    }

    const summary = (
      <SummaryCard key="summary" analytics={analytics} budgetAmount={trip.budgetAmount} />
    );

    const breakdown = (
      <CategoryBreakdown
        key="breakdown"
        slices={analytics.categories}
        currency={analytics.currency}
        totalMinor={analytics.totalMinor}
        onSelect={(categoryId) => router.push({ pathname: '/timeline', params: { categoryId } })}
      />
    );

    // 3일 미만은 추이라고 부를 수 없다 — 섹션을 통째로 숨긴다
    const trend =
      analytics.days >= MIN_TREND_DAYS ? (
        <DailyTrend key="trend" daily={analytics.daily} currency={analytics.currency} />
      ) : null;

    const baseline = (
      <BaselineCard key="baseline" rows={analytics.baseline} currency={analytics.currency} />
    );

    const settlement = analytics.settlement ? (
      <SettlementCard
        key="settlement"
        settlement={analytics.settlement}
        currency={analytics.currency}
        baseCurrency={analytics.baseCurrency}
        dualCurrency={analytics.dualCurrency}
        lastSyncAt={lastSyncAt}
        onOpenSync={() => router.push('/sync')}
      />
    ) : null;

    // 연동일 때만 존재한다 (usage는 참가자 2명에서만 만들어진다)
    const usage = analytics.usage ? (
      <UsageCard key="usage" usage={analytics.usage} currency={analytics.currency} />
    ) : null;

    const sections = ended
      ? [summary, settlement, usage, breakdown, trend, baseline]
      : [summary, breakdown, trend, usage, baseline, settlement];

    return sections.filter(Boolean);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background }}>
      <SectionHeader
        title={`${countryNameOfCurrency(trip.destinationCurrency)} 여행`}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
          gap: 16,
        }}
      >
        <Text className="text-sm font-semibold" style={{ color: scheme.mutedForeground }}>
          {analytics?.rangeLabel ?? `${trip.startDate ?? '?'} – ${trip.endDate ?? '?'}`}
        </Text>
        {content()}
      </ScrollView>
    </View>
  );
}
