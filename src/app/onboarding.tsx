import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryList } from '@/components/domain/country-list';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { type CountryInfo } from '@/constants/currencies';
import { useTheme } from '@/hooks/use-theme';
import { inferBaseCurrency } from '@/lib/create-trip';
import { useAppStore } from '@/store/app';

/**
 * 온보딩 — 단계는 하나다. 나라를 고르는 즉시 메인으로 넘어간다.
 *
 * 여기서 고르는 것은 환율 페어의 현지 쪽 기본값일 뿐이다. 여행이 아니다 —
 * 여행은 기간이 있어야 하고, 기간은 메인의 "여행지 추가하기"에서 정한다.
 * 기준 통화는 묻지 않는다. 기기 지역에서 추론하고, 설정에서 바꿀 수 있다.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [creating, setCreating] = useState(false);

  const select = (country: CountryInfo) => {
    if (creating) return;
    setCreating(true);
    completeOnboarding(country.currency, inferBaseCurrency());
    router.replace('/');
  };

  if (creating) return <FullScreenLoader title="준비하는 중" />;

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: scheme.background,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ color: scheme.primary }} className="text-sm font-black tracking-widest">
        TABICA
      </Text>
      <Text className="mt-2 text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
        어느 나라로 여행을 가세요?
      </Text>
      <Text className="mb-6 mt-2 text-sm font-semibold text-neutral-400">
        지금은 환율만 설정하고 여행 일정은 나중에 추가해요.
      </Text>

      <CountryList onSelect={select} />
    </View>
  );
}
