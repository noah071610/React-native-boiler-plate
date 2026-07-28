import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

type Props = { children: ReactNode; scroll?: boolean; scrollEnabled?: boolean; padTop?: boolean };

/** 화면 공통 껍데기 — 배경 + 세이프에어리어 + 좌우 여백. */
export function Screen({ children, scroll = true, scrollEnabled = true, padTop = true }: Props) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: padTop ? insets.top + 24 : 0,
    paddingHorizontal: 20,
    paddingBottom: insets.bottom + 40,
  };

  if (!scroll) {
    return (
      <View className="flex-1" style={[{ backgroundColor: scheme.background }, padding]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: scheme.background }}
      contentInsetAdjustmentBehavior="automatic"
      scrollEnabled={scrollEnabled}
      contentContainerStyle={padding}
    >
      {children}
    </ScrollView>
  );
}

