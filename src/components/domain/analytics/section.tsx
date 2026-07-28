import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** 애널리틱스 섹션 카드 — 제목 + 본문 + (선택) 하단 각주. */
export function Section({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { scheme } = useTheme();
  return (
    <View
      style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
      className="rounded-3xl border px-5 py-4"
    >
      {title ? (
        <Text className="mb-3 text-sm font-bold text-neutral-500 dark:text-neutral-400">
          {title}
        </Text>
      ) : null}
      {children}
      {footer ? <View className="mt-3">{footer}</View> : null}
    </View>
  );
}
