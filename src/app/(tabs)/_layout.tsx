import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useBundleAutoUpload } from '@/hooks/use-bundle-upload';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';

/**
 * §8 화면 구성 — 탭 4개. 지도 / 캘린더 / 커뮤니티 탭은 만들지 않는다.
 * Native tab bar — real `UITabBarController` on iOS (Liquid Glass on iOS 26+)
 * and Material 3 `NavigationBar` on Android. Shape/layout is drawn by the OS;
 * only colors, labels, icons and badges are ours to set.
 */
export default function TabsLayout() {
  const { effectiveScheme } = useTheme();
  const { t } = useI18n();
  const scheme = colors[effectiveScheme];

  // 초대 코드가 살아 있을 때만 도는 우편함 최신화. 여기(탭 루트)에 두면 앱이 떠 있는
  // 동안 항상 마운트되어 있고, 온보딩·마이그레이션이 끝난 뒤에만 돈다.
  useBundleAutoUpload();

  return (
    <NativeTabs
      tintColor={scheme.primary}
      rippleColor={scheme.primarySoft}
      indicatorColor={scheme.primarySoft}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.main', '메인')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="timeline">
        <NativeTabs.Trigger.Label>{t('tabs.timeline', '타임라인')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="receipt_long" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Label>{t('tabs.analytics', '애널리틱스')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie" md="pie_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('tabs.settings', '설정')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
