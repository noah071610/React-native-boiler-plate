import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, vars } from 'nativewind';
import { useEffect } from 'react';
import { Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { db, sqlite } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { I18nProvider, useI18n } from '@/i18n';
import { queryClient } from '@/lib/query';
import { seedDefaultCategories } from '@/lib/seed-categories';
import { useAppStore } from '@/store/app';
import { useSettingsStore } from '@/store/settings';
import { colors } from '@/theme/colors';
import migrations from '../../drizzle/migrations';

/**
 * 개발용 — 네이티브 스플래시(app.json의 expo-splash-screen)를 이 밀리초만큼 붙잡는다.
 * 0이면 평소대로 첫 화면이 그려질 때 바로 사라진다. 눈으로 확인할 때만 3000쯤 준다.
 * 릴리즈에서는 __DEV__가 false라 이 블록 자체가 돌지 않는다.
 */
const HOLD_SPLASH_MS = 0;
const FONT_BY_LANGUAGE = {
  ko: 'Pretendard',
  en: 'Pretendard',
  ja: 'Rounded Mplus 1c',
} as const;

if (__DEV__ && HOLD_SPLASH_MS > 0) {
  void SplashScreen.preventAutoHideAsync();
  setTimeout(() => void SplashScreen.hideAsync(), HOLD_SPLASH_MS);
}

const defaultFontStyle: TextStyle = { fontFamily: 'Pretendard' };

function applyDefaultFont(Component: typeof Text | typeof TextInput) {
  const target = Component as typeof Component & {
    defaultProps?: { style?: StyleProp<TextStyle> };
  };
  target.defaultProps = target.defaultProps ?? {};
  target.defaultProps.style = [defaultFontStyle, target.defaultProps.style] as StyleProp<TextStyle>;
}

applyDefaultFont(Text);
applyDefaultFont(TextInput);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <RootContent />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootContent() {
  const { effectiveScheme } = useTheme();
  const { setColorScheme } = useColorScheme();
  const { resolvedLanguage, t } = useI18n();
  const { success, error } = useMigrations(db, migrations);
  const onboarded = useAppStore((s) => s.onboarded);
  const theme = useSettingsStore((s) => s.theme);
  const appFontFamily = FONT_BY_LANGUAGE[resolvedLanguage];
  defaultFontStyle.fontFamily = appFontFamily;
  // 개발용 DB 뷰어. `npx expo start` → shift + m → Drizzle Studio.
  useDrizzleStudio(sqlite);

  // 기본 카테고리는 여행과 무관한 전역 데이터다 — 여행이 없어도(설정 → 카테고리 관리)
  // 목록이 비어 보이지 않게 마이그레이션 직후 한 번 심는다. onConflictDoNothing이라 여러 번 돌아도 안전하다.
  useEffect(() => {
    if (success) void seedDefaultCategories();
  }, [success]);

  // 설정의 테마 선택을 nativewind에 반영한다. 'system'이면 OS 설정을 따라간다.
  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  return (
    <View style={[{ flex: 1 }, vars({ '--app-font': appFontFamily })]}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={effectiveScheme === 'dark' ? 'light' : 'dark'} />
        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text className="font-normal" style={{ color: colors[effectiveScheme].foreground }}>
              {t('root.dataLoadFailed', '데이터를 불러오지 못했어요')}
            </Text>
            {/* ponytail: 개발 중 마이그레이션 실패 원인 파악용. 출시 전 __DEV__ 블록 유지 */}
            {__DEV__ ? (
              <Text
                className="font-normal"
                style={{
                  color: colors[effectiveScheme].mutedForeground,
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                {error.message}
              </Text>
            ) : null}
          </View>
        ) : !success ? (
          <FullScreenLoader title={t('root.loading', '로딩 중')} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            {/* 온보딩은 최초 1회. 두 번째 실행부터는 바로 메인이다. */}
            <Stack.Protected guard={onboarded}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="expense" />
              <Stack.Screen name="trip-analytics" />
              <Stack.Screen name="sync" />
            </Stack.Protected>
            <Stack.Protected guard={!onboarded}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>
          </Stack>
        )}
      </QueryClientProvider>
    </View>
  );
}
