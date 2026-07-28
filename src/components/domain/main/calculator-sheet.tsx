import { ArrowUpDown, Delete, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flagOfDestination } from '@/constants/currencies';
import type { Expense } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { destinationLabel, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { convertMinor, digitsOf, formatAmount, fromMinor, groupDigits, toMinor } from '@/lib/money';
import type { PairSide } from './currency-pair-card';
import { QuickRecord, type QuickRecordInput } from './quick-record';

type Op = '+' | '-' | '×' | '÷';

export type CalcResult = { localMinor: number; baseMinor: number };

type Props = {
  visible: boolean;
  side: PairSide;
  localCurrency: string;
  localCountryCode?: string | null;
  baseCurrency: string;
  /** 1 localCurrency = rate baseCurrency */
  rate: number;
  /** 열 때 채워둘 금액 (입력 통화 최소단위). 0이면 빈 상태로 연다. */
  initialMinor?: number;
  /** 빠른 기록 패널이 쓰는 값 */
  tripId: string;
  expenses: Expense[];
  /** 지금 기록할 여행이 있는가 (지난 여행뿐이면 계산만 된다). 기본값 true */
  canRecord?: boolean;
  /** 빠른 기록 패널 맨 위에 띄울 안내 (출발 전 기록처럼 대상이 헷갈릴 때) */
  notice?: string | null;
  /** 수정 모드 — 빠른 기록 패널을 기존 지출 값으로 채워 연다 */
  initialInput?: Partial<QuickRecordInput>;
  saveLabel?: string;
  onClose: (result: CalcResult) => void;
  onSave: (result: CalcResult, input: QuickRecordInput) => void;
};

/** iOS 계산기와 같은 3열 숫자 배치 (오른쪽 연산자 열은 따로 그린다) */
const NUMBER_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
];

const OPERATORS: Op[] = ['÷', '×', '-', '+'];

/**
 * 금액 태그 단축키. 통화의 체감 단위가 다르므로 소수 자리로 가른다.
 * 원·엔·동처럼 소수 0자리 통화는 천 단위부터, 밧·달러는 1단위부터.
 */
function shortcutsFor(currency: string): number[] {
  return digitsOf(currency) === 0 ? [1_000_000, 100_000, 10_000, 1_000] : [1_000, 100, 10, 1];
}

