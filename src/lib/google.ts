import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

/**
 * Native Google Sign-In (the standard, secure mobile flow).
 *
 * The device SDK returns an ID token whose `aud` is the **Web client ID**.
 * We send only that ID token to the backend (`POST /api/auth/google`), which
 * verifies it against Google's JWKS and issues our own JWT access/refresh pair.
 * No browser redirect, no client secret on device.
 *
 * Setup:
 *  1. Create OAuth client IDs in Google Cloud Console (Web + iOS + Android).
 *  2. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 *     in .env — app.config.ts derives the reversed iOS URL scheme from the
 *     latter and registers the config plugin (skipped entirely when unset).
 *  3. Rebuild the dev client — this is a native module (`expo prebuild --clean`).
 */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!webClientId && __DEV__) {
    console.warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — see .env.example');
  }
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    // We only need identity here; no Google API access-token/offline access.
    offlineAccess: false,
  });
  configured = true;
}

export class GoogleSignInCancelled extends Error {
  constructor() {
    super('GOOGLE_SIGN_IN_CANCELLED');
    this.name = 'GoogleSignInCancelled';
  }
}

/** Runs the native flow and returns the Google ID token to send to the backend. */
export async function getGoogleIdToken(): Promise<string> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') throw new GoogleSignInCancelled();
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('GOOGLE_NO_ID_TOKEN');
    return idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleSignInCancelled();
    }
    throw error;
  }
}

/** Sign out of the Google SDK (call alongside backend logout). */
export async function googleSignOut(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal — local token clearing is what matters.
  }
}
