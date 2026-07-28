import { Plus } from 'lucide-react-native';
import { ImageBackground, Pressable, Text, View } from 'react-native';

import { flagOfDestination } from '@/constants/currencies';
import { HERO_IMAGES, HERO_IMAGES_BY_COUNTRY } from '@/constants/hero-images';
import { localDateKey, type TripPhase } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { destinationLabel, formatMoneyI18n, type TFunction, useI18n } from '@/i18n';

type Props = {
  localCurrency: string;
  destinationCountryCode?: string | null;
  phase: TripPhase;
  startDate: string | null;
  endDate: string | null;
  /** 예산 카드와 같은 표시 통화의 금액 */
  spentBase: number;
  budgetAmount: number | null;
  budgetCurrency: string;
  daysLeft: number | null;
  expenseCount: number;
  /** 여행이 없을 때 히어로 안 CTA — 여행 만들기 시트를 연다 */
  onAddTrip: () => void;
};

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00`) - Date.parse(`${fromKey}T00:00:00`)) / 86_400_000,
  );
}

/** "출발까지 12일" / "여행 3일차" — 여행이 아예 없으면 계획을 권한다 */
function phaseLabel(
  phase: TripPhase,
  startDate: string | null,
  endDate: string | null,
  countryName: string,
  t: TFunction,
): string {
  const todayKey = localDateKey(Date.now());
  if (phase === 'none') {
    return t('main.planTrip', '{{country}} 여행을 계획해보세요.', { country: countryName });
  }
  if (!startDate) return t('main.beforeTrip', '아직 여행 전이에요');
  if (phase === 'before') {
    const d = daysBetween(todayKey, startDate);
    return d === 1
      ? t('main.leaveTomorrow', '내일 출발해요')
      : t('main.daysUntilDeparture', '출발까지 {{days}}일', { days: d });
  }
  if (phase === 'after') {
    const total = endDate ? daysBetween(startDate, endDate) + 1 : null;
    return total
      ? t('main.tripEndedDays', '{{days}}일간의 여행이 끝났어요', { days: total })
      : t('main.tripEnded', '여행이 끝났어요');
  }
  return t('main.tripDay', '여행 {{day}}일차', { day: daysBetween(startDate, todayKey) + 1 });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] font-semibold text-white/60">{label}</Text>
      <Text numberOfLines={1} className="mt-0.5 text-base font-black text-white">
        {value}
      </Text>
    </View>
  );
}

/** §① 히어로 — 어느 나라 / 여행 어디쯤 / 얼마 썼는지를 한 화면에 */
export function TripHero({
  localCurrency,
  destinationCountryCode,
  phase,
  startDate,
  endDate,
  spentBase,
  budgetAmount,
  budgetCurrency,
  daysLeft,
  expenseCount,
  onAddTrip,
}: Props) {
  const { effectiveScheme, scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const image =
    (destinationCountryCode ? HERO_IMAGES_BY_COUNTRY[destinationCountryCode] : undefined) ??
    HERO_IMAGES[localCurrency];
  const remaining = budgetAmount != null ? budgetAmount - spentBase : null;
  const countryName = destinationLabel(destinationCountryCode, localCurrency, t);
  const ctaForeground = effectiveScheme === 'dark' ? scheme.primaryForeground : scheme.primary;
  const money = (minor: number) => formatMoneyI18n(minor, budgetCurrency, t, resolvedLanguage);

  const content = (
    <View className="gap-4 p-5">
      <View>
        <Text className="text-xs font-bold text-white/70">
          {flagOfDestination(destinationCountryCode, localCurrency)} {countryName}
        </Text>
        <Text className="mt-1 text-2xl font-black text-white">
          {phaseLabel(phase, startDate, endDate, countryName, t)}
        </Text>
      </View>

      {phase === 'none' ? (
        // 히어로 배경 위라 테마 대비색만 직접 고정한다.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('main.createTripA11y', '여행 만들기')}
          onPress={onAddTrip}
          style={{
            backgroundColor: effectiveScheme === 'dark' ? scheme.primary : 'rgba(255,255,255,0.9)',
          }}
          className="flex-row items-center gap-1.5 self-start rounded-full px-4 py-2 active:scale-95 active:opacity-80"
        >
          <Plus size={16} color={ctaForeground} strokeWidth={3} />
          <Text style={{ color: ctaForeground }} className="text-sm font-black">
            {t('main.addDestination', '여행지 추가')}
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row gap-3">
          <Stat label={t('analytics.totalSpent', '총 지출')} value={money(spentBase)} />
          <Stat
            label={
              remaining != null && remaining < 0
                ? t('main.overBudget', '예산 초과')
                : t('main.remainingBudget', '남은 예산')
            }
            value={remaining != null ? money(Math.abs(remaining)) : t('common.notSet', '미설정')}
          />
          <Stat
            label={phase === 'after' ? t('main.records', '기록') : t('main.daysLeft', '남은 일수')}
            value={
              phase === 'after' || daysLeft == null
                ? t('main.recordCountValue', '{{count}}건', { count: expenseCount })
                : t('main.dayCount', '{{days}}일', { days: daysLeft })
            }
          />
        </View>
      )}
    </View>
  );

  if (!image) {
    // ponytail: 이미지가 없으면 단색. 그라데이션은 이미지 채우면 필요 없어진다.
    return (
      <View style={{ backgroundColor: scheme.primary }} className="overflow-hidden rounded-3xl">
        {content}
      </View>
    );
  }

  return (
    <ImageBackground
      source={image}
      resizeMode="cover"
      imageStyle={{ borderRadius: 24 }}
      className="overflow-hidden rounded-3xl"
    >
      {/* 사진 위 글씨 가독성용 어둡게 */}
      <View className="bg-black/45">{content}</View>
    </ImageBackground>
  );
}
