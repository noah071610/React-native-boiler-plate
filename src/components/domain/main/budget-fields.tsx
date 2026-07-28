import { useState } from 'react';
import { Keyboard, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { localDateKey } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { digitsOf, groupDigits } from '@/lib/money';

/** 예산 시트와 여행 시트가 같이 쓰는 입력 조각들. 두 시트의 입력감이 달라지면 안 된다. */

export const parseKey = (key: string | null): Date =>
  key ? new Date(`${key}T00:00:00`) : new Date();

export const parseAmount = (text: string): number => Number(text.replace(/,/g, '')) || 0;

/** 시각을 버린 그날 0시 (일수 계산은 날짜 단위로만 한다) */
export const midnight = (d: Date): number => Date.parse(`${localDateKey(d.getTime())}T00:00:00`);

/** 두 날짜 사이의 일수 (양끝 포함). 순서가 뒤집혔으면 null */
export const daysOfRange = (start: Date | null, end: Date | null): number | null => {
  if (!start || !end) return null;
  const days = Math.round((midnight(end) - midnight(start)) / 86_400_000) + 1;
  return days > 0 ? days : null;
};

/**
 * 숫자·소수점만 남긴다. 소수점은 하나까지, 소수 자리는 통화가 허용하는 만큼만.
 * 정수 통화(원)는 소수점 자체를 받지 않는다.
 */
export const sanitizeAmount = (text: string, digits: number): string => {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (digits === 0) return cleaned.replace(/\./g, '');
  const [intPart, ...rest] = cleaned.split('.');
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join('').slice(0, digits)}`;
};

/** 통화 소수 자리에 맞춰 자른 문자열. 빈 값은 빈 문자열로 남긴다 (0을 강제로 채우지 않는다) */
export const showAmount = (value: number, currency: string): string =>
  value > 0 ? String(Number(value.toFixed(digitsOf(currency)))) : '';

export function AmountField({
  unit,
  currency,
  value,
  onChangeText,
  disabled,
}: {
  unit: string;
  currency: string;
  value: string;
  onChangeText: (text: string) => void;
  disabled?: boolean;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={{ backgroundColor: scheme.muted, height: 56, opacity: disabled ? 0.5 : 1 }}
      className="flex-row items-center rounded-2xl px-4"
    >
      <TextInput
        // 보기에만 천단위 구분을 넣는다 — 부모가 들고 있는 값은 구분자 없는 원본이다
        value={value ? groupDigits(value) : ''}
        onChangeText={(text) => onChangeText(sanitizeAmount(text, digitsOf(currency)))}
        editable={!disabled}
        // 소수 통화는 소수점이 필요하다 (밧·달러)
        keyboardType={digitsOf(currency) === 0 ? 'number-pad' : 'decimal-pad'}
        placeholder="0"
        placeholderTextColor={scheme.mutedForeground}
        accessibilityLabel={t('main.amountA11y', '{{currency}} 금액', { currency })}
        // text-lg 같은 tailwind 크기는 lineHeight까지 같이 붙는데, 한 줄짜리 TextInput은
        // lineHeight가 폰트보다 크면 글자를 줄 상자 아래로 밀어낸다. fontSize만 직접 준다.
        style={{
          padding: 0,
          fontSize: 18,
          textAlignVertical: 'center',
          includeFontPadding: false,
        }}
        className="flex-1 font-bold text-neutral-900 dark:text-neutral-50"
      />
      <Text className="pl-2 text-base font-bold text-neutral-400">{unit}</Text>
    </View>
  );
}

/**
 * 날짜 한 줄.
 *
 * 네이티브 피커(@expo/ui DateTimePicker)는 쓰지 않는다. SwiftUI Host가 matchContents로
 * 자기 측정 높이를 shadow node에 나중에 덮어써서, 시트 안에 넣으면 처음엔 잘려 뜨고
 * 레이아웃이 다시 돌 때 위로 튀어오른다 (달력도 그 과정에서 흔들린다).
 * 앱에 이미 있는 순수 JS 달력을 쓴다 — 네이티브 측정이 없으니 열리는 순간 높이가 확정이다.
 */
export function DateField({
  label,
  value,
  minimumDate,
  onChange,
}: {
  label: string;
  value: Date | null;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => localDateKey((value ?? new Date()).getTime()));

  const openPicker = () => {
    haptics.selection();
    // 위쪽 금액 입력에서 바로 넘어오면 키보드가 떠 있다. 먼저 내려야 시트가
    // 사라지는 키보드 높이만큼 어긋난 채로 뜨지 않는다.
    Keyboard.dismiss();
    setDraft(localDateKey((value ?? minimumDate ?? new Date()).getTime()));
    setOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('main.selectFieldA11y', '{{label}} 선택', { label })}
        onPress={openPicker}
        style={{ backgroundColor: scheme.muted }}
        className="h-14 flex-row items-center justify-between rounded-2xl px-4 active:opacity-70"
      >
        <Text className="text-base font-bold text-neutral-500 dark:text-neutral-400">{label}</Text>
        <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
          {value ? `🗓 ${localDateKey(value.getTime())}` : t('main.select', '선택')}
        </Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} avoidKeyboard={false}>
        <View
          style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
          className="gap-4 rounded-t-3xl px-5 pt-6"
        >
          <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">{label}</Text>
          <Calendar
            selectedDate={draft}
            onSelectDate={setDraft}
            minDate={minimumDate ? localDateKey(minimumDate.getTime()) : undefined}
            showModeToggle={false}
          />
          <Button
            label={t('common.done', '완료')}
            onPress={() => {
              onChange(parseKey(draft));
              setOpen(false);
            }}
          />
        </View>
      </BottomSheet>
    </>
  );
}

export function ModeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        backgroundColor: selected ? scheme.primarySoft : scheme.secondary,
        borderColor: selected ? scheme.primary : 'transparent',
      }}
      className="flex-1 items-center rounded-full border-2 py-2.5 active:opacity-70"
    >
      <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-200">{label}</Text>
    </Pressable>
  );
}

/** 예산 표시 통화 스위치 — 현지 통화로 볼지, 기준 통화로 볼지 */
export function DisplayCurrencyRow({
  showInLocal,
  localCurrency,
  baseCurrency,
  disabled,
  onChange,
}: {
  showInLocal: boolean;
  localCurrency: string;
  baseCurrency: string;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  return (
    <View className="gap-2">
      <Text className="pl-1 text-sm font-bold text-neutral-500 dark:text-neutral-400">
        {t('main.budgetDisplayCurrency', '예산 표시 통화')}
      </Text>
      {/* 네이티브 Switch 높이가 플랫폼마다 달라 높이를 고정하지 않는다 */}
      <View
        style={{ backgroundColor: scheme.muted, minHeight: 52 }}
        className="flex-row items-center justify-between rounded-2xl px-4 py-2"
      >
        <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
          {showInLocal
            ? t('main.localCurrencyWithCode', '현지 통화 ({{currency}})', {
                currency: localCurrency,
              })
            : t('main.baseCurrencyWithCode', '기준 통화 ({{currency}})', {
                currency: baseCurrency,
              })}
        </Text>
        <Switch
          value={showInLocal}
          trackColor={{ true: scheme.primary, false: scheme.mutedForeground }}
          style={{ alignSelf: 'center' }}
          disabled={disabled}
          onValueChange={(next) => {
            haptics.selection();
            onChange(next);
          }}
        />
      </View>
    </View>
  );
}
