import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryList } from '@/components/domain/country-list';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { flagOfDestination, type CountryInfo } from '@/constants/currencies';
import type { Trip } from '@/db/schema';
import { localDateKey } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { currencyUnit, destinationLabel, formatMoneyI18n, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { toMinor } from '@/lib/money';
import { useRate } from '@/lib/rates';
import { findOverlap } from '@/lib/trip-dates';
import {
  AmountField,
  DateField,
  DisplayCurrencyRow,
  daysOfRange,
  parseAmount,
  parseKey,
  showAmount,
} from './budget-fields';

export type TripSheetResult = {
  /** 여행하는 나라의 통화 */
  destinationCurrency: string;
  /** 여행하는 나라. EUR처럼 통화가 같은 나라의 표시/히어로 구분용 */
  destinationCountryCode: string | null;
  /** 'YYYY-MM-DD'. 둘 다 필수다 */
  startDate: string;
  endDate: string;
  /** 기준 통화 최소단위 총액. 비워두면 null */
  budgetMinor: number | null;
  budgetCurrency: string;
};

type FormProps = {
  /** 기준 통화 — 유저 본인 통화. 예산은 항상 이 통화로 저장된다 */
  baseCurrency: string;
  /** 기간 겹침 검사 대상 (삭제되지 않은 전체 여행) */
  trips: Trip[];
  /** 수정할 여행. 없으면 새로 만드는 것이다 */
  trip?: Trip | null;
  /** 주면 제목 왼쪽에 뒤로가기가 붙는다 (다른 화면 위에 얹어 쓸 때) */
  onBack?: () => void;
  onSubmit: (result: TripSheetResult) => void;
};

/**
 * 여행 입력 폼 — 시트가 아니라 내용만이다.
 *
 * 시트를 자체적으로 열지 않는다. RN Modal이 겹쳐 뜨면 투명한 모달이 화면에 남아
 * 터치를 전부 먹어버려서(먹통), 나라 선택도 새 모달이 아니라 이 화면을 갈아끼운다.
 *
 * 값 초기화는 마운트 때 한 번만 한다 — 다시 채우고 싶으면 호출부가 key를 바꾼다.
 *
 * 기간은 필수다. 활성 여행을 저장된 id가 아니라 오늘 날짜로 고르기 때문에
 * (lib/trip-dates) 기간이 없으면 그 여행은 영원히 화면에 뜨지 않는다.
 *
 * 기간은 다른 여행과 하루도 겹칠 수 없다 — 겹치면 "지금 어느 여행인가"의 답이 둘이 된다.
 */
export function TripForm({ baseCurrency, trips, trip, onBack, onSubmit }: FormProps) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();

  const [currency, setCurrency] = useState<string | null>(trip?.destinationCurrency ?? null);
  const [countryCode, setCountryCode] = useState<string | null>(
    trip?.destinationCountryCode ?? null,
  );
  const [start, setStart] = useState<Date | null>(
    trip?.startDate ? parseKey(trip.startDate) : null,
  );
  const [end, setEnd] = useState<Date | null>(trip?.endDate ? parseKey(trip.endDate) : null);
  const [baseText, setBaseText] = useState(
    trip?.budgetAmount ? showAmount(trip.budgetAmount, baseCurrency) : '',
  );
  const [localText, setLocalText] = useState('');
  const [showInLocal, setShowInLocal] = useState(
    (trip?.budgetCurrency ?? trip?.destinationCurrency) !== baseCurrency,
  );
  const [pickingCountry, setPickingCountry] = useState(false);

  const localCurrency = currency ?? baseCurrency;
  const quote = useRate(localCurrency, baseCurrency);
  const rate = quote?.rate ?? 0;

  const baseUnit = currencyUnit(baseCurrency, t);
  const localUnit = currencyUnit(localCurrency, t);
  const baseMoney = (minor: number) => formatMoneyI18n(minor, baseCurrency, t, resolvedLanguage);

  const changeBase = (text: string) => {
    setBaseText(text);
    const value = parseAmount(text);
    setLocalText(rate > 0 ? showAmount(value / rate, localCurrency) : '');
  };

  const budgetMinor = toMinor(
    parseAmount(baseText) || (rate > 0 ? parseAmount(localText) * rate : 0),
    baseCurrency,
  );

  const days = daysOfRange(start, end);
  const startKey = start ? localDateKey(start.getTime()) : null;
  const endKey = end ? localDateKey(end.getTime()) : null;

  const conflict =
    startKey && endKey && days != null ? findOverlap(trips, startKey, endKey, trip?.id) : null;

  const ready = currency != null && startKey != null && endKey != null && days != null && !conflict;

  const selectCountry = (country: CountryInfo) => {
    haptics.selection();
    setCurrency(country.currency);
    setCountryCode(country.code);
    // 통화가 바뀌면 환율이 달라진다 — 현지 환산액은 다시 받는다
    setLocalText('');
    setPickingCountry(false);
  };

  if (pickingCountry) {
    // minHeight: 높이가 없는 시트(메인) 안에서도 목록이 접히지 않게
    return (
      <View className="flex-1" style={{ minHeight: 420 }}>
        <FormHeader
          title={t('main.whereAreYouGoing', '어디로 가세요?')}
          onBack={() => setPickingCountry(false)}
        />
        <CountryList
          selectedCurrency={currency ?? undefined}
          selectedCountryCode={countryCode ?? undefined}
          onSelect={selectCountry}
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ maxHeight: 520 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 20, paddingBottom: 16 }}
      >
        <View>
          <FormHeader
            title={
              trip ? t('main.editTrip', '여행 수정') : t('main.addTripDestination', '여행지 추가')
            }
            onBack={onBack}
          />
          <Text className="mt-1 text-sm font-semibold text-neutral-400">
            {t('main.tripAutoSwitch', '기간이 오면 이 여행으로 자동으로 바뀌어요')}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="pl-1 text-sm font-bold text-neutral-500 dark:text-neutral-400">
            {t('main.travelCountry', '여행하는 나라')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('main.pickTravelCountryA11y', '여행하는 나라 선택')}
            onPress={() => {
              haptics.selection();
              setPickingCountry(true);
            }}
            style={{ backgroundColor: scheme.muted }}
            className="h-14 flex-row items-center justify-between rounded-2xl px-4 active:opacity-70"
          >
            <Text className="text-base font-bold text-neutral-500 dark:text-neutral-400">
              {t('main.country', '나라')}
            </Text>
            <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
              {currency
                ? `${flagOfDestination(countryCode, currency)} ${destinationLabel(countryCode, currency, t)}`
                : t('main.select', '선택')}
            </Text>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="pl-1 text-sm font-bold text-neutral-500 dark:text-neutral-400">
            {t('main.tripPeriod', '여행 기간')}
          </Text>
          <DateField label={t('main.startDate', '시작일')} value={start} onChange={setStart} />
          <DateField
            label={t('main.endDate', '종료일')}
            value={end}
            minimumDate={start ?? undefined}
            onChange={setEnd}
          />
          {conflict ? (
            <Text className="pl-1 text-xs font-bold" style={{ color: scheme.destructive }}>
              {t('main.tripConflict', '{{country}} 여행({{start}} – {{end}})과 기간이 겹쳐요', {
                country: destinationLabel(
                  conflict.destinationCountryCode,
                  conflict.destinationCurrency,
                  t,
                ),
                start: conflict.startDate ?? '',
                end: conflict.endDate ?? '',
              })}
            </Text>
          ) : (
            <Text className="pl-1 text-xs font-semibold text-neutral-400">
              {days != null
                ? t('main.tripDays', '{{days}}일 여행', { days })
                : t('main.pickBothDates', '시작일과 종료일을 모두 정해주세요')}
            </Text>
          )}
        </View>

        {/* 예산은 만들 때만 받는다 — 그 뒤로는 예산 조정 시트에서 추가/삭감으로만 바꾼다 */}
        {trip ? null : (
          <>
            <View className="gap-2">
              <Text className="pl-1 text-sm font-bold text-neutral-500 dark:text-neutral-400">
                {t('main.budgetOptional', '예산 (선택)')}
              </Text>
              <AmountField
                unit={baseUnit}
                currency={baseCurrency}
                value={baseText}
                onChangeText={changeBase}
              />
              <AmountField
                unit={localUnit}
                currency={localCurrency}
                value={localText}
                onChangeText={setLocalText}
                disabled={rate <= 0}
              />
              {budgetMinor > 0 && days != null ? (
                <Text className="pl-1 text-xs font-bold" style={{ color: scheme.primary }}>
                  {t('main.perDayBudget', '하루 {{amount}} 꼴이에요', {
                    amount: baseMoney(Math.round(budgetMinor / days)),
                  })}
                </Text>
              ) : null}
            </View>

            <DisplayCurrencyRow
              showInLocal={showInLocal}
              localCurrency={localCurrency}
              baseCurrency={baseCurrency}
              disabled={rate <= 0 || currency == null}
              onChange={setShowInLocal}
            />
          </>
        )}
      </ScrollView>

      <Button
        label={trip ? t('common.save', '저장') : t('main.addTripButton', '여행 추가')}
        disabled={!ready}
        onPress={() => {
          if (!ready || !startKey || !endKey || !currency) return;
          onSubmit({
            destinationCurrency: currency,
            destinationCountryCode: countryCode,
            startDate: startKey,
            endDate: endKey,
            // 수정이면 예산은 손대지 않는다 (예산 조정 시트 전용)
            budgetMinor: trip ? trip.budgetAmount : budgetMinor > 0 ? budgetMinor : null,
            budgetCurrency: trip
              ? (trip.budgetCurrency ?? baseCurrency)
              : showInLocal && rate > 0
                ? currency
                : baseCurrency,
          });
        }}
      />
    </>
  );
}

/** 제목 한 줄. onBack이 있으면 왼쪽에 뒤로가기가 붙는다. */
export function FormHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { scheme } = useTheme();
  const { t } = useI18n();

  return (
    <View className="flex-row items-center gap-1">
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('main.backA11y', '뒤로')}
          onPress={() => {
            haptics.selection();
            onBack();
          }}
          className="-ml-2 p-2 active:opacity-60"
        >
          <ChevronLeft size={22} color={scheme.foreground} />
        </Pressable>
      ) : null}
      <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">{title}</Text>
    </View>
  );
}

/** 여행 추가/수정 시트 — 폼을 하단 시트로 감싸기만 한다. */
export function TripSheet({
  visible,
  onClose,
  ...form
}: FormProps & { visible: boolean; onClose: () => void }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View
        style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
        className="rounded-t-3xl px-5 pt-6"
      >
        {/* 열 때마다 값을 여행에서 다시 채운다 (폼은 마운트 때 한 번만 초기화한다) */}
        <TripForm key={`${visible}-${form.trip?.id ?? 'new'}`} {...form} />
      </View>
    </BottomSheet>
  );
}
