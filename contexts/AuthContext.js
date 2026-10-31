'use client';

import {
  fetchAuthSession,
  signIn,
  signOut,
  confirmSignIn
} from 'aws-amplify/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { adminPresentationReady } from '@/lib/regulator-presentation';

const AuthContext = createContext(undefined);
const FORBIDDEN_LOGOUT_EVENT = 'fondeka:auth-forbidden';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [adminProfile, setAdminProfile] = useState(null);
  const [adminProfileLoading, setAdminProfileLoading] = useState(false);
  const [adminProfileError, setAdminProfileError] = useState(null);
  const [profileToken, setProfileToken] = useState(null);
  const [profileIdentity, setProfileIdentity] = useState(null);
  const profileVersion = useRef(0);
  const accessToken = session?.tokens?.accessToken?.toString() || null;
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || accessToken;

  const clearAdminProfile = useCallback(() => {
    profileVersion.current += 1;
    setAdminProfile(null);
    setAdminProfileLoading(false);
    setAdminProfileError(null);
    setProfileToken(null);
    setProfileIdentity(null);
  }, []);

  const refreshAdminProfile = useCallback(async () => {
    if (!accessToken) {
      clearAdminProfile();
      return null;
    }
    const version = ++profileVersion.current;
    setAdminProfileLoading(true);
    setAdminProfileError(null);
    try {
      const profile = await api.admins.me();
      if (!adminPresentationReady(profile)) throw new Error('Admin presentation settings are unavailable. Please refresh your profile.');
      if (version === profileVersion.current) {
        setAdminProfile(profile);
        setProfileToken(accessToken);
        setProfileIdentity(identity);
      }
      return profile;
    } catch (err) {
      if (version === profileVersion.current) {
        setAdminProfileError(err);
        setProfileToken(accessToken);
      }
      return null;
    } finally {
      if (version === profileVersion.current) setAdminProfileLoading(false);
    }
  }, [accessToken, identity, clearAdminProfile]);

  useEffect(() => {
    void refreshAdminProfile();
    return () => { profileVersion.current += 1; };
  }, [refreshAdminProfile]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const onFocus = () => { void refreshAdminProfile(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [accessToken, refreshAdminProfile]);

  const refreshSession = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const result = await fetchAuthSession({ forceRefresh });
      setSession(result);
      api.setAuthToken(result?.tokens?.accessToken?.toString() || null);
    } catch (err) {
      clearAdminProfile();
      setSession(null);
      api.setAuthToken(null);
      console.error('Failed to refresh auth session', err);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [clearAdminProfile]);

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
      clearAdminProfile();
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
  }, [clearAdminProfile]);

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
    try {
      await signOut();
    } catch {
      // Best-effort sign out; still clear local auth state below.
    }
    clearAdminProfile();
    setSession(null);
    api.setAuthToken(null);
  }, [clearAdminProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleForbiddenLogout = () => {
      logout();
    };
    window.addEventListener(FORBIDDEN_LOGOUT_EVENT, handleForbiddenLogout);
    return () => window.removeEventListener(FORBIDDEN_LOGOUT_EVENT, handleForbiddenLogout);
  }, [logout]);

  const isAuthenticated = useMemo(() => {
    return Boolean(session?.tokens?.accessToken?.toString());
  }, [session]);

  const currentProfile = profileIdentity === identity ? adminProfile : null;
  const currentProfileError = profileToken === accessToken ? adminProfileError : null;
  const profileLoading = isAuthenticated && (adminProfileLoading || profileToken !== accessToken || (!currentProfile && !currentProfileError));

  const value = {
    isAuthenticated,
    loading,
    initialized,
    session,
    adminProfile: currentProfile,
    enableRegulatorMode: !profileLoading && !currentProfileError && adminPresentationReady(currentProfile) ? currentProfile.enableRegulatorMode : null,
    adminProfileLoading: profileLoading,
    adminProfileError: currentProfileError,
    refreshAdminProfile,
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
