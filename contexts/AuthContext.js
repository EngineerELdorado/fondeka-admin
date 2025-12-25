'use client';

import {
  fetchAuthSession,
  signIn,
  signOut,
  confirmSignIn
} from 'aws-amplify/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const refreshSession = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const result = await fetchAuthSession({ forceRefresh });
      setSession(result);
      api.setAuthToken(result?.tokens?.accessToken?.toString() || null);
    } catch (err) {
      setSession(null);
      api.setAuthToken(null);
      console.error('Failed to refresh auth session', err);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    // Proactively refresh access token to avoid expiry during active sessions.
    const interval = setInterval(() => {
      refreshSession(true);
    }, 30 * 60 * 1000); // every 30 minutes
    return () => clearInterval(interval);
  }, [refreshSession]);

  const requestEmailCode = useCallback(async (email) => {
    setLoading(true);
    try {
      // Ensure we start from a clean auth state; Cognito rejects signIn when a user is already signed in.
      try {
        await signOut({ global: true });
      } catch {
        // ignore, best-effort reset
      }
      setSession(null);
      api.setAuthToken(null);

      const res = await signIn({
        username: email,
        options: { authFlowType: 'CUSTOM_WITHOUT_SRP' }
      });

      const step = res?.nextStep?.signInStep || res?.nextStep?.challengeName;
      const isCustom = step === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE' || step === 'CUSTOM_CHALLENGE';
      if (!isCustom) {
        throw new Error('Unexpected authentication step. Please contact support.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmEmailCode = useCallback(async (code) => {
    setLoading(true);
    try {
      const res = await confirmSignIn({ challengeResponse: code });
      const step = res?.nextStep?.signInStep || res?.nextStep?.challengeName;

      if (!step || step === 'DONE') {
        await refreshSession();
        return;
      }

      if (step === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE' || step === 'CUSTOM_CHALLENGE') {
        throw new Error('Code incorrect or expired. A new code was sent.');
      }

      throw new Error('Could not confirm the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await signOut();
    setSession(null);
    api.setAuthToken(null);
  }, []);

  const isAuthenticated = useMemo(() => {
    return Boolean(session?.tokens?.accessToken?.toString());
  }, [session]);

  const value = {
    isAuthenticated,
    loading,
    initialized,
    session,
    requestEmailCode,
    confirmEmailCode,
    logout,
    refreshSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
