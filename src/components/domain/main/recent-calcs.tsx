import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import type { RecentCalc } from '@/store/app';

type Props = {
  items: RecentCalc[];
  onPress: (calc: RecentCalc) => void;
  onLongPress: (calc: RecentCalc) => void;
};

/**
 * §② 최근 계산 — 기록한 금액 중 최신 3건. 다시 쓰기 쉬운 금액이라 칩으로 남긴다.
 * 비어 있으면 섹션 자체를 숨긴다 (호출부에서 판단하지 않도록 여기서 처리).
 */
export function RecentCalcs({ items, onPress, onLongPress }: Props) {
  const { scheme } = useTheme();
  if (items.length === 0) return null;

  return (
    <View>
      <Text className="mb-2 pl-1 text-sm font-bold text-neutral-500 dark:text-neutral-400">
        최근 계산
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {items.map((calc) => (
          <Pressable
            key={calc.id}
            accessibilityRole="button"
            accessibilityHint="길게 누르면 이 금액으로 지출을 기록합니다"
            onPress={() => {
              haptics.selection();
              onPress(calc);
            }}
            onLongPress={() => {
              haptics.impact();
              onLongPress(calc);
            }}
            style={{ backgroundColor: scheme.secondary }}
            className="rounded-full px-4 py-2 active:opacity-70"
          >
            <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
              {formatMoney(calc.amount, calc.currency)} ↔ {formatMoney(calc.baseAmount, calc.baseCurrency)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
