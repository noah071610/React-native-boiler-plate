import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

// 자체 그리드 달력. react-native-calendars의 WeekCalendar는 무한 스크롤 리스트라
// 제어형 date + onDateChanged가 서로를 되먹여 깜빡였다. 달력은 for문 두 개면 끝난다.

type ViewMode = 'month' | 'week';
type Scheme = (typeof colors)['light'];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shift = (key: string, days: number, months = 0) => {
  const d = parse(key);
  if (months) {
    // 1/31 → setMonth(+1)은 3/3으로 넘어간다. 말일로 붙잡아 둔다.
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  d.setDate(d.getDate() + days);
  return fmt(d);
};

/** 선택일이 속한 달의 주 배열. 이번 달이 아닌 칸은 빈 문자열. */
function monthWeeks(cursor: string) {
  const first = parse(cursor);
  first.setDate(1);
  const month = first.getMonth();
  const start = new Date(first.getFullYear(), month, 1 - first.getDay());
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const row: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      row.push(d.getMonth() === month ? fmt(d) : '');
    }
    if (row.some(Boolean)) weeks.push(row);
  }
  return weeks;
}

const weekDays = (key: string) => {
  const start = shift(key, -parse(key).getDay());
  return Array.from({ length: 7 }, (_, i) => shift(start, i));
};

/** 오늘 날짜 키 (yyyy-mm-dd). */
export const todayKey = () => fmt(new Date());

/**
 * 월/주 그리드 달력. 도메인 없음.
 * - markedDates: 점·연한 배경으로 표시할 날짜 키 집합 (예: 완료일)
 * - 스와이프로 이전/다음 기간 이동, 상단 화살표도 동일
 */
