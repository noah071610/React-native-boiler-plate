import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { db, sqlite } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme/colors';
import migrations from '../../drizzle/migrations';

export default function RootLayout() {
  const { effectiveScheme } = useTheme();
  const { setColorScheme } = useColorScheme();
  const { success, error } = useMigrations(db, migrations);
  // 개발용 DB 뷰어. `npx expo start` → shift + m → Drizzle Studio.
  useDrizzleStudio(sqlite);

  useEffect(() => {
    setColorScheme('dark');
  }, [setColorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={effectiveScheme === 'dark' ? 'light' : 'dark'} />
          {error ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ color: colors[effectiveScheme].foreground }}>
                데이터를 불러오지 못했어요
              </Text>
              {/* ponytail: 개발 중 마이그레이션 실패 원인 파악용. 출시 전 __DEV__ 블록 유지 */}
              {__DEV__ ? (
                <Text
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
            <FullScreenLoader title="로딩 중" />
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
