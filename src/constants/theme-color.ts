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
    background: '#FFFFFF',
    foreground: '#171717',
    card: '#FFFFFF',
    cardForeground: '#171717',
    popover: '#FFFFFF',
    popoverForeground: '#171717',
    primary: light.primary,
    primaryForeground: light.primaryForeground,
    primarySoft: light.primarySoft,
    primaryDeep: light.primaryDeep,
    secondary: '#F5F5F5',
    secondaryForeground: '#262626',
    muted: '#F5F5F5',
    mutedForeground: '#737373',
    accent: light.primarySoft,
    accentForeground: light.primaryDeep,
    destructive: '#E07A7A',
    destructiveForeground: '#4A1414',
    border: '#E5E5E5',
    input: '#E5E5E5',
    ring: light.primary,
    sidebar: '#FAFAFA',
    sidebarForeground: '#262626',
    sidebarPrimary: light.primary,
    sidebarPrimaryForeground: light.primaryForeground,
    sidebarAccent: light.primarySoft,
    sidebarAccentForeground: light.primaryDeep,
    sidebarBorder: '#E5E5E5',
    sidebarRing: light.primary,
    ...charts,
    success: '#4FB088',
    successForeground: '#0F3D2E',
    warning: '#E8B266',
    warningForeground: '#4A3308',
    overlayDim: '#000000',
    switchOff: '#D4D4D4',
  },
  dark: {
    background: '#171717',
    foreground: '#FAFAFA',
    card: '#262626',
    cardForeground: '#FAFAFA',
    popover: '#262626',
    popoverForeground: '#FAFAFA',
    primary: dark.primary,
    primaryForeground: dark.primaryForeground,
    primarySoft: dark.primarySoft,
    primaryDeep: dark.primaryDeep,
    secondary: '#333333',
    secondaryForeground: '#FAFAFA',
    muted: '#333333',
    mutedForeground: '#A3A3A3',
    accent: dark.primarySoft,
    accentForeground: dark.primary,
    destructive: '#F0A9A9',
    destructiveForeground: '#3D0F0F',
    border: '#404040',
    input: '#404040',
    ring: dark.primary,
    sidebar: '#1F1F1F',
    sidebarForeground: '#FAFAFA',
    sidebarPrimary: dark.primary,
    sidebarPrimaryForeground: dark.primaryForeground,
    sidebarAccent: dark.primarySoft,
    sidebarAccentForeground: dark.primary,
    sidebarBorder: '#404040',
    sidebarRing: dark.primary,
    ...charts,
    success: '#8FD9BC',
    successForeground: '#0F3D2E',
    warning: '#F2D2A0',
    warningForeground: '#3D2A05',
    overlayDim: '#000000',
    switchOff: '#525252',
  },
});

export const themeColors = {
  neon: createTheme({
    light: {
      primary: '#0B6455',
      primaryForeground: '#FFFFFF',
      primaryDeep: '#0B3F36',
      primarySoft: '#D8FBF2',
    },
    dark: {
      primary: '#18EDC6',
      primaryForeground: '#08211D',
      primaryDeep: '#7FF5DE',
      primarySoft: '#214E49',
    },
    charts: {
      chart1: '#18EDC6',
      chart2: '#38BDF8',
      chart3: '#A78BFA',
      chart4: '#FBBF24',
      chart5: '#FB7185',
    },
  }),
} as const satisfies Record<string, ThemeColors>;

export type ThemeName = keyof typeof themeColors;

// Change this one value for a new app, then delete unused palettes if preferred.
export const APP_THEME: ThemeName = 'neon';
export const appColors = themeColors[APP_THEME];
