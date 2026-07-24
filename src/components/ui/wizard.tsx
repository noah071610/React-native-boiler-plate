import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

/**
 * 동적 스텝 마법사(온보딩 등)의 핵심 로직 — UI 없음.
 *
 * 스텝 목록을 데이터에서 매번 파생시킨다(buildSteps). 답변에 따라 질문이 늘거나
 * 줄어도 순서·진행률·이전/다음이 전부 같은 배열 하나만 본다. 스텝 번호를 상수로
 * 박고 산수로 건너뛰는 방식은 조건부 질문이 하나 늘 때마다 진행률이 어긋난다.
 *
 * goNext는 "방금 고른 답변" 기준으로 다음을 계산하므로, 분기를 만드는 답을
 * 반영하려면 병합된 데이터를 인자로 넘긴다: `patch(p); goNext(merged)`.
 */
export function useWizard<Step, Data>({
  data,
  buildSteps,
  initial,
  onExit,
  onComplete,
}: {
  data: Data;
  buildSteps: (data: Data) => Step[];
  initial: Step;
  onExit?: () => void;
  onComplete?: (data: Data) => void;
}) {
  const [step, setStep] = useState<Step>(initial);
  const steps = buildSteps(data);
  const index = Math.max(0, steps.indexOf(step));
  const total = Math.max(1, steps.length);

  const goNext = useCallback(
    (nextData: Data = data) => {
      const list = buildSteps(nextData);
      const at = list.indexOf(step);
      const next = list[(at === -1 ? index : at) + 1];
      if (next !== undefined) setStep(next);
      else onComplete?.(nextData);
    },
    [buildSteps, data, index, onComplete, step],
  );

  const goBack = useCallback(() => {
    const previous = steps[index - 1];
    if (previous !== undefined) setStep(previous);
    else onExit?.();
  }, [index, onExit, steps]);

  return {
    step,
    setStep,
    index,
    total,
    steps,
    progress: (index + 1) / total,
    goNext,
    goBack,
  };
}

/** 상단 진행 바 — 뒤로가기 + 애니메이션 진행률 + n/total 카운터. */
export function WizardProgressHeader({
  progress,
  current,
  total,
  onBack,
  label = '진행 중',
}: {
  progress: number;
  current: number;
  total: number;
  onBack: () => void;
  label?: string;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];

  return (
    <View className="mb-6 flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로가기"
        className="h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800"
        onPress={() => {
          haptics.selection();
          onBack();
        }}
      >
        <ChevronLeft size={22} color={scheme.foreground} strokeWidth={2.5} />
      </Pressable>
      <View className="flex-1">
        <AnimatedProgress value={progress} color={scheme.primary} />
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
            {label}
          </Text>
          <View
            style={{ backgroundColor: scheme.primarySoft }}
            className="rounded-full px-2.5 py-0.5"
          >
            <Text style={{ color: scheme.primary }} className="text-xs font-extrabold">
              {current} / {total}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 질문 헤더 — 스텝 뱃지 + 제목 + (선택) 힌트. */
export function QuestionHeader({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint?: string;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];

  return (
    <View className="mb-5 gap-2">
      <View
        style={{ backgroundColor: scheme.primary + '18' }}
        className="self-start rounded-full px-3 py-1"
      >
        <Text style={{ color: scheme.primary }} className="text-xs font-black uppercase tracking-widest">
          QUESTION {step}
        </Text>
      </View>
      <Text className="text-2xl font-black leading-tight tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
        {title}
      </Text>
      {hint ? (
        <Text className="text-sm font-normal leading-normal text-neutral-500 dark:text-neutral-400 sm:text-base">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** 하단 고정 푸터 — 기본 버튼 + (선택) 보조 텍스트 버튼. */
export function WizardFooter({
  label,
  onPress,
  disabled,
  secondaryLabel,
  onSecondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View className="gap-2 border-t border-neutral-200/60 bg-white pb-2 pt-3 dark:border-neutral-800 dark:bg-neutral-900">
      <Button label={label} onPress={onPress} disabled={disabled} />
      {secondaryLabel ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          className="items-center py-2 active:opacity-60"
          onPress={() => {
            haptics.selection();
            onSecondary?.();
          }}
        >
          <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 진행률 바 — 값 변화에 부드럽게 애니메이션. */
export function AnimatedProgress({ value, color }: { value: number; color: string }) {
  const progress = useSharedValue(value);

  useEffect(() => {
    progress.value = withTiming(value, { duration: 260 });
  }, [progress, value]);

  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <Animated.View style={[{ backgroundColor: color }, style]} className="h-full rounded-full" />
    </View>
  );
}
