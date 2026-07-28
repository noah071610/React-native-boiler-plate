import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { currencyUnit, formatMoneyI18n, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { toMinor } from '@/lib/money';
import {
  AmountField,
  DisplayCurrencyRow,
  ModeChip,
  parseAmount,
  showAmount,
} from './budget-fields';

type Mode = 'add' | 'cut';

type Props = {
  visible: boolean;
  /** 기준(메인) 통화 — 예산은 항상 이 통화의 최소단위로 저장된다 */
  baseCurrency: string;
  /** 현지(서브) 통화 */
  localCurrency: string;
  /** 1 localCurrency = rate baseCurrency */
  rate: number;
  /** 기준 통화 최소단위. 미설정이면 null */
  budgetAmount: number | null;
  /** 카드에 어느 통화로 보여줄지. 미설정이면 서브 통화가 기본이다 */
  budgetCurrency: string | null;
  onClose: () => void;
  onSubmit: (input: {
    /** 기준 통화 최소단위 총액 (증감이 아니라 반영된 결과) */
    budgetMinor: number | null;
    budgetCurrency: string;
  }) => void;
};

/**
 * 예산 시트 — 진행 중인 여행의 예산만 손댄다.
 *
 * 여행 기간은 여기서 못 바꾼다. 기간은 여행을 만들 때 정해지고 (trip-sheet),
 * 기간이 곧 "지금 어느 여행인가"를 결정하기 때문에 진행 중에 흔들리면 안 된다.
 *
 * 저장값은 항상 기준 통화 최소단위다 (지출 합계가 기준 통화라 그래야 계산이 맞는다).
 * 예산이 이미 있으면 덮어쓰지 않는다 — 추가하거나 삭감한다.
 */
export function BudgetSheet({
  visible,
  baseCurrency,
  localCurrency,
  rate,
  budgetAmount,
  budgetCurrency,
  onClose,
  onSubmit,
}: Props) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const insets = useSafeAreaInsets();

  const hasBudget = budgetAmount != null && budgetAmount > 0;

  const [mode, setMode] = useState<Mode>('add');
  const [baseText, setBaseText] = useState('');
  const [localText, setLocalText] = useState('');
  /** true면 카드를 현지 통화로 본다 (여행지에서 쓰는 통화가 기본) */
  const [showInLocal, setShowInLocal] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setMode('add');
    // 첫 설정이면 총액을, 이미 있으면 증감액을 입력받는다 — 어느 쪽이든 빈 칸에서 시작한다
    setBaseText('');
    setLocalText('');
    setShowInLocal((budgetCurrency ?? localCurrency) !== baseCurrency);
  }, [visible, budgetCurrency, localCurrency, baseCurrency]);

  const baseUnit = currencyUnit(baseCurrency, t);
  const localUnit = currencyUnit(localCurrency, t);
  const baseMoney = (minor: number) => formatMoneyI18n(minor, baseCurrency, t, resolvedLanguage);

  /** 기준 통화를 먼저 받는다. 현지 통화는 따라 계산되고, 그 뒤에 직접 고칠 수 있다. */
  const changeBase = (text: string) => {
    setBaseText(text);
    const value = parseAmount(text);
    setLocalText(rate > 0 ? showAmount(value / rate, localCurrency) : '');
  };

  // 기준 금액을 비워둔 채 현지 금액만 넣었으면 환율로 되돌려 저장한다 (저장은 항상 기준 통화)
  const enteredMinor = toMinor(
    parseAmount(baseText) || (rate > 0 ? parseAmount(localText) * rate : 0),
    baseCurrency,
  );
  const nextMinor = !hasBudget
    ? enteredMinor
    : mode === 'add'
      ? (budgetAmount ?? 0) + enteredMinor
      : Math.max(0, (budgetAmount ?? 0) - enteredMinor);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View
        style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
        className="rounded-t-3xl px-5 pt-6"
      >
        <ScrollView
          // 시트가 화면을 다 먹지 않게 스크롤 영역만 잘라둔다 (저장 버튼은 항상 보인다)
          style={{ maxHeight: 460 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 20, paddingBottom: 16 }}
        >
          <View>
            <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">
              {hasBudget
                ? t('main.adjustBudget', '예산 조정')
                : t('main.tripBudget', '이번 여행 예산')}
            </Text>
            <Text className="mt-1 text-sm font-semibold text-neutral-400">
              {hasBudget
                ? t('main.currentBudget', '지금 예산 {{amount}}', {
                    amount: baseMoney(budgetAmount ?? 0),
                  })
                : t(
                    'main.budgetSheetDescription',
                    '정확하지 않아도 괜찮아요. 나중에 바꿀 수 있어요.',
                  )}
            </Text>
          </View>

          {hasBudget ? (
            <View className="flex-row gap-2">
              <ModeChip
                label={t('main.addAmount', '➕ 추가')}
                selected={mode === 'add'}
                onPress={() => {
                  haptics.selection();
                  setMode('add');
                }}
              />
              <ModeChip
                label={t('main.cutAmount', '➖ 삭감')}
                selected={mode === 'cut'}
                onPress={() => {
                  haptics.selection();
                  setMode('cut');
                }}
              />
            </View>
          ) : null}

          <View className="gap-2">
            <Text className="pl-1 text-sm font-bold text-neutral-500 dark:text-neutral-400">
              {hasBudget
                ? mode === 'add'
                  ? t('main.howMuchMore', '얼마나 더 쓸까요')
                  : t('main.howMuchLess', '얼마나 줄일까요')
                : t('settings.budget', '예산')}
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
            {hasBudget && enteredMinor > 0 ? (
              <Text className="pl-1 text-xs font-bold" style={{ color: scheme.primary }}>
                {baseMoney(budgetAmount ?? 0)} → {baseMoney(nextMinor)}
              </Text>
            ) : null}
          </View>

          <DisplayCurrencyRow
            showInLocal={showInLocal}
            localCurrency={localCurrency}
            baseCurrency={baseCurrency}
            disabled={rate <= 0}
            onChange={setShowInLocal}
          />
        </ScrollView>

        <Button
          label={
            hasBudget
              ? mode === 'add'
                ? t('main.addBudget', '예산 추가')
                : t('main.cutBudget', '예산 삭감')
              : t('common.save', '저장')
          }
          disabled={enteredMinor <= 0}
          onPress={() =>
            onSubmit({
              budgetMinor: nextMinor > 0 ? nextMinor : null,
              budgetCurrency: showInLocal && rate > 0 ? localCurrency : baseCurrency,
            })
          }
        />
      </View>
    </BottomSheet>
  );
}
