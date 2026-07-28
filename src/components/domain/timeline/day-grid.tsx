import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Expense } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import type { DayTotal, TimelineDay } from '@/hooks/use-timeline-days';
import { formatMoneyI18n, useI18n, type AppLanguage, type TFunction } from '@/i18n';

/** 한 시간 칸의 최소 높이. 그 시간대에 여러 건이 있으면 칸이 늘어난다. */
export const HOUR_HEIGHT = 64;
const GUTTER = 52;

const paymentLabel = (method: string, t: TFunction) =>
  t(
    `main.payment.${method}`,
    method === 'cash' ? '현금' : method === 'card' ? '카드' : method === 'other' ? '기타' : 'QR',
  );

const dateLabel = (key: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', weekday: 'short' }).format(
    new Date(`${key}T00:00:00`),
  );

export type ExpenseMeta = {
  icon: string;
  label: string;
  color: string;
  /** 동행자가 기록한 것이면 그 이름. 내 기록이면 null */
  authorName: string | null;
  /** 누가 썼는지. 연동이 아니거나 공용이면 null (뱃지를 그리지 않는다) */
  usedByName: string | null;
};

type Props = {
  day: TimelineDay;
  /** 그날 총합. 필터를 걸어도 줄지 않는다 (day.count는 필터된 값이라 여기 쓰지 않는다) */
  total: DayTotal;
  localCurrency: string;
  baseCurrency: string;
  metaOf: (expense: Expense) => ExpenseMeta;
  onPress: (expense: Expense) => void;
  onLongPress: (expense: Expense) => void;
};

/** 1분마다 갱신되는 "자정으로부터 지난 분". 현재 시각 바에만 쓴다. */
function useNowMinutes(): number {
  const [minutes, setMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return minutes;
}

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
};

/**
 * 하루치 시간 격자. 캘린더 일별 보기와 같은 축이지만 겹침 배치는 하지 않는다 —
 * 같은 시간대에 두 건이 있으면 나란히 놓지 않고 칸을 아래로 늘린다.
 * 지출은 소요 시간이 없는 점 사건이라 폭을 쪼갤 이유가 없다.
 */
export function DayGrid({
  day,
  total,
  localCurrency,
  baseCurrency,
  metaOf,
  onPress,
  onLongPress,
}: Props) {
  const { scheme } = useTheme();
  const { locale, resolvedLanguage, t } = useI18n();
  const nowMinutes = useNowMinutes();
  const money = (minor: number, code: string) => formatMoneyI18n(minor, code, t, resolvedLanguage);

  // 오늘은 24시간을 다 그린다 (현재 시각 바가 어디에 있든 보여야 한다).
  // 지난 날은 기록이 있는 구간만 그린다 — 빈 격자를 스크롤하게 만들 이유가 없다.
  // ponytail: 이 범위 계산 하나가 하루 24행 × 여행 일수를 실사용 수준으로 낮춘다.
  const hours = [...day.byHour.keys()];
  const from = day.isToday || hours.length === 0 ? 0 : Math.max(0, Math.min(...hours) - 1);
  const to = day.isToday || hours.length === 0 ? 23 : Math.min(23, Math.max(...hours) + 1);

  return (
    <View>
      {/* 날짜 줄이 곧 "하루 지출" 줄이다 — 오른쪽 숫자가 그날 총합(필터 무관) */}
      <View
        className="px-1 pb-2 pt-5"
        style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: scheme.border }}
      >
        <View className="flex-row items-baseline gap-2">
          <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
            {day.isToday ? t('dashboard.today', '오늘') : dateLabel(day.key, locale)}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: scheme.mutedForeground }}>
            {t('main.recordCountValue', '{{count}}건', { count: total.count })}
          </Text>
          <View className="flex-1" />
          <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
            {total.count > 0 ? money(total.baseMinor, baseCurrency) : '—'}
          </Text>
        </View>

        {total.localMinor > 0 ? (
          <Text
            className="mt-0.5 text-right text-xs font-semibold"
            style={{ color: scheme.mutedForeground }}
          >
            {money(total.localMinor, localCurrency)}
          </Text>
        ) : null}
      </View>

      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((hour) => (
        <HourRow
          key={hour}
          hour={hour}
          items={day.byHour.get(hour) ?? []}
          nowFraction={
            day.isToday && Math.floor(nowMinutes / 60) === hour ? (nowMinutes % 60) / 60 : null
          }
          metaOf={metaOf}
          onPress={onPress}
          onLongPress={onLongPress}
          language={resolvedLanguage}
          t={t}
        />
      ))}
    </View>
  );
}

