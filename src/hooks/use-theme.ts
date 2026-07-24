/**
 * 앱은 다크 모드 전용이다. RootLayout이 NativeWind 스킴을 dark로 고정한다.
 * ponytail: 라이트 모드가 다시 필요해지면 설정 스토어 기반 분기를 되살린다.
 */
export function useTheme() {
  return { effectiveScheme: 'dark' } as { effectiveScheme: 'light' | 'dark' };
}
