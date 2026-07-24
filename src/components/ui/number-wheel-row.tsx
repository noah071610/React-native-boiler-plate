import { Host, Picker } from '@expo/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

type Props = {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function NumberWheelRow({ label, value, unit, min, max, step = 1, onChange }: Props) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  const values = useMemo(
    () => Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step),
    [max, min, step]
  );

  useEffect(() => {
    previous.current = value;
  }, [value]);

  const change = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const showPicker = () => {
    haptics.selection();
    setDraft(value);
    setOpen(true);
  };

  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-neutral-100 px-5 py-4 dark:bg-neutral-800">
      <Text className="text-base text-neutral-500 dark:text-neutral-400">{label}</Text>
      <View className="flex-row items-center gap-4">
        <Stepper label="−" onPress={() => change(value - step)} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 선택`} onPress={showPicker}>
          <AnimatedNumber value={value} unit={unit} direction={direction} />
        </Pressable>
        <Stepper label="+" onPress={() => change(value + step)} />
      </View>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View className="rounded-t-3xl bg-white p-5 dark:bg-neutral-900">
          <Text className="mb-3 text-center text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {label}
          </Text>
          <View style={{ backgroundColor: scheme.secondary }} className="rounded-2xl">
            <Host style={{ height: 180 }}>
              <Picker<number> selectedValue={draft} onValueChange={setDraft} appearance="wheel">
                {values.map((v) => (
                  <Picker.Item key={v} label={`${v}${unit}`} value={v} />
                ))}
              </Picker>
            </Host>
          </View>
          <View className="mt-4">
            <Button
              label="선택"
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

function AnimatedNumber({ value, unit, direction }: { value: number; unit: string; direction: number }) {
  return (
    <View className="min-w-16 flex-row items-baseline justify-center">
      {String(value)
        .split('')
        .map((digit, index, digits) => (
          <AnimatedDigit key={`${digits.length}-${index}`} digit={digit} direction={direction} />
        ))}
      <Text className="text-base font-normal text-neutral-400"> {unit}</Text>
    </View>
  );
}

function AnimatedDigit({ digit, direction }: { digit: string; direction: number }) {
  const previous = useRef(digit);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (digit === previous.current) return;
    previous.current = digit;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [digit, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.35, 1]),
    transform: [{ translateY: direction * interpolate(progress.value, [0, 1], [10, 0]) }],
  }));

  return (
    <Animated.Text
      style={style}
      className="text-center text-2xl font-bold text-neutral-900 dark:text-neutral-50">
      {digit}
    </Animated.Text>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? '증가' : '감소'}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-neutral-700">
      <Text className="text-xl text-neutral-900 dark:text-neutral-50">{label}</Text>
    </Pressable>
  );
}