function HourRow({
  hour,
  items,
  nowFraction,
  metaOf,
  onPress,
  onLongPress,
  language,
  t,
}: {
  hour: number;
  items: Expense[];
  nowFraction: number | null;
  metaOf: (expense: Expense) => ExpenseMeta;
  onPress: (expense: Expense) => void;
  onLongPress: (expense: Expense) => void;
  language: AppLanguage;
  t: TFunction;
}) {
  const { scheme } = useTheme();
  // 칸이 늘어나도 현재 시각 바가 비율대로 서도록 실제 높이를 잰다.
  const [height, setHeight] = useState(HOUR_HEIGHT);

  return (
    <View
      className="flex-row"
      style={{ minHeight: HOUR_HEIGHT }}
      onLayout={nowFraction == null ? undefined : (e) => setHeight(e.nativeEvent.layout.height)}
    >
      <View style={{ width: GUTTER }} className="items-end pr-2">
        <Text
          className="text-[11px] font-semibold"
          style={{ marginTop: -7, color: scheme.mutedForeground }}
        >
          {`${hour}`.padStart(2, '0')}:00
        </Text>
      </View>

      <View
        className="flex-1 gap-1 pb-1"
        style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: scheme.border }}
      >
        {items.map((expense) => {
          const meta = metaOf(expense);
          const readOnly = meta.authorName != null;
          return (
            <Pressable
              key={expense.id}
              accessibilityRole="button"
              onPress={() => onPress(expense)}
              onLongPress={() => onLongPress(expense)}
              style={{
                backgroundColor: `${meta.color}26`,
                borderLeftColor: meta.color,
                opacity: readOnly ? 0.72 : 1,
              }}
              className="rounded-lg border-l-[3px] px-2.5 py-1.5 active:opacity-60"
            >
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs">{meta.icon}</Text>
                <Text
                  numberOfLines={1}
                  className="flex-1 text-[13px] font-bold text-neutral-900 dark:text-neutral-50"
                >
                  {expense.memo || expense.place || meta.label}
                </Text>
                <Text className="text-[13px] font-black text-neutral-900 dark:text-neutral-50">
                  {formatMoneyI18n(expense.amount, expense.currency, t, language)}
                </Text>
              </View>

              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: scheme.mutedForeground }}
                >
                  {hhmm(expense.occurredAt)}
                  {expense.paymentMethod ? ` · ${paymentLabel(expense.paymentMethod, t)}` : ''}
                </Text>
                {meta.authorName ? (
                  <Text
                    className="rounded-full px-1.5 py-px text-[10px] font-bold"
                    style={{ backgroundColor: scheme.muted, color: scheme.mutedForeground }}
                  >
                    {meta.authorName}
                  </Text>
                ) : null}
                {meta.usedByName ? (
                  <Text
                    className="rounded-full px-1.5 py-px text-[10px] font-bold"
                    style={{ backgroundColor: scheme.primarySoft, color: scheme.primary }}
                  >
                    {t('timeline.usedByName', '{{name}} 사용', { name: meta.usedByName })}
                  </Text>
                ) : null}
                {expense.isPersonal ? (
                  <Text className="text-[10px] font-bold" style={{ color: scheme.warning }}>
                    {t('main.personal', '개인')}
                  </Text>
                ) : null}
                <View className="flex-1" />
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: scheme.mutedForeground }}
                >
                  {formatMoneyI18n(expense.baseAmount, expense.baseCurrency, t, language)}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {nowFraction == null ? null : (
          <View
            pointerEvents="none"
            className="absolute left-0 right-0 flex-row items-center"
            style={{ top: nowFraction * height - 4 }}
          >
            <View
              style={{ backgroundColor: scheme.destructive }}
              className="h-2 w-2 rounded-full"
            />
            <View style={{ backgroundColor: scheme.destructive }} className="h-0.5 flex-1" />
          </View>
        )}
      </View>
    </View>
  );
}
