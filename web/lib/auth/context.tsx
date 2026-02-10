'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  authenticateWithWallet: (
    address: string,
    signMessage: (args: { message: Uint8Array }) => Promise<{ signature: string }>
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json() as { authenticated: boolean; user?: { id: string; displayName?: string; wallets?: string[]; avatarUrl?: string } };
        if (data.authenticated && data.user) {
          setUser({
            id: data.user.id,
            displayName: data.user.displayName || '',
            walletAddress: data.user.wallets?.[0] || '',
            avatarUrl: data.user.avatarUrl,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const authenticateWithWallet = useCallback(
    async (
      address: string,
      signMessage: (args: { message: Uint8Array }) => Promise<{ signature: string }>
    ) => {
      try {
        setError(null);

        // 1. Get nonce from server
        const nonceResponse = await fetch('/api/auth/sui/nonce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        });
        if (!nonceResponse.ok) {
          const data = await nonceResponse.json() as { error?: string };
          throw new Error(data.error || 'Failed to get nonce');
        }
        const { nonce, message } = await nonceResponse.json() as { nonce: string; message: string };

        // 2. Sign message via dapp-kit
        const { signature } = await signMessage({
          message: new TextEncoder().encode(message),
        });

        // 3. Verify signature with server
        const verifyResponse = await fetch('/api/auth/sui/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, signature, nonce }),
        });
        if (!verifyResponse.ok) {
          const data = await verifyResponse.json() as { error?: string };
          throw new Error(data.error || 'Signature verification failed');
        }

        // 4. Refresh session to load user from JWT cookie
        await refreshSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Authentication failed';
        setError(msg);
        throw err;
      }
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      setUser(null);
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        authenticateWithWallet,
        logout,
        refreshSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
