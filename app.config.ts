import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic layer on top of `app.json` — that file stays the source of truth for
 * everything static. Only env-derived config belongs here.
 *
 * Google Sign-In needs the *reversed* iOS client ID as a URL scheme, which is
 * just the client ID with its domain flipped. Deriving it from the env var we
 * already require means there is no placeholder to forget to replace: set
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and re-run `npx expo prebuild --clean`.
 * Leave it unset and the plugin is skipped entirely — the app builds fine and
 * only Google Sign-In is unavailable.
 */
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** `123-abc.apps.googleusercontent.com` -> `com.googleusercontent.apps.123-abc` */
function reversedIosClientId(clientId: string): string | null {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = iosClientId ? reversedIosClientId(iosClientId) : null;
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    './plugins/with-google-modular-headers',
  ];

  if (iosClientId && !iosUrlScheme) {
    throw new Error(
      `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must end with ".apps.googleusercontent.com" — got "${iosClientId}"`,
    );
  }

  if (iosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  return {
    ...config,
    name: config.name ?? 'tabica',
    slug: config.slug ?? 'tabica',
    plugins,
  };
};
