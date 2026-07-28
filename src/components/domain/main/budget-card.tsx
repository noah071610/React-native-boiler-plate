import { ChevronRight } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedNumberText } from '@/components/ui/animated-number';
import { useTheme } from '@/hooks/use-theme';
import { formatMoneyI18n, useI18n } from '@/i18n';

type Props = {
  /** 최소단위. null이면 예산 미설정 상태 */
  budgetAmount: number | null;
  currency: string;
  spentBase: number;
  dailyAvg: number | null;
  daysLeft: number | null;
  dailyAllowance: number | null;
  /** 값이 바뀌면 카드를 짧게 강조한다 (방금 기록이 반영된 것을 눈으로 확인시킨다) */
  flashAt?: number;
  onPress: () => void;
};

function Gauge({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  // 100%를 넘긴 것도 보여준다. 다만 막대 자체는 넘칠 수 없으니 색으로 구분한다.
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  return (
    <View style={{ backgroundColor: track }} className="mt-3 h-2.5 overflow-hidden rounded-full">
      <View style={{ backgroundColor: color, width }} className="h-full rounded-full" />
    </View>
  );
}

/**
 * §③ 남은 예산 카드 — 재방문을 만드는 핵심 요소.
 * 예산이 없어도 카드는 항상 존재한다. 숨기지 않는다.
 * 초과해도 문구로 지적하지 않는다 (원칙 3: 앱은 유저를 판단하지 않는다).
 */
export function BudgetCard({
  budgetAmount,
  currency,
  spentBase,
  dailyAvg,
  daysLeft,
  dailyAllowance,
  flashAt = 0,
  onPress,
}: Props) {
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const remaining = (budgetAmount ?? 0) - spentBase;
  const money = (minor: number) => formatMoneyI18n(minor, currency, t, resolvedLanguage);

  const flash = useSharedValue(0);
  useEffect(() => {
    if (!flashAt) return;
    flash.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 700 }));
  }, [flashAt, flash]);
  const flashStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(flash.value, [0, 1], [scheme.border, scheme.primary]),
    transform: [{ scale: 1 + flash.value * 0.015 }],
  }));

  // 예산이 줄면 숫자가 아래에서, 늘면 위에서 굴러온다
  const previousRemaining = useRef(remaining);
  const direction = remaining <= previousRemaining.current ? 1 : -1;
  useEffect(() => {
    previousRemaining.current = remaining;
  }, [remaining]);

  if (budgetAmount == null || budgetAmount <= 0) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
        className="flex-row items-center rounded-3xl border p-5 active:opacity-80"
      >
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold leading-7 text-neutral-900 dark:text-neutral-50">
            {t('main.budgetEmpty', '예산을 정하면\n기간별 분석 결과를 알려드려요')}
          </Text>
        </View>
        <ChevronRight size={22} color={scheme.mutedForeground} />
      </Pressable>
    );
  }

  const over = remaining < 0;
  const usedRatio = spentBase / budgetAmount;
  const usedPercent = Math.round(usedRatio * 100);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      style={[{ backgroundColor: scheme.card }, flashStyle]}
      className="rounded-3xl border p-5 active:opacity-90"
    >
      <Text className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
        {t('main.remainingBudget', '남은 예산')}
      </Text>

      <View className="mt-2">
        <AnimatedNumberText
          text={`${over ? '-' : ''}${money(Math.abs(remaining))}`}
          direction={direction}
          style={{ color: over ? scheme.destructive : scheme.foreground }}
          className="text-4xl font-black tracking-tight"
        />
      </View>

      <Gauge
        ratio={over ? 1 : 1 - usedRatio}
        color={over ? scheme.destructive : scheme.primary}
        track={scheme.muted}
      />

      <Text className="mt-1.5 text-xs font-semibold text-neutral-400">
        {over
          ? t('main.budgetUsedPercent', '예산 대비 {{percent}}%', { percent: usedPercent })
          : t('main.budgetRemainingPercent', '{{percent}}% 남음', {
              percent: 100 - usedPercent,
            })}
      </Text>

      <View className="mt-4 gap-1">
        {dailyAvg != null ? (
          <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
            {t('main.dailyAverage', '하루 평균 {{amount}} 쓰는 중', {
              amount: money(dailyAvg),
            })}
          </Text>
        ) : null}

        {daysLeft != null && dailyAllowance != null ? (
          <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
            {t('main.dailyAllowance', '남은 {{days}}일 · 하루 {{amount}} 가능', {
              days: daysLeft,
              amount: money(dailyAllowance),
            })}
          </Text>
        ) : daysLeft == null ? (
          <Text className="text-sm font-semibold" style={{ color: scheme.primary }}>
            {t(
              'main.budgetNeedsTripPeriod',
              '여행 기간을 정하면 남은 금액과 하루 지출액 등 분석 결과를 알려드려요',
            )}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * 여행 기간이 아닐 때 §③ 자리에 들어가는 카드.
 * 지금 여행 중이 아니면 "남은 예산"은 말할 것이 없다 — 대신 다음 여행을 만들게 한다.
 */
export function AddTripCard({
  nextTripLabel,
  onPress,
}: {
  /** 다가오는 여행 안내 한 줄. 없으면 null */
  nextTripLabel: string | null;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('main.addTrip', '여행지 추가하기')}
      onPress={onPress}
      style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
      className="flex-row items-center rounded-3xl border p-5 active:opacity-80"
    >
      <View className="flex-1 pr-3">
        <Text className="text-lg font-bold leading-7 text-neutral-900 dark:text-neutral-50">
          {t('main.addTrip', '여행지 추가하기')}
        </Text>
        <Text className="mt-1 text-sm font-semibold text-neutral-400">
          {nextTripLabel ??
            t('main.addTripDescription', '나라와 기간, 예산을 정하면 여행이 시작돼요')}
        </Text>
      </View>
      <ChevronRight size={22} color={scheme.mutedForeground} />
    </Pressable>
  );
}
