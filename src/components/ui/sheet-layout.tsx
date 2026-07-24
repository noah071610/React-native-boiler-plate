import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

/**
 * 하단 시트 공통 카드 레이아웃 — BottomSheet 위에 얹는 흰 카드.
 * 아이콘/제목/부제 헤더 + 내용 + 기본·보조 버튼 푸터를 정형화.
 * 아이콘이나 부제가 있으면 헤더는 가운데 정렬(큰 제목), 없으면 작은 제목만.
 */
export function SheetLayout({
  visible,
  onClose,
  icon,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
}: {
  visible: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];
  const centered = !!(icon || subtitle);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="rounded-t-3xl bg-white p-5 pb-8 dark:bg-neutral-900">
        {title || icon ? (
          <View className={centered ? 'items-center gap-3' : ''}>
            {icon ? (
              <View
                style={{ backgroundColor: scheme.primarySoft }}
                className="h-12 w-12 items-center justify-center rounded-2xl"
              >
                {icon}
              </View>
            ) : null}
            {title ? (
              <Text
                className={`text-neutral-900 dark:text-neutral-50 ${
                  centered
                    ? 'text-center text-2xl font-bold'
                    : 'mb-1 text-center text-lg font-semibold'
                }`}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}

        {children ? <View className="mt-4">{children}</View> : null}

        {primaryLabel ? (
          <View className="mt-5 gap-2">
            <Button
              label={primaryLabel}
              disabled={primaryDisabled}
              onPress={onPrimary ?? onClose}
            />
            {secondaryLabel ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  (onSecondary ?? onClose)();
                }}
                className="items-center py-2 active:opacity-60"
              >
                <Text className="text-sm font-semibold text-neutral-400">{secondaryLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}
