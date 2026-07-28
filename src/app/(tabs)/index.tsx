import { eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTripCard, BudgetCard } from '@/components/domain/main/budget-card';
import { BudgetSheet } from '@/components/domain/main/budget-sheet';
import { CalculatorSheet, type CalcResult } from '@/components/domain/main/calculator-sheet';
import { CurrencyPairCard, type PairSide } from '@/components/domain/main/currency-pair-card';
import type { QuickRecordInput } from '@/components/domain/main/quick-record';
import { RateGraph } from '@/components/domain/main/rate-graph';
import { PhraseCard } from '@/components/domain/main/phrase-card';
import { RecentCalcs } from '@/components/domain/main/recent-calcs';
import { TodaySummary } from '@/components/domain/main/today-summary';
import { TripHero } from '@/components/domain/main/trip-hero';
import { TripSheet, type TripSheetResult } from '@/components/domain/main/trip-sheet';
import { WeatherCard } from '@/components/domain/main/weather-card';
import { CountryList } from '@/components/domain/country-list';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { Toast } from '@/components/ui/toast';
import { countryNameOfCurrency, findCountryByCurrency } from '@/constants/currencies';
import { db } from '@/db';
import { expenses, trips } from '@/db/schema';
import { localDateKey, useActiveTrip } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { createTrip } from '@/lib/create-trip';
import { haptics } from '@/lib/haptics';
import { convertMinor, formatMoney, toMinor } from '@/lib/money';
import { useRate } from '@/lib/rates';
import { insertExpense } from '@/lib/save-expense';
import { useAppStore, type RecentCalc } from '@/store/app';

