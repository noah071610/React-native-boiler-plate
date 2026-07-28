import { Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { categoryLabel } from '@/constants/categories';
import type { Category } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import type { TimelineDay } from '@/hooks/use-timeline-days';
import { formatMoney } from '@/lib/money';

type Props = {
  /** 지금 화면 맨 위에 있는 날. 스크롤하면 다음 날로 바뀐다. */
  day: TimelineDay | null;
  localCurrency: string;
  baseCurrency: string;
  categories: Category[];
  selectedCategoryIds: string[];
  onToggleCategory: (id: string | null) => void;
  searchOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onToggleSearch: () => void;
};

/**
 * 상단 고정 헤더. 스크롤을 따라 날짜가 바뀌는 것이 이 화면의 축이라
 * 날짜 요약은 스크롤 영역 안이 아니라 여기(고정)에 둔다.
 */
export function TimelineHeader({
  day,
  localCurrency,
  baseCurrency,
  categories,
  selectedCategoryIds,
  onToggleCategory,
  searchOpen,
  query,
  onQueryChange,
  onToggleSearch,
}: Props) {
  const { scheme } = useTheme();

  return (
    <View style={{ backgroundColor: scheme.background }} className="px-5 pb-2">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
            {day ? (day.isToday ? `오늘 · ${day.label}` : day.label) : '타임라인'}
          </Text>
          <Text className="mt-0.5 text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
            {day
              ? [
                  day.dayIndex ? `${day.dayIndex}일차` : null,
                  `${day.count}건`,
                  day.count > 0 ? formatMoney(day.localMinor, localCurrency) : null,
                  day.count > 0 ? formatMoney(day.baseMinor, baseCurrency) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : ''}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? '검색 닫기' : '검색'}
          onPress={onToggleSearch}
          style={{ backgroundColor: scheme.primarySoft }}
          className="h-10 w-10 items-center justify-center rounded-2xl active:opacity-70"
        >
          {searchOpen ? (
            <X size={18} color={scheme.primary} />
          ) : (
            <Search size={18} color={scheme.primary} />
          )}
        </Pressable>
      </View>

      {searchOpen ? (
        <TextInput
          autoFocus
          value={query}
          onChangeText={onQueryChange}
          placeholder="메모, 장소, 카테고리, 금액"
          placeholderTextColor={scheme.mutedForeground}
          style={{ backgroundColor: scheme.card, color: scheme.foreground }}
          className="mt-3 rounded-2xl px-4 py-3 text-base font-semibold"
        />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 12, paddingRight: 20 }}
      >
        <Chip label="전체" active={selectedCategoryIds.length === 0} onPress={() => onToggleCategory(null)} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={`${c.icon} ${categoryLabel(c)}`}
            active={selectedCategoryIds.includes(c.id)}
            onPress={() => onToggleCategory(c.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ backgroundColor: active ? scheme.primary : scheme.card }}
      className="rounded-full px-3.5 py-2 active:opacity-70"
    >
      <Text
        className="text-xs font-bold"
        style={{ color: active ? scheme.primaryForeground : scheme.mutedForeground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
