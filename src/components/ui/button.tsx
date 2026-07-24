import type { ReactNode } from 'react';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  size?: 'md' | 'lg';
  icon?: ReactNode;
};

export function Button({ label, onPress, variant = 'primary', disabled, size = 'lg', icon }: Props) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={{
        backgroundColor: primary ? scheme.primary : scheme.secondary,
        opacity: disabled ? 0.4 : 1,
      }}
      className={`flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
        size === 'lg' ? 'py-4 px-6' : 'py-3 px-4'
      }`}>
      {icon}
      <Text
        style={{ color: primary ? scheme.primaryForeground : scheme.secondaryForeground }}
        className={size === 'lg' ? 'text-lg font-bold' : 'text-base font-semibold'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 온보딩·선택지 공통 버튼. 탭 = 선택 + 자동 진행(§4.1). */
export function Option({
  label,
  hint,
  selected,
  checkbox,
  icon,
  badge,
  onPress,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  checkbox?: boolean;
  icon?: ReactNode;
  badge?: string;
  onPress: () => void;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={{
        backgroundColor: selected ? scheme.primarySoft : scheme.secondary,
        borderColor: selected ? scheme.primary : 'transparent',
        borderWidth: 2,
      }}
      className="relative rounded-2xl px-5 py-4 active:opacity-90">
      <View className="flex-row items-center gap-3.5">
        {icon ? (
          <View
            style={{
              backgroundColor: selected ? scheme.primary : effectiveScheme === 'dark' ? '#404040' : '#E5E7EB',
            }}
            className="h-11 w-11 items-center justify-center rounded-xl">
            {icon}
          </View>
        ) : checkbox ? (
          <View
            style={{
              borderColor: selected ? scheme.primary : scheme.mutedForeground,
              backgroundColor: selected ? scheme.primary : 'transparent',
            }}
            className="h-6 w-6 items-center justify-center rounded-lg border-2">
            {selected ? <Check size={14} color={scheme.primaryForeground} strokeWidth={3} /> : null}
          </View>
        ) : null}

        <View className="flex-1 justify-center">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{label}</Text>
            {badge ? (
              <View
                style={{ backgroundColor: scheme.primary }}
                className="rounded-full px-2.5 py-0.5">
                <Text
                  style={{ color: scheme.primaryForeground }}
                  className="text-xs font-bold">
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          {hint ? (
            <Text className="mt-1 text-sm font-normal text-neutral-500 dark:text-neutral-400">
              {hint}
            </Text>
          ) : null}
        </View>

        {!checkbox && selected && !icon ? (
          <View
            style={{ backgroundColor: scheme.primary }}
            className="h-6 w-6 items-center justify-center rounded-full">
            <Check size={14} color={scheme.primaryForeground} strokeWidth={3} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
