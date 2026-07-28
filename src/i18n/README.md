# i18n

`I18nProvider` is wired in `src/app/_layout.tsx`.

- Language preference is stored in MMKV through `useSettingsStore`.
- `system` resolves from `Intl.DateTimeFormat().resolvedOptions().locale`.
- `useI18n().locale` is ready for `Intl` formatters.
- `useI18n().t(key, fallback)` reads flat keys from `ko/en/ja.json`.

The JSON files are still empty; move user-facing strings into them screen by screen.
