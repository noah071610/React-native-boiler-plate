import { CloudSun, RefreshCw } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { countryNameOfCurrency } from '@/constants/currencies';
import { useCurrentWeather } from '@/hooks/queries/use-weather';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type Props = {
  /** 현지 통화로 여행지를 유추한다 (아직 좌표를 저장하지 않는다) */
  localCurrency: string;
};

/**
 * §⑤ 현지 날씨.
 * 값이 없을 때(로딩/실패/키 미설정) 카드가 사라지지 않는다 — 레이아웃이 흔들리는 것보다
 * "곧 알려드릴게요"가 낫다.
 */
export function WeatherCard({ localCurrency }: Props) {
  const { scheme } = useTheme();
  const { data, refetch, isFetching } = useCurrentWeather(localCurrency);

  return (
    <View
      style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
      className="flex-row items-center gap-4 rounded-3xl border p-5"
    >
      <View
        style={{ backgroundColor: scheme.muted }}
        className="h-12 w-12 items-center justify-center rounded-2xl"
      >
        {data ? (
          <Image source={{ uri: data.iconUrl }} style={{ width: 40, height: 40 }} />
        ) : (
          <CloudSun size={24} color={scheme.mutedForeground} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
          {data?.place ?? countryNameOfCurrency(localCurrency)} 날씨
        </Text>
        <Text className="mt-1 text-lg font-black text-neutral-900 dark:text-neutral-50">
          {data ? `${data.tempC}° ${data.condition}` : '곧 알려드릴게요'}
        </Text>
      </View>
      <View className="items-end gap-2">
        {/* 캐시가 1시간을 안 넘겨도 지금 값을 보고 싶을 때가 있다 — 눌러서 강제 갱신 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="날씨 새로고침"
          disabled={isFetching}
          onPress={() => {
            haptics.selection();
            void refetch();
          }}
          hitSlop={12}
          style={{ opacity: isFetching ? 0.4 : 1 }}
          className="active:opacity-50"
        >
          <RefreshCw size={16} color={scheme.mutedForeground} />
        </Pressable>
        {data ? (
          <Text className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
            체감 {data.feelsLikeC}° · 습도 {data.humidity}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}
