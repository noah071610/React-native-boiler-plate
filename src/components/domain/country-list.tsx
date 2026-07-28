import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { CURRENCIES, searchCountries, type CountryInfo } from '@/constants/currencies';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type Props = {
  onSelect: (country: CountryInfo) => void;
  /** 지금 선택된 통화 코드 — 통화 변경 시트에서 표시용 */
  selectedCurrency?: string;
};

/**
 * 나라 선택 목록 — 온보딩과 "통화 변경" 시트가 같은 UI를 쓴다.
 * 탭하는 즉시 선택된다. 확인 버튼을 두지 않는다.
 */
export function CountryList({ onSelect, selectedCurrency }: Props) {
  const { scheme } = useTheme();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(query), [query]);

  return (
    <View className="flex-1">
      <View
        style={{ backgroundColor: scheme.muted }}
        className="mb-3 flex-row items-center gap-2 rounded-2xl px-4"
      >
        <Search size={18} color={scheme.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="나라, 통화 검색"
          placeholderTextColor={scheme.mutedForeground}
          autoCorrect={false}
          className="flex-1 py-3.5 text-base font-semibold text-neutral-900 dark:text-neutral-50"
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text className="py-10 text-center text-sm font-semibold text-neutral-400">
            찾는 나라가 없어요
          </Text>
        }
        renderItem={({ item }) => {
          const currency = CURRENCIES[item.currency];
          const selected = item.currency === selectedCurrency;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                onSelect(item);
              }}
              style={{ backgroundColor: selected ? scheme.primarySoft : 'transparent' }}
              className="mb-1 flex-row items-center gap-3 rounded-2xl px-3 py-3.5 active:opacity-60"
            >
              <Text className="text-2xl">{item.flag}</Text>
              <Text className="flex-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
                {item.nameKo}
              </Text>
              <Text className="text-sm font-bold text-neutral-400">
                {item.currency}
                {currency ? ` · ${currency.nameKo}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
