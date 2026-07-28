export type ThemeScheme = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  primarySoft: string;
  primaryDeep: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  overlayDim: string;
  switchOff: string;
};

export type ThemeColors = { light: ThemeScheme; dark: ThemeScheme };

type ThemeSeed = {
  light: Pick<ThemeScheme, 'primary' | 'primaryDeep' | 'primarySoft' | 'primaryForeground'>;
  dark: Pick<ThemeScheme, 'primary' | 'primaryDeep' | 'primarySoft' | 'primaryForeground'>;
  charts: Pick<ThemeScheme, 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'chart5'>;
};

const createTheme = ({ light, dark, charts }: ThemeSeed): ThemeColors => ({
  light: {
    background: '#F4F8FA',
    foreground: '#0F172A',
    card: '#FFFFFF',
    cardForeground: '#0F172A',
    popover: '#FFFFFF',
    popoverForeground: '#0F172A',
    primary: light.primary,
    primaryForeground: light.primaryForeground,
    primarySoft: light.primarySoft,
    primaryDeep: light.primaryDeep,
    secondary: '#E8F2F8',
    secondaryForeground: '#0F2942',
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    accent: light.primarySoft,
    accentForeground: light.primaryDeep,
    destructive: '#F87171',
    destructiveForeground: '#450A0A',
    border: '#E2E8F0',
    input: '#E2E8F0',
    ring: light.primary,
    sidebar: '#EEF5FA',
    sidebarForeground: '#0F2942',
    sidebarPrimary: light.primary,
    sidebarPrimaryForeground: light.primaryForeground,
    sidebarAccent: light.primarySoft,
    sidebarAccentForeground: light.primaryDeep,
    sidebarBorder: '#E2E8F0',
    sidebarRing: light.primary,
    ...charts,
    success: '#34D399',
    successForeground: '#064E3B',
    warning: '#FBBF24',
    warningForeground: '#4A2A00',
    overlayDim: 'rgba(15, 23, 42, 0.4)',
    switchOff: '#CBD5E1',
  },
  dark: {
    background: '#0C1726',
    foreground: '#F1F5F9',
    card: '#152238',
    cardForeground: '#F1F5F9',
    popover: '#152238',
    popoverForeground: '#F1F5F9',
    primary: dark.primary,
    primaryForeground: dark.primaryForeground,
    primarySoft: dark.primarySoft,
    primaryDeep: dark.primaryDeep,
    secondary: '#1E2E4A',
    secondaryForeground: '#F1F5F9',
    muted: '#1E2E4A',
    mutedForeground: '#94A3B8',
    accent: dark.primarySoft,
    accentForeground: dark.primary,
    destructive: '#FCA5A5',
    destructiveForeground: '#450A0A',
    border: '#243654',
    input: '#243654',
    ring: dark.primary,
    sidebar: '#09121F',
    sidebarForeground: '#F1F5F9',
    sidebarPrimary: dark.primary,
    sidebarPrimaryForeground: dark.primaryForeground,
    sidebarAccent: dark.primarySoft,
    sidebarAccentForeground: dark.primary,
    sidebarBorder: '#243654',
    sidebarRing: dark.primary,
    ...charts,
    success: '#6EE7B7',
    successForeground: '#064E3B',
    warning: '#FDE047',
    warningForeground: '#4A2A00',
    overlayDim: 'rgba(0, 0, 0, 0.6)',
    switchOff: '#475569',
  },
});

export const themeColors = {
  sky: createTheme({
    light: {
      primary: '#0284C7',
      primaryForeground: '#FFFFFF',
      primaryDeep: '#0369A1',
      primarySoft: '#E0F2FE',
    },
    dark: {
      primary: '#38BDF8',
      primaryForeground: '#082F49',
      primaryDeep: '#7DD3FC',
      primarySoft: '#163A5C',
    },
    charts: {
      chart1: '#38BDF8',
      chart2: '#818CF8',
      chart3: '#34D399',
      chart4: '#F472B6',
      chart5: '#FBBF24',
    },
  }),
} as const satisfies Record<string, ThemeColors>;

export type ThemeName = keyof typeof themeColors;

// Change this one value for a new app, then delete unused palettes if preferred.
export const APP_THEME: ThemeName = 'sky';
export const appColors = themeColors[APP_THEME];