export default function MainScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    trip,
    trips: allTrips,
    phase,
    spentBase,
    daysLeft,
    dailyAvg,
    dailyAllowance,
    today,
    vsYesterdayPercent,
    expenses: tripExpenses,
    myParticipantId,
    baseCurrency,
    localCurrency: tripCurrency,
    homeCurrency,
    loading,
  } = useActiveTrip();
  const { pairSwapped, toggleSwap, recentCalcs, addRecentCalc, setHomeCurrency } = useAppStore();

  /**
   * 계산에 쓰는 현지 통화. 여행 기간의 기본값은 그 여행지의 통화다.
   * 다른 나라 통화로 바꿔서 계산하고 기록할 수는 있지만 저장하지 않는다 —
   * 다시 그리면 현재 여행의 통화로 돌아온다.
   */
  const [localCurrency, setLocalCurrency] = useState(tripCurrency);
  // 기본 표시 금액은 1이다 (1바트 = 43.42원)
  const [localMinor, setLocalMinor] = useState(() => toMinor(1, tripCurrency));

  useEffect(() => {
    setLocalCurrency(tripCurrency);
    setLocalMinor(toMinor(1, tripCurrency));
  }, [tripCurrency]);

  const quote = useRate(localCurrency, baseCurrency);
  const rate = quote?.rate ?? 0;

  // 예산은 DB에 항상 기준 통화로 저장된다 (지출 합계가 기준 통화라 그래야 계산이 맞는다).
  // 카드 표시 통화만 유저가 고른다 — 현지 통화면 여기서 환산해서 넘긴다.
  const budgetCurrency =
    rate && trip?.budgetCurrency === localCurrency ? localCurrency : baseCurrency;
  const toBudget = (baseMinor: number | null) =>
    baseMinor == null || budgetCurrency === baseCurrency
      ? baseMinor
      : convertMinor(baseMinor, baseCurrency, localCurrency, 1 / rate);

  const baseMinor = rate ? convertMinor(localMinor, localCurrency, baseCurrency, rate) : 0;

  const [calcSide, setCalcSide] = useState<PairSide | null>(null);
  /** 계산기를 열 때 채워둘 금액 (입력 통화 최소단위). 최근 계산 칩에서만 0이 아니다. */
  const [calcInitial, setCalcInitial] = useState(0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [currencySide, setCurrencySide] = useState<PairSide | null>(null);
  /** 방금 저장한 지출 — 되돌리기 토스트가 사는 동안만 있다 */
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  /** 저장이 예산 카드에 반영된 것을 눈으로 확인시키는 짧은 강조 */
  const [flashAt, setFlashAt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  if (loading) return <FullScreenLoader title="여행을 불러오는 중" />;

  /** 여행 중이 아니면 기록할 곳이 없다 — 계산은 되지만 저장은 막는다 */
  const canRecord = phase === 'during' && trip != null && myParticipantId != null;

  const openCalc = (side: PairSide, initialMinor = 0) => {
    if (!rate) return;
    haptics.selection();
    setCalcInitial(initialMinor);
    setCalcSide(side);
  };

  /**
   * 닫기는 아무것도 저장하지 않는다.
   * 금액을 입력하지 않고 닫았으면 페어 카드는 원래 값을 그대로 들고 있어야 한다.
   */
  const closeCalc = (result: CalcResult) => {
    setCalcSide(null);
    if (result.localMinor > 0) setLocalMinor(result.localMinor);
  };

  /**
   * 빠른 기록 — 카테고리를 탭한 순간 여기로 온다.
   * 확인 다이얼로그를 띄우지 않는다. 시트가 닫히는 것 자체가 피드백이고,
   * 잘못 누른 것은 되돌리기 토스트가 받는다.
   */
  const saveExpense = async (result: CalcResult, input: QuickRecordInput) => {
    if (!quote || !trip || !myParticipantId) return;
    setCalcSide(null);
    setLocalMinor(result.localMinor);

    const id = await insertExpense({
      tripId: trip.id,
      authorId: myParticipantId,
      localCurrency,
      baseCurrency,
      quote,
      result,
      input,
    });

    // 최근 계산은 "기록한 것"만 남긴다 (계산만 하고 닫은 금액은 남기지 않는다)
    addRecentCalc({
      amount: result.localMinor,
      currency: localCurrency,
      baseAmount: result.baseMinor,
      baseCurrency,
      rate: quote.rate,
      rateDate: quote.date,
    });

    haptics.notification();
    setFlashAt(Date.now());
    setSaved({
      id,
      message: `${input.categoryIcon} ${input.categoryName} · ${formatMoney(result.localMinor, localCurrency)} 저장`,
    });
  };

  /** 되돌리기 — tombstone으로 지운다 (물리 삭제하면 동기화 때 되살아난다) */
  const undoSave = async () => {
    if (!saved) return;
    const now = Date.now();
    await db
      .update(expenses)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(expenses.id, saved.id));
    setSaved(null);
  };

  const recordFromChip = (calc: RecentCalc) => {
    router.push({
      pathname: '/expense',
      params: {
        amount: String(calc.amount),
        currency: calc.currency,
        baseAmount: String(calc.baseAmount),
        baseCurrency: calc.baseCurrency,
        rate: String(calc.rate),
        rateDate: calc.rateDate,
      },
    });
  };

  /** budgetMinor는 이미 추가/삭감이 반영된 기준 통화 총액이다. 기간은 여기서 바뀌지 않는다. */
  const saveBudget = async ({
    budgetMinor,
    budgetCurrency: displayCurrency,
  }: {
    budgetMinor: number | null;
    budgetCurrency: string;
  }) => {
    if (!trip) return;
    await db
      .update(trips)
      .set({
        budgetAmount: budgetMinor,
        budgetCurrency: budgetMinor != null ? displayCurrency : null,
        updatedAt: Date.now(),
      })
      .where(eq(trips.id, trip.id));

    setBudgetOpen(false);
  };

  const addTrip = async (result: TripSheetResult) => {
    const country = findCountryByCurrency(result.destinationCurrency);
    if (!country) return;
    setTripOpen(false);
    await createTrip({
      country,
      baseCurrency,
      startDate: result.startDate,
      endDate: result.endDate,
      budgetAmount: result.budgetMinor,
      budgetCurrency: result.budgetCurrency,
    });
    haptics.notification();
    setToast(`${country.nameKo} 여행을 만들었어요`);
  };

  /**
   * 현지 통화 변경은 이 화면에서만 유효하다 (다시 그리면 여행지 통화로 돌아온다).
   * 기준 통화는 유저 본인 통화라 저장한다 — 여행이 있으면 그 여행에도 맞춘다.
   */
  const changeCurrency = async (side: PairSide, currency: string) => {
    setCurrencySide(null);
    if (side === 'local') {
      setLocalCurrency(currency);
      setLocalMinor(toMinor(1, currency));
      return;
    }
    setHomeCurrency(currency);
    if (trip) {
      await db
        .update(trips)
        .set({ baseCurrency: currency, updatedAt: Date.now() })
        .where(eq(trips.id, trip.id));
    }
  };

  const pairCard = (
    <CurrencyPairCard
      localCurrency={localCurrency}
      baseCurrency={baseCurrency}
      localMinor={localMinor}
      baseMinor={baseMinor}
      swapped={pairSwapped}
      rateDate={quote?.date ?? null}
      onSwap={toggleSwap}
      onPressAmount={openCalc}
      onPressCurrency={setCurrencySide}
    />
  );

  const recent = (
    <RecentCalcs
      items={recentCalcs}
      // 칩의 금액을 그대로 들고 계산기가 열린다 (통화가 바뀐 뒤의 옛 칩만 빈 상태로)
      onPress={(calc) => openCalc('local', calc.currency === localCurrency ? calc.amount : 0)}
      onLongPress={recordFromChip}
    />
  );

  /** 여행 기간이 아니면 예산 자리는 "여행지 추가하기"다 */
  const upcomingLabel =
    phase === 'before' && trip?.startDate
      ? `다음 여행 ${countryNameOfCurrency(trip.destinationCurrency)} · ${trip.startDate}`
      : null;

  const budget =
    phase === 'during' && trip ? (
      <BudgetCard
        budgetAmount={toBudget(trip.budgetAmount)}
        currency={budgetCurrency}
        spentBase={toBudget(spentBase) ?? spentBase}
        dailyAvg={toBudget(dailyAvg)}
        daysLeft={daysLeft}
        dailyAllowance={toBudget(dailyAllowance)}
        flashAt={flashAt}
        onPress={() => {
          haptics.selection();
          setBudgetOpen(true);
        }}
      />
    ) : (
      <AddTripCard
        nextTripLabel={upcomingLabel}
        onPress={() => {
          haptics.selection();
          setTripOpen(true);
        }}
      />
    );

  // 여행이 끝났으면 전체, 아니면 오늘 것만
  const summaryItems =
    phase === 'after'
      ? tripExpenses
      : tripExpenses.filter((e) => localDateKey(e.occurredAt) === localDateKey(Date.now()));

  const summary = (
    <TodaySummary
      items={summaryItems}
      count={phase === 'after' ? tripExpenses.length : today.count}
      localMinor={today.local}
      localCurrency={tripCurrency}
      baseMinor={phase === 'after' ? spentBase : today.base}
      baseCurrency={baseCurrency}
      vsYesterdayPercent={phase === 'after' ? null : vsYesterdayPercent}
      label={phase === 'after' ? '여행 전체' : '오늘'}
      onPress={() => router.push('/timeline')}
    />
  );

  const graph = (
    <RateGraph
      localCurrency={localCurrency}
      baseCurrency={baseCurrency}
      defaultExpanded={phase !== 'during'}
    />
  );

  const hero = (
    <TripHero
      localCurrency={tripCurrency}
      phase={phase}
      startDate={trip?.startDate ?? null}
      endDate={trip?.endDate ?? null}
      spentBase={toBudget(spentBase) ?? spentBase}
      budgetAmount={toBudget(trip?.budgetAmount ?? null)}
      budgetCurrency={budgetCurrency}
      daysLeft={daysLeft}
      expenseCount={tripExpenses.length}
      onAddTrip={() => {
        haptics.selection();
        setTripOpen(true);
      }}
    />
  );

  // 여행 중일 때만 현지 날씨다. 그 밖에는 내가 사는 나라(온보딩에서 고른 통화) 날씨를 본다.
  const weather = (
    <WeatherCard localCurrency={phase === 'during' ? tripCurrency : homeCurrency} />
  );
  // 회화는 갈 곳이 있을 때만 의미가 있다
  const phrases = trip ? <PhraseCard /> : null;

  // 섹션은 동일하고 순서와 강조만 바뀐다 (여행 단계에 따른 모드)
  const sections = (
    phase === 'during'
      ? [hero, pairCard, recent, budget, weather, phrases, graph, summary]
      : phase === 'after'
        ? [hero, pairCard, budget, graph, phrases, summary]
        : [hero, pairCard, graph, budget, weather, phrases, recent]
  ).filter(Boolean);

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 20,
        }}
      >
        {sections.map((section, i) => (
          <View key={i}>{section}</View>
        ))}
      </ScrollView>

      {/* 하단 중앙 배지 — 스크롤과 무관하게 항상 떠 있다 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="환율 계산하기"
        onPress={() => openCalc('local')}
        style={{ backgroundColor: scheme.primary, bottom: insets.bottom + 20 }}
        className="absolute self-center rounded-full px-6 py-3 active:opacity-80"
      >
        <Text style={{ color: scheme.primaryForeground }} className="text-base font-bold">
          환율 계산하기
        </Text>
      </Pressable>

      {/* 되돌리기 토스트 — 저장 확인 알럿 대신이다 */}
      <Toast
        message={saved?.message ?? null}
        duration={5000}
        actions={[
          {
            label: '수정',
            onPress: () => {
              const id = saved?.id;
              setSaved(null);
              if (id) router.push({ pathname: '/expense', params: { id } });
            },
          },
          { label: '취소', onPress: () => void undoSave() },
        ]}
        onHide={() => setSaved(null)}
      />

      <Toast message={toast} onHide={() => setToast(null)} />

      <CalculatorSheet
        visible={calcSide != null}
        side={calcSide ?? 'local'}
        localCurrency={localCurrency}
        baseCurrency={baseCurrency}
        rate={rate}
        initialMinor={calcInitial}
        tripId={trip?.id ?? ''}
        expenses={tripExpenses}
        canRecord={canRecord}
        onClose={closeCalc}
        onSave={saveExpense}
      />

      {trip ? (
        <BudgetSheet
          visible={budgetOpen}
          baseCurrency={baseCurrency}
          localCurrency={localCurrency}
          rate={rate}
          budgetAmount={trip.budgetAmount}
          budgetCurrency={trip.budgetCurrency}
          onClose={() => setBudgetOpen(false)}
          onSubmit={saveBudget}
        />
      ) : null}

      <TripSheet
        visible={tripOpen}
        baseCurrency={baseCurrency}
        trips={allTrips}
        onClose={() => setTripOpen(false)}
        onSubmit={addTrip}
      />

      <BottomSheet
        visible={currencySide != null}
        onClose={() => setCurrencySide(null)}
        sheetClassName="h-[75%]"
      >
        <View
          style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
          className="flex-1 rounded-t-3xl px-5 pt-6"
        >
          <Text className="mb-4 text-xl font-black text-neutral-900 dark:text-neutral-50">
            {currencySide === 'base' ? '기준 통화' : '현지 통화'}
          </Text>
          <CountryList
            selectedCurrency={currencySide === 'base' ? baseCurrency : localCurrency}
            onSelect={(country) => {
              if (currencySide) void changeCurrency(currencySide, country.currency);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
