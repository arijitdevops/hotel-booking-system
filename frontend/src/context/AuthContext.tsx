import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode, type JSX } from 'react';

import { fetchProfile, login as loginRequest, register as registerRequest } from '../api/auth';
import type { LoginPayload, RegisterPayload } from '../api/auth';
import { ApiError, getAuthToken, setAuthToken } from '../api/client';
import type { User } from '../types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAdmin: boolean;
  signIn: (payload: LoginPayload) => Promise<User>;
  signUp: (payload: RegisterPayload) => Promise<User>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAuthToken() ? 'loading' : 'anonymous',
  );

  // A stored token only proves someone was signed in on this device; the
  // profile call confirms it is still valid before the app trusts it.
  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();

    if (!token) {
      setStatus('anonymous');
      return () => {
        cancelled = true;
      };
    }

    fetchProfile()
      .then((response) => {
        if (cancelled) return;
        setUser(response.user);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setAuthToken(null);
        }
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (payload: LoginPayload): Promise<User> => {
    const response = await loginRequest(payload);
    setAuthToken(response.token);
    setUser(response.user);
    setStatus('authenticated');
    return response.user;
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload): Promise<User> => {
    const response = await registerRequest(payload);
    setAuthToken(response.token);
    setUser(response.user);
    setStatus('authenticated');
    return response.user;
  }, []);

  const signOut = useCallback((): void => {
    setAuthToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signUp,
      signOut,
    }),
    [user, status, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
