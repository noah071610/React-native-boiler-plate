import { Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { Category } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import type { DayTotal, TimelineDay } from '@/hooks/use-timeline-days';
import { categoryDisplayLabel, formatMoneyI18n, useI18n } from '@/i18n';

const dateLabel = (key: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', weekday: 'short' }).format(
    new Date(`${key}T00:00:00`),
  );

type Props = {
  /** 지금 화면 맨 위에 있는 날. 스크롤하면 다음 날로 바뀐다. */
  day: TimelineDay | null;
  /** 그 날의 총합. 필터·검색을 걸어도 이 숫자는 그대로다 */
  total: DayTotal;
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
  total,
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
  const { locale, resolvedLanguage, t } = useI18n();
  const dayLabel = day ? dateLabel(day.key, locale) : '';
  const money = (minor: number, code: string) => formatMoneyI18n(minor, code, t, resolvedLanguage);

  return (
    <View style={{ backgroundColor: scheme.background }} className="px-5 pb-1 pt-1">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2.5">
          <Text
            numberOfLines={1}
            className="text-xl font-black tracking-tight text-neutral-900 dark:text-neutral-50"
          >
            {day
              ? day.isToday
                ? t('timeline.todayWithDate', '오늘 · {{date}}', { date: dayLabel })
                : dayLabel
              : t('tabs.timeline', '타임라인')}
          </Text>

          {day && total.baseMinor > 0 ? (
            <View
              style={{ backgroundColor: `${scheme.primary}18` }}
              className="items-center justify-center rounded-full px-3 py-1"
            >
              <Text
                style={{ color: scheme.primary }}
                className="text-xs font-black tracking-tight"
              >
                {money(total.baseMinor, baseCurrency)}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            searchOpen
              ? t('timeline.closeSearchA11y', '검색 닫기')
              : t('timeline.searchA11y', '검색')
          }
          onPress={onToggleSearch}
          style={{ backgroundColor: scheme.primarySoft }}
          className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
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
          placeholder={t('timeline.searchPlaceholder', '메모, 장소, 카테고리, 금액')}
          placeholderTextColor={scheme.mutedForeground}
          style={{ backgroundColor: scheme.card, color: scheme.foreground }}
          className="mt-2.5 rounded-2xl px-4 py-2.5 text-base font-semibold"
        />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 6, paddingRight: 20 }}
      >
        <Chip
          label={t('timeline.allCategories', '전체')}
          active={selectedCategoryIds.length === 0}
          onPress={() => onToggleCategory(null)}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={`${c.icon} ${categoryDisplayLabel(c, t)}`}
            active={selectedCategoryIds.includes(c.id)}
            onPress={() => onToggleCategory(c.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
