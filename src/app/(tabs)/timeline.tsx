import { asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plane, Plus, ReceiptText } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalculatorSheet, type CalcResult } from '@/components/domain/main/calculator-sheet';
import type { QuickRecordInput } from '@/components/domain/main/quick-record';
import { DayGrid, HOUR_HEIGHT, type ExpenseMeta } from '@/components/domain/timeline/day-grid';
import { TimelineHeader } from '@/components/domain/timeline/timeline-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { categoryLabel } from '@/constants/categories';
import { db } from '@/db';
import { categories, expenses, participants, type Expense } from '@/db/schema';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { useTimelineDays } from '@/hooks/use-timeline-days';
import { haptics } from '@/lib/haptics';
import { useRate } from '@/lib/rates';
import { insertExpense } from '@/lib/save-expense';
import { useAppStore } from '@/store/app';

/**
 * 타임라인 — 캘린더 일별 보기의 시간 축을 그대로 쓴다.
 * 시간대 눈금 + 현재 시각 바 + 스크롤에 따라 바뀌는 날짜 헤더.
 * 캘린더 탭은 만들지 않으므로(Master §10) 월간 격자와 지도는 여기에도 없다.
 */
export default function TimelineScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const addRecentCalc = useAppStore((s) => s.addRecentCalc);

  // 내 참가자 id는 여행에 딸린 값이다 — 스토어에는 없다 (v1에서 뺐다)
  const { trip, expenses: rows, myParticipantId, loading } = useActiveTrip();
  const tripId = trip?.id ?? '';

  const categoryQuery = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.hiddenAt))
      .orderBy(asc(categories.sortOrder)),
  );
  // tombstone까지 가져온다 — 연동을 끊은 뒤에도 그 사람이 기록한 지출의 이름은 보여야 한다.
  // 연동 판정만 살아있는 행으로 한다 (metaOf).
  // deps를 줘야 여행이 바뀔 때 구독이 다시 걸린다 (기본값 []는 첫 쿼리에 고정된다)
  const participantQuery = useLiveQuery(
    db.select().from(participants).where(eq(participants.tripId, tripId)),
    [tripId],
  );

  const categoryRows = useMemo(() => categoryQuery.data ?? [], [categoryQuery.data]);
  const participantRows = useMemo(() => participantQuery.data ?? [], [participantQuery.data]);

  // 애널리틱스에서 넘어올 때 붙는다 — 카테고리 줄 탭 / 일별 막대 탭
  const { date: dateParam, categoryId: categoryParam } = useLocalSearchParams<{
    date?: string;
    categoryId?: string;
  }>();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() =>
    categoryParam ? [categoryParam] : [],
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  /** 하단 + — 메인과 같은 계산기 시트를 그대로 띄운다 */
  const [calcOpen, setCalcOpen] = useState(false);

  const days = useTimelineDays({
    expenses: rows,
    categories: categoryRows,
    startDate: trip?.startDate ?? null,
    selectedCategoryIds,
    query,
  });

  /* 스크롤 위치 → 헤더 날짜. 각 날 블록의 y를 기억해두고 맨 위에 걸린 날을 고른다. */
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const didAutoScroll = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  /**
   * 첫 진입에 어디로 갈지. 날짜 파라미터가 있으면 그날의 맨 위,
   * 없으면 오늘의 지금 시각 (캘린더 앱과 같은 동작).
   * 레이아웃이 끝나야 y를 알 수 있어 ref로 들고 onLayout에서 읽는다.
   */
  const jump = useRef<{ index: number; toDayTop: boolean }>({ index: 0, toDayTop: false });
  const dayIndex = dateParam ? days.findIndex((d) => d.key === dateParam) : -1;
  jump.current = { index: dayIndex >= 0 ? dayIndex : 0, toDayTop: dayIndex >= 0 };

  const onDayLayout = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const top = e.nativeEvent.layout.y;
      offsets.current[index] = top;
      if (index !== jump.current.index || didAutoScroll.current) return;
      didAutoScroll.current = true;
      const y = jump.current.toDayTop
        ? top
        : top + new Date().getHours() * HOUR_HEIGHT - HOUR_HEIGHT * 2;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
    },
    [],
  );

  // 탭이 이미 떠 있는 상태에서 애널리틱스가 다시 보내오는 경우
  useEffect(() => {
    if (!dateParam) return;
    setSelectedCategoryIds(categoryParam ? [categoryParam] : []);
    const index = days.findIndex((d) => d.key === dateParam);
    const y = index >= 0 ? offsets.current[index] : undefined;
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
    // days는 필터가 바뀔 때마다 새로 만들어진다 — 파라미터가 바뀔 때만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam, categoryParam]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const ys = offsets.current;
      let index = 0;
      while (index + 1 < ys.length && ys[index + 1] <= y + 8) index += 1;
      if (index !== activeIndex) setActiveIndex(index);
    },
    [activeIndex],
  );

  const metaOf = useCallback(
    (expense: Expense): ExpenseMeta => {
      const chart = [scheme.chart1, scheme.chart2, scheme.chart3, scheme.chart4, scheme.chart5];
      const index = categoryRows.findIndex((c) => c.id === expense.categoryId);
      const category = index >= 0 ? categoryRows[index] : null;
      const author = participantRows.find((p) => p.id === expense.authorId);
      // 연동(살아있는 참가자 2명)이 아니면 "누가 사용"은 존재하지 않는다
      const shared = participantRows.filter((p) => p.deletedAt == null).length >= 2;
      return {
        icon: category?.icon ?? '💸',
        label: category ? categoryLabel(category) : '지출',
        color: chart[(index < 0 ? 0 : index) % chart.length],
        authorName: expense.authorId === myParticipantId ? null : (author?.name ?? '동행자'),
        usedByName:
          shared && expense.usedBy
            ? (participantRows.find((p) => p.id === expense.usedBy)?.name ?? '동행자')
            : null,
      };
    },
    [categoryRows, participantRows, myParticipantId, scheme],
  );

  const toggleCategory = (id: string | null) => {
    haptics.selection();
    if (id === null) return setSelectedCategoryIds([]);
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const openExpense = (expense: Expense) => {
    router.push({ pathname: '/expense', params: { id: expense.id } });
  };

  /** 자기가 기록한 것만 지울 수 있다 (Master §11 소유권 규칙). */
  const askDelete = (expense: Expense) => {
    if (expense.authorId !== myParticipantId) return;
    haptics.selection();
    setPendingDelete(expense);
  };

  /** 물리 삭제하면 아직 동기화하지 않은 상대 기기에서 되살아난다 — tombstone으로 지운다. */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const now = Date.now();
    await db
      .update(expenses)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(expenses.id, pendingDelete.id));
    setPendingDelete(null);
  };

  const quote = useRate(trip?.destinationCurrency ?? '', trip?.baseCurrency ?? '');

  const saveExpense = async (result: CalcResult, input: QuickRecordInput) => {
    if (!trip || !quote || !myParticipantId) return;
    setCalcOpen(false);
    await insertExpense({
      tripId: trip.id,
      authorId: myParticipantId,
      localCurrency: trip.destinationCurrency,
      baseCurrency: trip.baseCurrency,
      quote,
      result,
      input,
    });
    addRecentCalc({
      amount: result.localMinor,
      currency: trip.destinationCurrency,
      baseAmount: result.baseMinor,
      baseCurrency: trip.baseCurrency,
      rate: quote.rate,
      rateDate: quote.date,
    });
    haptics.notification();
  };

  if (loading) return <FullScreenLoader title="타임라인을 불러오는 중" />;

  // 여행이 하나도 없으면 기록도 없다 — 로더를 계속 돌리지 않고 이유를 말한다
  if (!trip) {
    return (
      <View
        className="flex-1 items-center justify-center gap-3 px-8 pb-20"
        style={{ backgroundColor: scheme.background, paddingTop: insets.top }}
      >
        <View
          className="mb-2 h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${scheme.primary}18` }}
        >
          <Plane size={30} color={scheme.primary} />
        </View>
        <Text className="text-center text-xl font-black text-neutral-900 dark:text-neutral-50">
          아직 여행지 설정이 안되어있어요
        </Text>
        <Text
          className="text-center text-sm font-semibold leading-relaxed"
          style={{ color: scheme.mutedForeground }}
        >
          메인에서 여행지를 추가하면{'\n'}그 기간의 지출 기록이 여기에 쌓여요
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            router.push('/');
          }}
          style={{ backgroundColor: scheme.primary }}
          className="mt-3 rounded-full px-6 py-3.5 active:opacity-80"
        >
          <Text style={{ color: scheme.primaryForeground }} className="text-sm font-bold">
            메인으로
          </Text>
        </Pressable>
      </View>
    );
  }

  const filtering = selectedCategoryIds.length > 0 || query.trim().length > 0;
  const empty = rows.length === 0;

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background, paddingTop: insets.top }}>
      <TimelineHeader
        day={days[activeIndex] ?? days[0] ?? null}
        localCurrency={trip.destinationCurrency}
        baseCurrency={trip.baseCurrency}
        categories={categoryRows}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={toggleCategory}
        searchOpen={searchOpen}
        query={query}
        onQueryChange={setQuery}
        onToggleSearch={() => {
          setSearchOpen((prev) => {
            if (prev) setQuery('');
            return !prev;
          });
        }}
      />

      {empty ? (
        <View className="flex-1 items-center justify-center gap-3 px-8 pb-20">
          <View
            className="mb-2 h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `${scheme.primary}18` }}
          >
            <ReceiptText size={30} color={scheme.primary} />
          </View>
          <Text className="text-center text-xl font-black text-neutral-900 dark:text-neutral-50">
            아직 기록이 없어요
          </Text>
          <Text
            className="text-center text-sm font-semibold leading-relaxed"
            style={{ color: scheme.mutedForeground }}
          >
            메인에서 환율을 계산하고{'\n'}기록하기를 누르면 여기에 쌓여요
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              router.push('/');
            }}
            style={{ backgroundColor: scheme.primary }}
            className="mt-3 rounded-full px-6 py-3.5 active:opacity-80"
          >
            <Text style={{ color: scheme.primaryForeground }} className="text-sm font-bold">
              메인으로
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          scrollEventThrottle={32}
          onScroll={onScroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 140 }}
        >
          {filtering && days.every((d) => d.count === 0) ? (
            <Text
              className="py-16 text-center text-sm font-semibold"
              style={{ color: scheme.mutedForeground }}
            >
              조건에 맞는 기록이 없어요
            </Text>
          ) : (
            days.map((day, index) => (
              <View key={day.key} onLayout={onDayLayout(index)}>
                <DayGrid day={day} metaOf={metaOf} onPress={openExpense} onLongPress={askDelete} />
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="지출 추가"
        onPress={() => {
          haptics.selection();
          setCalcOpen(true);
        }}
        style={{ backgroundColor: scheme.primary, bottom: insets.bottom + 24 }}
        className="absolute right-6 h-14 w-14 items-center justify-center rounded-2xl active:opacity-80"
      >
        <Plus size={26} color={scheme.primaryForeground} />
      </Pressable>

      <CalculatorSheet
        visible={calcOpen}
        side="local"
        localCurrency={trip.destinationCurrency}
        baseCurrency={trip.baseCurrency}
        rate={quote?.rate ?? 0}
        tripId={trip.id}
        expenses={rows}
        onClose={() => setCalcOpen(false)}
        onSave={saveExpense}
      />

      <ConfirmDialog
        visible={pendingDelete != null}
        title="이 기록을 지울까요?"
        message="지운 기록은 되돌릴 수 없어요."
        actions={[
          { label: '삭제', variant: 'destructive', onPress: () => void confirmDelete() },
          { label: '취소', variant: 'ghost', onPress: () => setPendingDelete(null) },
        ]}
        onDismiss={() => setPendingDelete(null)}
      />
    </View>
  );
}
