import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import { signIn, signOut, getSession, onAuthStateChange } from '@/lib/api/auth';
import type { AppUser } from '@/lib/api/auth';

let authInitialised = false;

export function useAuth() {
  const login = useAppStore((s) => s.login);
  const logout = useAppStore((s) => s.logout);
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated);
  const user = useAppStore((s) => s.auth.user);

  useEffect(() => {
    if (authInitialised) return;
    authInitialised = true;

    getSession().then((result) => {
      if (result) login(result.user as Parameters<typeof login>[0]);
    });

    const { unsubscribe } = onAuthStateChange((_event, appUser) => {
      if (appUser) {
        login(appUser as Parameters<typeof login>[0]);
      } else {
        logout();
      }
    });

    return () => {
      unsubscribe();
      authInitialised = false;
    };
  }, [login, logout]);

  return {
    isAuthenticated,
    user,
    signIn: async (email: string, password: string) => {
      const appUser = await signIn(email, password);
      login(appUser as Parameters<typeof login>[0]);
      return appUser;
    },
    signOut: async () => {
      await signOut();
      logout();
    },
  };
}

export type { AppUser };
