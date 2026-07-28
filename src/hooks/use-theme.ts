import { useColorScheme } from 'nativewind';
import { colors } from '@/theme/colors';

export function useTheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const effectiveScheme = (colorScheme === 'dark' ? 'dark' : 'light') as 'light' | 'dark';

  return {
    colorScheme,
    effectiveScheme,
    setColorScheme,
    toggleColorScheme,
    scheme: colors[effectiveScheme],
  };
}

