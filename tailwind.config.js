/** @type {import('tailwindcss').Config} */
const { appColors } = require('./src/constants/theme-color.ts');

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
      // Android ignores fontWeight on custom fonts — pick the family, not the weight.
      // Use `font-sans` / `font-heavy`, never `font-bold`.
      fontFamily: {
        sans: ['Pretendard-Regular'],
        heavy: ['Pretendard-Bold'],
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
  plugins: [],
};
