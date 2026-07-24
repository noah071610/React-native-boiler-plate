import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getGoogleIdToken, googleSignOut, GoogleSignInCancelled } from '@/lib/google';
import { mmkvStorage } from '@/lib/storage';
import { type AuthUser, googleLogin, logoutRequest, refreshSession } from '@/services/api/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Run once on app start: validate the stored session via token refresh. */
  bootstrap: () => Promise<void>;
  /** Native Google Sign-In → backend session. Returns false if the user cancelled. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      status: 'loading',

      bootstrap: async () => {
        const token = await refreshSession();
        set({ status: token ? 'authenticated' : 'unauthenticated', ...(token ? {} : { user: null }) });
      },

      signInWithGoogle: async () => {
        try {
          const idToken = await getGoogleIdToken();
          const user = await googleLogin(idToken);
          set({ user, status: 'authenticated' });
          return true;
        } catch (error) {
          if (error instanceof GoogleSignInCancelled) return false;
          throw error;
        }
      },

      signOut: async () => {
        await Promise.all([logoutRequest(), googleSignOut()]);
        set({ user: null, status: 'unauthenticated' });
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist the non-sensitive user profile; tokens live in the keychain.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
