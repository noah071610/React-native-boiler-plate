# just-one-set-front

Expo (SDK 57) + Expo Router boilerplate. Reusable base — no app-specific logic.

## Stack

| Concern        | Library                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| Runtime        | Expo SDK 57, React Native 0.86, React 19                                        |
| Routing        | expo-router (routes in `src/app/`)                                              |
| Animation      | react-native-reanimated 4 + react-native-worklets, react-native-gesture-handler |
| Styling        | NativeWind 4 + Tailwind 3 (dark mode via `class` + system sync)                 |
| Server state   | @tanstack/react-query                                                           |
| Client state   | zustand (+ MMKV persist)                                                        |
| Storage        | react-native-mmkv (non-sensitive), expo-secure-store (tokens)                   |
| API client     | hono `hc` RPC client (typed against sibling backend)                            |
| Forms          | react-hook-form + zod + @hookform/resolvers                                     |
| Lists / images | @shopify/flash-list, expo-image                                                 |
| Misc           | lucide-react-native, react-native-keyboard-aware-scroll-view, expo-font         |
| Dormant        | expo-notifications, expo-haptics, expo-file-system                              |

## Folder conventions

```
src/
  app/              Expo Router routes only — keep thin, no business logic
  components/
    ui/             Dumb reusable components (dark mode via NativeWind)
    form/           react-hook-form Controller-wrapped inputs
    domain/         Feature-specific composites
  hooks/queries/    TanStack Query hooks — one file per resource
  services/api/     hc client + API functions — the ONLY place fetch happens
  lib/              MMKV instance, secure-store helpers, query client, utils
  store/            zustand stores
  i18n/             Placeholder only (ko.json/en.json) — NOT wired up
```

## Getting started (after clone)

`/ios`, `/android` and `.env` are gitignored, so a fresh clone has to regenerate them.

```bash
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL (mock mode works with it blank)
npx expo prebuild --clean     # regenerates /ios and /android from app.json + app.config.ts
npm run ios                   # or: npm run android
```

Day-to-day, once the dev client is installed on the device:

```bash
npm run dev    # expo start --dev-client
npm run hot    # same, with the Metro cache cleared
```

Requires Xcode (26+ for the iOS 26 Liquid Glass tab bar; older Xcode falls back
to the iOS 18 tab bar and still builds) or Android Studio + JDK 17.
**Expo Go does not work** — `react-native-mmkv` and friends are native modules.

Only `EXPO_PUBLIC_*` vars reach the bundle. Tokens live in the OS keychain via
`src/lib/secure.ts`, never in MMKV or env.

### Google Sign-In

Optional. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (plus the web one) in `.env`
and re-run `npx expo prebuild --clean` — `app.config.ts` derives the reversed
iOS URL scheme from it. Leave it unset and the plugin is skipped.

## Backend types

`src/services/api/client.ts` imports `AppType` from the Hono backend (sibling
folder at repo root). Uncomment the type import there to get end-to-end RPC types.

## Optional additions (intentionally NOT included)

Install only when needed. **Any native module requires `npx expo prebuild --clean` + a rebuild.**

```bash
# Maps
npx expo install react-native-maps                    # global
npm i @mj-studio/react-native-naver-map               # Korea

# Camera
npx expo install expo-camera                          # simple
npm i react-native-vision-camera                      # advanced

# Media & device
npx expo install expo-image-picker expo-sharing
npm i react-native-device-info react-native-calendars
# video processing: react-native-video / ffmpeg-kit-react-native
```
