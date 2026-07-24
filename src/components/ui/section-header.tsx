import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { colors } from '@/theme/colors';

/** 상단 헤더 — 뒤로가기 + 가운데 정렬 제목 + 우측 슬롯. 높이는 낮게 유지한다. */
export function SectionHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    >
      <View className="h-12 flex-row items-center px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          onPress={onBack}
          className="h-10 w-20 flex-row items-center pl-2 active:opacity-60"
        >
          <ChevronLeft size={22} color={scheme.foreground} />
        </Pressable>
        <Text
          numberOfLines={1}
          className="flex-1 text-center text-base font-bold text-neutral-900 dark:text-neutral-50"
        >
          {title}
        </Text>
        {/* 좌우 폭을 같게 맞춰 제목을 가운데로 — 절대배치 대신 */}
        <View className="w-20 flex-row items-center justify-end gap-1 pr-1">{right}</View>
      </View>
    </View>
  );
}
