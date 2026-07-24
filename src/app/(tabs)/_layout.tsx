import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';
import { colors } from '@/theme/colors';

/**
 * §6.1 하단 탭. 설정은 프로필에서 들어간다.
 * Native tab bar — real `UITabBarController` on iOS (Liquid Glass on iOS 26+)
 * and Material 3 `NavigationBar` on Android. Shape/layout is drawn by the OS;
 * only colors, labels, icons and badges are ours to set.
 */
export default function TabsLayout() {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];

  return (
    <NativeTabs
      tintColor={scheme.primary}
      rippleColor={scheme.primarySoft}
      indicatorColor={scheme.primarySoft}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="routine">
        <NativeTabs.Trigger.Label>루틴</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>기록</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>프로필</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
