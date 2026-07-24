import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { colors } from '@/theme/colors';

/**
 * 화면 상단 큰 제목 헤더 — 제목 + 부제 + 우측 아이콘 뱃지.
 * 아이콘은 소비자가 색을 넣어 넘긴다: `<Icon size={20} color={scheme.primary} />`
 */
export function PageHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];

  return (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs font-semibold text-neutral-400">{subtitle}</Text>
        ) : null}
      </View>
      {icon ? (
        <View
          style={{ backgroundColor: scheme.primarySoft }}
          className="h-10 w-10 items-center justify-center rounded-2xl"
        >
          {icon}
        </View>
      ) : null}
    </View>
  );
}