function shortcutLabel(value: number): string {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${value / 1_000}K`;
  return String(value);
}

function apply(a: number, b: number, op: Op): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return b === 0 ? a : a / b;
}

/** 지금 입력 중인 마지막 숫자 토큰 ("52+78" → "78", "52+" → "") */
function lastToken(expr: string): string {
  return expr.split(/[+\-×÷]/).pop() ?? '';
}

/** 우선순위 없이 왼쪽부터 순서대로 계산한다 (여행지 암산과 같은 순서). */
function evaluate(expr: string): number {
  const parts = expr.match(/\d+\.?\d*|[+\-×÷]/g) ?? [];
  let acc = Number(parts[0] ?? 0);
  for (let i = 1; i < parts.length; i += 2) {
    const operand = parts[i + 1];
    if (operand === undefined) break; // "52+" 처럼 끝난 식은 앞부분만 값으로 본다
    acc = apply(acc, Number(operand), parts[i] as Op);
  }
  return acc;
}

/** 식 전체를 천단위 구분해서 보여준다 ("52+7820" → "52+7,820") */
function formatExpr(expr: string): string {
  return expr.replace(/\d+\.?\d*/g, (n) => groupDigits(n));
}

/**
 * 계산기 — 전체 화면. 시스템 키보드가 아니라 자체 키패드다.
 * 오른쪽 열은 숫자를 입력하기 전에는 금액 단축키, 입력한 뒤에는 연산자로 바뀐다.
 * 여행 중 한 손으로 빠르게 두드리는 상황을 전제한다.
 */
export function CalculatorSheet({
  visible,
  side,
  localCurrency,
  localCountryCode,
  baseCurrency,
  rate,
  initialMinor = 0,
  tripId,
  expenses,
  canRecord = true,
  notice,
  initialInput,
  saveLabel,
  onClose,
  onSave,
}: Props) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [expr, setExpr] = useState('0');
  /** true면 키패드 자리가 카테고리 그리드로 교체된 상태 (화면 전환이 아니다) */
  const [picking, setPicking] = useState(false);
  /** 입력 통화를 반대쪽으로 뒤집은 상태 (열 때 준 side는 그대로 둔다) */
  const [flipped, setFlipped] = useState(false);

  const activeSide: PairSide = flipped ? (side === 'local' ? 'base' : 'local') : side;
  const inputCurrency = activeSide === 'local' ? localCurrency : baseCurrency;
  const inputCountryCode = activeSide === 'local' ? localCountryCode : null;
  const otherCurrency = activeSide === 'local' ? baseCurrency : localCurrency;

  // 계산기는 빈 상태에서 시작한다. 최근 계산 칩처럼 시작 금액을 준 경우에만 그것을 이어받는다.
  useEffect(() => {
    if (!visible) return;
    const startCurrency = side === 'local' ? localCurrency : baseCurrency;
    setExpr(initialMinor > 0 ? String(fromMinor(initialMinor, startCurrency)) : '0');
    setPicking(false);
    setFlipped(false);
  }, [visible, initialMinor, side, localCurrency, baseCurrency]);

  const value = evaluate(expr);
  const inputMinor = toMinor(value, inputCurrency);
  const otherMinor =
    activeSide === 'local'
      ? convertMinor(inputMinor, localCurrency, baseCurrency, rate)
      : convertMinor(inputMinor, baseCurrency, localCurrency, 1 / rate);

  const result: CalcResult =
    activeSide === 'local'
      ? { localMinor: inputMinor, baseMinor: otherMinor }
      : { localMinor: otherMinor, baseMinor: inputMinor };

  /** 입력 통화를 뒤집는다. 지금 보고 있는 환산 금액을 그대로 이어받아 값이 튀지 않는다. */
  const swap = () => {
    haptics.selection();
    setExpr(String(fromMinor(otherMinor, otherCurrency)));
    setFlipped((f) => !f);
  };

  const token = lastToken(expr);
  const shortcuts = shortcutsFor(inputCurrency);

  const press = (key: string) => {
    haptics.selection();

    if (key === 'AC') return setExpr('0');
    if (key === '⌫') return setExpr((e) => (e.length <= 1 ? '0' : e.slice(0, -1)));
    if (key === '=') {
      return setExpr(String(Number(evaluate(expr).toFixed(digitsOf(inputCurrency)))));
    }
    // ×2 — 흥정·인원수 계산에서 가장 자주 쓰는 배수라 한 키로 뺐다
    if (key === '×2') {
      return setExpr(String(Number((evaluate(expr) * 2).toFixed(digitsOf(inputCurrency)))));
    }
    // 원·엔처럼 소수 0자리 통화도 "÷3 후 ×1.5" 같은 중간 계산에 소수점이 필요하다.
    // 최종 금액은 toMinor가 통화 자리수로 반올림하므로 여기서 막지 않는다.
    if (key === '.') {
      return setExpr((e) => {
        const t = lastToken(e);
        if (t.includes('.')) return e;
        return `${e}${t === '' ? '0.' : '.'}`;
      });
    }
    // 숫자 — 앞자리 0은 새 숫자로 덮어쓴다
    setExpr((e) => {
      const next = token === '0' ? `${e.slice(0, e.length - 1)}${key}` : e + key;
      return next.length > 18 ? e : next;
    });
  };

  const pressOperator = (op: Op) =>
    setExpr((e) => {
      haptics.selection();
      // 연산자를 연달아 누르면 마지막 것만 남긴다
      return /[+\-×÷]$/.test(e) ? e.slice(0, -1) + op : e + op;
    });

  /** 태그는 그 자리에서 금액을 더한다 (1,000 두 번 = 2,000) */
  const pressShortcut = (amount: number) =>
    setExpr((e) => {
      haptics.selection();
      const current = lastToken(e);
      return e.slice(0, e.length - current.length) + String(Number(current || '0') + amount);
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose(result)}>
      <View
        style={{
          backgroundColor: scheme.background,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        }}
        className="flex-1 px-5"
      >
        {/* 미니멀 헤더 */}
        <View className="mb-2 flex-row items-center justify-between py-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">{flagOfDestination(inputCountryCode, inputCurrency)}</Text>

            <Text style={{ color: scheme.foreground }} className="text-base font-black">
              {destinationLabel(inputCountryCode, inputCurrency, t)} ({inputCurrency})
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('main.changeInputCurrencyA11y', '입력 통화 바꾸기')}
              onPress={swap}
              style={{ backgroundColor: scheme.secondary }}
              className="h-10 w-10 items-center justify-center rounded-full active:scale-95 active:opacity-70"
            >
              <ArrowUpDown size={18} color={scheme.foreground} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('main.closeCalculatorA11y', '계산기 닫기')}
              onPress={() => {
                haptics.selection();
                onClose(result);
              }}
              style={{ backgroundColor: scheme.secondary }}
              className="h-10 w-10 items-center justify-center rounded-full active:scale-95 active:opacity-70"
            >
              <X size={18} color={scheme.foreground} />
            </Pressable>
          </View>
        </View>

        {/* 대형 숫자 디스플레이 영역 */}
        <Pressable
          accessibilityRole={picking ? 'button' : 'none'}
          accessibilityLabel={t('main.editAmountA11y', '금액 고치기')}
          disabled={!picking}
          onPress={() => {
            haptics.selection();
            setPicking(false);
          }}
          className={picking ? 'gap-2 py-2' : 'flex-1 justify-end gap-3 pb-4'}
        >
          <View className="flex-row items-center gap-3">
            {/* 두 줄 사이 왼쪽 — 입력 통화 뒤집기 */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('main.changeInputCurrencyA11y', '입력 통화 바꾸기')}
              onPress={swap}
              style={{ backgroundColor: scheme.secondary }}
              className="h-12 w-12 items-center justify-center rounded-full active:scale-95 active:opacity-70"
            >
              <ArrowUpDown size={22} color={scheme.foreground} />
            </Pressable>

            <View className="flex-1 gap-3">
              {/* Main 입력 통화 - 거대한 폰트 */}
              <View className="flex-row items-baseline gap-2">
                {/* 0일 때도 같은 ExprLine을 쓴다. 구조가 갈리면 baseline 기준이 달라져 줄 전체가 밀린다. */}
                <View className="flex-1 items-end">
                  <ExprLine
                    text={formatExpr(expr)}
                    fade={scheme.background}
                    color={expr === '0' ? scheme.mutedForeground : scheme.foreground}
                    fontSizeClass={
                      picking ? 'text-4xl font-black' : 'text-6xl sm:text-7xl font-black'
                    }
                  />
                </View>
                <Text
                  style={{ color: scheme.mutedForeground }}
                  className="text-lg font-black tracking-wider"
                >
                  {inputCurrency}
                </Text>
              </View>

              {/* Sub 변환 통화 - 메인보다 한 톤 연하게 */}
              <View className="flex-row items-baseline gap-2">
                <View className="flex-1 flex-row items-center justify-end">
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ color: scheme.primary, opacity: 0.6 }}
                    className={picking ? 'text-3xl font-black' : 'text-5xl font-black sm:text-6xl'}
                  >
                    {formatAmount(otherMinor, otherCurrency)}
                  </Text>
                </View>
                <Text
                  style={{ color: scheme.primary, opacity: 0.6 }}
                  className="text-base font-black tracking-wider"
                >
                  {otherCurrency}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {picking ? (
          <QuickRecord
            tripId={tripId}
            expenses={expenses}
            notice={notice}
            initial={initialInput}
            saveLabel={saveLabel}
            onBack={() => setPicking(false)}
            onSave={(input) => onSave(result, input)}
          />
        ) : (
          <>
            {/* 금액 태그 단축키 */}
            <View className="mb-3 flex-row gap-2">
              {shortcuts.map((amount) => (
                <Pressable
                  key={amount}
                  accessibilityRole="button"
                  accessibilityLabel={t('main.addAmountA11y', '{{amount}} 더하기', {
                    amount: amount.toLocaleString('en-US'),
                  })}
                  onPress={() => pressShortcut(amount)}
                  style={{ backgroundColor: scheme.primarySoft }}
                  className="flex-1 items-center rounded-2xl py-2.5 active:scale-95 active:opacity-75"
                >
                  <Text style={{ color: scheme.primary }} className="text-base font-black">
                    +{shortcutLabel(amount)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 시원시원한 iOS 스타일 키패드 */}
            <View className="gap-2">
              <View className="flex-row gap-2">
                <Key
                  label="⌫"
                  onPress={() => press('⌫')}
                  background={scheme.secondary}
                  color={scheme.foreground}
                />
                <Key
                  label="AC"
                  onPress={() => press('AC')}
                  background={scheme.secondary}
                  color={scheme.foreground}
                />
                <Key
                  label="×2"
                  onPress={() => press('×2')}
                  background={scheme.secondary}
                  color={scheme.foreground}
                />
                <Key
                  label={OPERATORS[0]}
                  onPress={() => pressOperator(OPERATORS[0])}
                  background={scheme.primary}
                  color={scheme.primaryForeground}
                />
              </View>

              {NUMBER_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} className="flex-row gap-2">
                  {row.map((key) => (
                    <Key
                      key={key}
                      label={key}
                      onPress={() => press(key)}
                      background={scheme.muted}
                      color={scheme.foreground}
                    />
                  ))}
                  <Key
                    label={OPERATORS[rowIndex + 1]}
                    onPress={() => pressOperator(OPERATORS[rowIndex + 1])}
                    background={scheme.primary}
                    color={scheme.primaryForeground}
                  />
                </View>
              ))}

              <View className="flex-row gap-2">
                <Key
                  label="0"
                  flex={2}
                  onPress={() => press('0')}
                  background={scheme.muted}
                  color={scheme.foreground}
                />
                <Key
                  label="."
                  onPress={() => press('.')}
                  background={scheme.muted}
                  color={scheme.foreground}
                />
                <Key
                  label="="
                  onPress={() => press('=')}
                  background={scheme.primary}
                  color={scheme.primaryForeground}
                />
              </View>
            </View>

            {/* 메인 CTA 초대형 버튼 — 여행 기간이 아니면 기록할 여행이 없어 닫기로만 쓴다 */}
            <Pressable
              accessibilityRole="button"
              disabled={canRecord && result.localMinor <= 0}
              onPress={() => {
                if (!canRecord) {
                  haptics.selection();
                  return onClose(result);
                }
                haptics.impact();
                setPicking(true);
              }}
              style={{
                backgroundColor: scheme.primary,
                opacity: canRecord && result.localMinor <= 0 ? 0.4 : 1,
                shadowColor: scheme.primary,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
              className="mb-1 mt-4 h-16 w-full items-center justify-center rounded-3xl active:scale-[0.98] active:opacity-90"
            >
              <Text
                style={{ color: scheme.primaryForeground }}
                className="text-2xl font-black tracking-wide"
              >
                {canRecord ? t('main.record', '기록하기') : t('common.confirm', '확인')}
              </Text>
            </Pressable>

            {canRecord && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  onClose(result);
                }}
                className="h-12 w-full items-center justify-center rounded-3xl active:opacity-60"
              >
                <Text style={{ color: scheme.mutedForeground }} className="text-base font-bold">
                  {t('common.cancel', '취소')}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

/**
 * 한 줄짜리 식. 길어지면 오른쪽(최근 입력)을 붙잡고 왼쪽으로 흘려보낸다.
 */
function ExprLine({
  text,
  fade,
  color,
  fontSizeClass = 'text-6xl sm:text-7xl font-black',
}: {
  text: string;
  fade: string;
  color: string;
  fontSizeClass?: string;
}) {
  const ref = useRef<ScrollView>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // contentSize는 flexGrow:1 때문에 항상 컨테이너 폭과 같아서 넘침 판정에 못 쓴다.
  // 텍스트 자체 폭으로 잰다 (1px는 반올림 오차 여유).
  const isOverflowing = containerWidth > 0 && textWidth > containerWidth + 1;

  return (
    <View
      className="flex-1 overflow-hidden"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setContainerWidth(w);
      }}
    >
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        onContentSizeChange={() => {
          ref.current?.scrollToEnd({ animated: false });
        }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' }}
      >
        <Text
          style={{ color }}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          className={`tracking-tight ${fontSizeClass}`}
        >
          {text}
        </Text>
      </ScrollView>

      {/* 숫자가 영역 폭을 실제로 넘칠 때에만 페이드 오버레이 표시 */}
      {isOverflowing && (
        <View pointerEvents="none" className="absolute bottom-0 left-0 top-0 flex-row">
          {[0.95, 0.8, 0.6, 0.4, 0.25, 0.12, 0.05].map((opacity) => (
            <View key={opacity} style={{ backgroundColor: fade, opacity, width: 4 }} />
          ))}
        </View>
      )}
    </View>
  );
}

function Key({
  label,
  onPress,
  background,
  color,
  flex = 1,
}: {
  label: string;
  onPress: () => void;
  background: string;
  color: string;
  flex?: number;
}) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '⌫' ? t('main.deleteOneDigitA11y', '한 자리 지우기') : label}
      onPress={onPress}
      style={{ backgroundColor: background, flex }}
      className="h-16 items-center justify-center rounded-2xl active:scale-95 active:opacity-75 sm:h-20"
    >
      {label === '⌫' ? (
        <Delete size={24} color={color} />
      ) : (
        <Text style={{ color }} className="text-2xl font-extrabold">
          {label}
        </Text>
      )}
    </Pressable>
  );
}
