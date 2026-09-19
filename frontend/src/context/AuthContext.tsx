import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  type AuthPrincipal,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithGoogleRedirect as fbSignInWithGoogleRedirect,
  checkRedirectResult,
  signInDevMockUser,
  signOutUser as fbSignOutUser,
  getFreshIdToken,
  subscribeToAuthState,
} from '../services/firebase';
import { VeriJournalApiClient } from '../services/apiClient';

interface AuthContextValue {
  principal: AuthPrincipal | null;
  loading: boolean;
  isMockUser: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInAsDevMock: (email?: string, name?: string) => void;
  signOut: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  apiClient: VeriJournalApiClient;
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleAuthExpired = useCallback(() => {
    setSessionExpired(true);
  }, []);

  const getToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (!principal) return null;
      return await getFreshIdToken(rawUser, principal.isMock, forceRefresh);
    },
    [principal, rawUser]
  );

  const apiClient = useMemo(() => {
    return new VeriJournalApiClient(getToken, handleAuthExpired);
  }, [getToken, handleAuthExpired]);

  useEffect(() => {
    // Check if returning from full page redirect sign-in
    checkRedirectResult()
      .then((res) => {
        if (res) {
          setPrincipal(res.principal);
          setRawUser(res.rawUser);
          setSessionExpired(false);
        }
      })
      .catch((err) => {
        console.warn('Redirect sign-in notice:', err);
      });

    // Subscribe to Firebase client SDK auth state
    const unsubscribe = subscribeToAuthState((userPrincipal, firebaseUser) => {
      if (userPrincipal) {
        setPrincipal(userPrincipal);
        setRawUser(firebaseUser);
        setSessionExpired(false);
      } else {
        setPrincipal(null);
        setRawUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const res = await fbSignInWithGoogle();
      setPrincipal(res.principal);
      setRawUser(res.rawUser);
      setSessionExpired(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirectSignIn = async () => {
    setLoading(true);
    try {
      await fbSignInWithGoogleRedirect();
    } finally {
      setLoading(false);
    }
  };

  const handleDevMockSignIn = (email?: string, name?: string) => {
    const mock = signInDevMockUser(email, name);
    setPrincipal(mock);
    setRawUser(null);
    setSessionExpired(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fbSignOutUser();
      setPrincipal(null);
      setRawUser(null);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      principal,
      loading,
      isMockUser: principal?.isMock ?? false,
      signInWithGoogle: handleGoogleSignIn,
      signInWithGoogleRedirect: handleGoogleRedirectSignIn,
      signInAsDevMock: handleDevMockSignIn,
      signOut: handleSignOut,
      getToken,
      apiClient,
      sessionExpired,
      dismissSessionExpired: () => setSessionExpired(false),
    }),
    [principal, loading, getToken, apiClient, sessionExpired]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
