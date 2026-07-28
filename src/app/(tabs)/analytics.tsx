import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';
import { useMemo } from 'react';
import { ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { PageHeader } from '@/components/ui/page-header';
import {
  findCountryByCode,
  findCountryByCurrency,
  flagOfDestination,
  type CountryInfo,
} from '@/constants/currencies';
import { HERO_IMAGES, HERO_IMAGES_BY_COUNTRY } from '@/constants/hero-images';
import { db } from '@/db';
import { expenses, type Trip } from '@/db/schema';
import { localDateKey, useActiveTrip } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { formatMoneyI18n, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { sortTripsByRecent } from '@/lib/trip-dates';

type T = ReturnType<typeof useI18n>['t'];

const countryLabel = (country: CountryInfo, t: T) => t(`country.${country.code}`, country.nameKo);

const destinationName = (
  countryCode: string | null | undefined,
  currency: string,
  t: T,
): string => {
  const country = findCountryByCode(countryCode) ?? findCountryByCurrency(currency);
  return country ? countryLabel(country, t) : currency;
};

/**
 * 애널리틱스 — 여행 목록.
 *
 * 분석은 "전체 기간"이 아니라 여행 단위다. 인도네시아 4일과 태국 20일을 한 그래프에
 * 섞으면 어느 쪽 소비 감각도 남지 않는다. 여기서는 어느 여행인지만 고르고,
 * 합계와 그래프는 그 여행의 상세에서 본다.
 */
export default function AnalyticsScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const { resolvedLanguage, t } = useI18n();
  const insets = useSafeAreaInsets();

  const { trips: tripRows, trip: activeTrip, loading } = useActiveTrip();

  const expenseQuery = useLiveQuery(db.select().from(expenses).where(isNull(expenses.deletedAt)));

  /** 여행별 지출 합계(기준 통화)와 건수 */
  const totals = useMemo(() => {
    const map = new Map<string, { base: number; count: number }>();
    for (const e of expenseQuery.data ?? []) {
      const acc = map.get(e.tripId) ?? { base: 0, count: 0 };
      acc.base += e.baseAmount;
      acc.count += 1;
      map.set(e.tripId, acc);
    }
    return map;
  }, [expenseQuery.data]);

  const list = useMemo(() => sortTripsByRecent(tripRows), [tripRows]);

  if (loading) return <FullScreenLoader title={t('analytics.loading', '분석하는 중')} />;

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 16,
        }}
      >
        <PageHeader
          title={t('analytics.title', '애널리틱스')}
          subtitle={t('analytics.subtitle', '여행별로 나눠서 봐요')}
        />

        {list.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-8 py-20">
            <View
              className="mb-2 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${scheme.primary}18` }}
            >
              <BarChart3 size={30} color={scheme.primary} />
            </View>
            <Text className="text-center text-xl font-black text-neutral-900 dark:text-neutral-50">
              {t('analytics.noTripTitle', '아직 여행지 설정이 안되어있어요')}
            </Text>
            <Text
              className="text-center text-sm font-semibold leading-relaxed"
              style={{ color: scheme.mutedForeground }}
            >
              {t(
                'analytics.noTripDescription',
                '메인에서 여행지를 추가하면\n여기에서 여행별 지출 분석을 볼 수 있어요',
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                router.push('/settings');
              }}
              style={{ backgroundColor: scheme.primary }}
              className="mt-3 rounded-full px-6 py-3.5 active:opacity-80"
            >
              <Text style={{ color: scheme.primaryForeground }} className="text-sm font-bold">
                {t('analytics.goSettings', '여행 설정하러 가기')}
              </Text>
            </Pressable>
          </View>
        ) : (
          list.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              total={totals.get(trip.id)?.base ?? 0}
              count={totals.get(trip.id)?.count ?? 0}
              isActive={trip.id === activeTrip?.id}
              resolvedLanguage={resolvedLanguage}
              t={t}
              onPress={() =>
                router.push({ pathname: '/trip-analytics', params: { tripId: trip.id } })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** 기간 라벨 — 기간이 없는 옛 여행도 목록에는 나와야 한다 */
function periodLabel(trip: Trip, t: T): string {
  if (!trip.startDate || !trip.endDate) return t('analytics.periodNotSet', '기간 미설정');
  return `${trip.startDate} – ${trip.endDate}`;
}

function statusLabel(trip: Trip, isActive: boolean, t: T): string | null {
  const todayKey = localDateKey(Date.now());
  if (isActive && trip.startDate && trip.startDate <= todayKey) {
    return t('analytics.statusDuring', '여행 중');
  }
  if (trip.startDate && trip.startDate > todayKey) return t('analytics.statusUpcoming', '예정');
  return null;
}

/** 목록 한 줄 — 메인 히어로와 같은 배경 사진을 쓴다 (같은 여행이라는 감각) */
function TripCard({
  trip,
  total,
  count,
  isActive,
  resolvedLanguage,
  t,
  onPress,
}: {
  trip: Trip;
  total: number;
  count: number;
  isActive: boolean;
  resolvedLanguage: ReturnType<typeof useI18n>['resolvedLanguage'];
  t: T;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  const image =
    (trip.destinationCountryCode
      ? HERO_IMAGES_BY_COUNTRY[trip.destinationCountryCode]
      : undefined) ?? HERO_IMAGES[trip.destinationCurrency];
  const status = statusLabel(trip, isActive, t);
  const name = destinationName(trip.destinationCountryCode, trip.destinationCurrency, t);

  const content = (
    <View className="gap-3 p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-white/70">
          {flagOfDestination(trip.destinationCountryCode, trip.destinationCurrency)} {name}
        </Text>
        {status ? (
          <View className="rounded-full bg-white/25 px-2.5 py-1">
            <Text className="text-[11px] font-black text-white">{status}</Text>
          </View>
        ) : null}
      </View>

      <Text className="text-xl font-black text-white">{periodLabel(trip, t)}</Text>

      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-[11px] font-semibold text-white/60">
            {t('analytics.totalSpent', '총 지출')}
          </Text>
          <Text className="mt-0.5 text-lg font-black text-white">
            {formatMoneyI18n(total, trip.baseCurrency, t, resolvedLanguage)}
          </Text>
        </View>
        <Text className="text-xs font-bold text-white/70">
          {t('analytics.recordCount', '기록 {{count}}건', { count })}
        </Text>
      </View>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('analytics.detailA11y', '{{country}} 여행 상세 분석', {
        country: name,
      })}
      onPress={onPress}
      className="overflow-hidden rounded-3xl active:opacity-90"
    >
      {image ? (
        <ImageBackground source={image} resizeMode="cover" imageStyle={{ borderRadius: 24 }}>
          {/* 사진 위 글씨 가독성용 어둡게 */}
          <View className="bg-black/45">{content}</View>
        </ImageBackground>
      ) : (
        // ponytail: 이미지가 없는 통화는 단색. 그라데이션은 사진을 채우면 필요 없어진다.
        <View style={{ backgroundColor: scheme.primary }}>{content}</View>
      )}
    </Pressable>
  );
}