export function Calendar({
  selectedDate,
  onSelectDate,
  markedDates,
  minDate,
  initialMode = 'month',
  showModeToggle = true,
  monthLabel = '월단위 보기',
  weekLabel = '주단위 보기',
  legendLabel,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  markedDates?: Set<string>;
  /** 이 날짜보다 이전은 고를 수 없다 (yyyy-mm-dd). 키가 사전순=날짜순이라 문자열 비교로 충분하다 */
  minDate?: string;
  initialMode?: ViewMode;
  showModeToggle?: boolean;
  monthLabel?: string;
  weekLabel?: string;
  legendLabel?: string;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];
  const [mode, setMode] = useState<ViewMode>(initialMode);

  const today = todayKey();
  const cursor = parse(selectedDate);
  const weeks = useMemo(
    () => (mode === 'month' ? monthWeeks(selectedDate) : [weekDays(selectedDate)]),
    [mode, selectedDate],
  );

  const step = useCallback(
    (dir: -1 | 1) =>
      onSelectDate(mode === 'month' ? shift(selectedDate, 0, dir) : shift(selectedDate, dir * 7)),
    [mode, onSelectDate, selectedDate],
  );

  // 스와이프: 현재 그리드를 손가락 방향으로 밀어내고, 새 기간을 반대편에서 밀어 넣는다.
  const [gridWidth, setGridWidth] = useState(0);
  const tx = useSharedValue(0);
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          tx.value = e.translationX;
        })
        .onEnd((e) => {
          const w = gridWidth || 320;
          const go = Math.abs(e.translationX) > w * 0.2 || Math.abs(e.velocityX) > 500;
          if (!go) {
            tx.value = withTiming(0, { duration: 160 });
            return;
          }
          const dir: -1 | 1 = e.translationX < 0 ? 1 : -1;
          tx.value = withTiming(-dir * w, { duration: 140 }, (finished) => {
            if (!finished) return;
            runOnJS(step)(dir);
            tx.value = dir * w;
            tx.value = withTiming(0, { duration: 180 });
          });
        }),
    [gridWidth, step, tx],
  );
  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: 1 - Math.min(Math.abs(tx.value) / (gridWidth || 320), 1) * 0.6,
  }));

  return (
    <View className="gap-4">
      {showModeToggle ? (
        <View className="flex-row gap-2">
          {(
            [
              { id: 'month', label: monthLabel },
              { id: 'week', label: weekLabel },
            ] as const
          ).map((item) => {
            const selected = mode === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.selection();
                  setMode(item.id);
                }}
                style={selected ? { backgroundColor: scheme.primary } : undefined}
                className="flex-1 items-center rounded-xl bg-neutral-100 py-2.5 dark:bg-neutral-800"
              >
                <Text
                  style={selected ? { color: scheme.primaryForeground } : undefined}
                  className="text-sm font-bold text-neutral-900 dark:text-neutral-50"
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View className="rounded-3xl border border-neutral-200/50 bg-neutral-100/90 p-4 dark:border-neutral-800 dark:bg-neutral-800/60">
        <View className="flex-row items-center justify-between border-b border-neutral-200/60 px-1 pb-2 dark:border-neutral-700/60">
          <Arrow label="이전" onPress={() => step(-1)} color={scheme.primary} text="‹" />
          <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </Text>
          <Arrow label="다음" onPress={() => step(1)} color={scheme.primary} text="›" />
        </View>

        <View className="mt-3 flex-row">
          {DAY_NAMES.map((name) => (
            <Text
              key={name}
              style={{ color: scheme.mutedForeground }}
              className="flex-1 text-center text-xs font-bold"
            >
              {name}
            </Text>
          ))}
        </View>

        <GestureDetector gesture={swipe}>
          <View
            className="overflow-hidden"
            onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View style={gridStyle}>
              {weeks.map((week) => (
                <View key={week.find(Boolean)} className="mt-1 flex-row">
                  {week.map((date, i) =>
                    date ? (
                      <DayCell
                        key={date}
                        date={date}
                        selected={date === selectedDate}
                        isToday={date === today}
                        marked={markedDates?.has(date) ?? false}
                        disabled={minDate != null && date < minDate}
                        scheme={scheme}
                        onPress={() => {
                          haptics.selection();
                          onSelectDate(date);
                        }}
                      />
                    ) : (
                      <View key={`empty-${i}`} className="flex-1" />
                    ),
                  )}
                </View>
              ))}
            </Animated.View>
          </View>
        </GestureDetector>

        {legendLabel ? (
          <View className="mt-2 flex-row items-center justify-end gap-1.5 border-t border-neutral-200/40 px-1 pt-2 dark:border-neutral-700/40">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: scheme.primary }}
            />
            <Text className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              {legendLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Arrow({
  label,
  text,
  color,
  onPress,
}: {
  label: string;
  text: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className="px-3 py-1 active:opacity-60"
    >
      <Text style={{ color }} className="text-2xl font-bold leading-7">
        {text}
      </Text>
    </Pressable>
  );
}

function DayCell({
  date,
  selected,
  isToday,
  marked,
  disabled,
  scheme,
  onPress,
}: {
  date: string;
  selected: boolean;
  isToday: boolean;
  marked: boolean;
  disabled?: boolean;
  scheme: Scheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: disabled ?? false }}
      accessibilityLabel={date}
      disabled={disabled}
      onPress={onPress}
      style={disabled ? { opacity: 0.3 } : undefined}
      className="flex-1 items-center py-1"
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={
          selected
            ? { backgroundColor: scheme.primary }
            : marked
              ? { backgroundColor: scheme.primarySoft }
              : undefined
        }
      >
        <Text
          className="text-sm"
          style={{
            color: selected
              ? scheme.primaryForeground
              : marked
                ? scheme.primaryDeep
                : isToday
                  ? scheme.primary
                  : scheme.foreground,
            fontWeight: selected || isToday || marked ? '800' : '400',
          }}
        >
          {Number(date.slice(8))}
        </Text>
      </View>
      <View
        className="mt-0.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: marked && !selected ? scheme.primary : 'transparent' }}
      />
    </Pressable>
  );
}
