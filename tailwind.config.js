/** @type {import('tailwindcss').Config} */
const { appColors } = require('./src/constants/theme-color.ts');
const plugin = require('tailwindcss/plugin');

const colors = Object.fromEntries(
  Object.entries(appColors.light).map(([name, light]) => [
    name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    { DEFAULT: light, dark: appColors.dark[name] },
  ]),
);

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ['Pretendard'],
        heavy: ['Pretendard'],
      },
      // Semantic sizes — keep in sync with src/lib/typography.ts (FONT_SIZES).
      // <AppText> applies fontScale on top of these; use tokens directly for static text.
      fontSize: {
        caption: [],
        body: [],
        title: [],
        heading: [],
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, theme }) => {
      addUtilities(
        Object.fromEntries(
          Object.entries(theme('fontWeight')).map(([name, weight]) => [
            `.font-${name}`,
            { fontFamily: 'var(--app-font)', fontWeight: weight },
          ]),
        ),
      );
    }),
  ],
};
