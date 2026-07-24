# i18n (placeholder — NOT wired up)

`ko.json` / `en.json` are empty stubs. No i18n library is installed or configured.

To wire up later (suggested): `expo-localization` + `i18next` + `react-i18next`.

```bash
npx expo install expo-localization
npm i i18next react-i18next
```

Then create an `index.ts` here that initializes i18next with these resources and the
device locale from `expo-localization`.
