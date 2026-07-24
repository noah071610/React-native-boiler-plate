/**
 * Semantic text sizes. SOURCE OF TRUTH — keep in sync with the `fontSize`
 * tokens in tailwind.config.js (same names/values). `<AppText>` reads these
 * for the scaled path; the tailwind tokens exist for direct className usage.
 */
export const FONT_SIZES = {
  caption: { size: 12, lineHeight: 16 },
  body: { size: 16, lineHeight: 24 },
  title: { size: 20, lineHeight: 28 },
  heading: { size: 28, lineHeight: 34 },
} as const;

export type TextVariant = keyof typeof FONT_SIZES;
