'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  useCurrentAccount,
  useConnectWallet,
  useDisconnectWallet,
  useWallets,
  useSignPersonalMessage,
} from '@mysten/dapp-kit';
import { useAuth } from '@/lib/auth/context';

export default function AuthButton() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutateAsync: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { user, loading, authenticateWithWallet, logout, error, clearError } = useAuth();

  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const hasTriedAuth = useRef(false);

  // When wallet connects but user is not authenticated, trigger auth flow
  useEffect(() => {
    if (account && !user && !loading && !authenticating && !hasTriedAuth.current) {
      hasTriedAuth.current = true;
      handleAuthenticate();
    }
    if (!account) {
      hasTriedAuth.current = false;
    }
  }, [account, user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuthenticate = useCallback(async () => {
    if (!account) return;
    setAuthenticating(true);
    try {
      await authenticateWithWallet(account.address, signPersonalMessage);
    } catch {
      // Auth failed - keep wallet connected, just skip server-side auth
      // User can still use the app with wallet address displayed
    } finally {
      setAuthenticating(false);
    }
  }, [account, authenticateWithWallet, signPersonalMessage]);

  const handleDisconnect = useCallback(async () => {
    if (user) {
      await logout();
    }
    disconnectWallet();
    setShowMenu(false);
  }, [user, logout, disconnectWallet]);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    );
  }

  if (authenticating) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-sm text-muted-foreground">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Signing...
      </div>
    );
  }

  // Connected (authenticated or wallet-only): show address
  const walletAddress = user?.walletAddress || account?.address;
  if (walletAddress) {
    const displayName = user?.displayName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors border border-[var(--neon-cyan)]/20 hover:border-[var(--neon-cyan)]/40"
        >
          <div className="w-6 h-6 rounded-full bg-[var(--neon-cyan)]/20 flex items-center justify-center text-[var(--neon-cyan)] text-xs font-mono font-medium">
            {walletAddress.slice(2, 4).toUpperCase()}
          </div>
          <span className="text-sm font-mono text-[var(--neon-cyan)]">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        </button>

        {showMenu && createPortal(
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setShowMenu(false)}
            />
            <div
              className="fixed right-6 top-16 w-56 glass-panel rounded-xl p-2 z-[61]"
            >
              <div className="px-3 py-2 border-b border-white/10 mb-2">
                <div className="font-medium text-sm">{displayName}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
              </div>

              <div className="border-t border-white/10 mt-2 pt-2">
                <button
                  onClick={handleDisconnect}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded-lg transition-colors text-red-400"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  // Not connected: show connect button
  return (
    <>
      <button
        onClick={() => {
          clearError();
          setShowWalletPicker(true);
        }}
        className="px-4 py-2 rounded-xl bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] text-sm font-medium hover:bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/30 hover:border-[var(--neon-cyan)]/50 transition-all hover:shadow-[0_0_12px_rgba(0,240,255,0.2)]"
      >
        Connect Wallet
      </button>

      {showWalletPicker && createPortal(
        <WalletPickerModal
          wallets={wallets}
          onConnect={async (wallet) => {
            try {
              await connectWallet({ wallet });
              setShowWalletPicker(false);
            } catch {
              // Connection cancelled or failed
            }
          }}
          onClose={() => setShowWalletPicker(false)}
          error={error}
        />,
        document.body
      )}
    </>
  );
}

function WalletPickerModal({
  wallets,
  onConnect,
  onClose,
  error,
}: {
  wallets: ReturnType<typeof useWallets>;
  onConnect: (wallet: ReturnType<typeof useWallets>[number]) => Promise<void>;
  onClose: () => void;
  error: string | null;
}) {
  const [connecting, setConnecting] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass-panel rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-semibold text-lg">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Connect your Sui wallet to sign in
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {wallets.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                No Sui wallets detected
              </p>
              <a
                href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg text-sm text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30 hover:bg-[var(--neon-cyan)]/10 transition-colors"
              >
                Install Sui Wallet
              </a>
            </div>
          ) : (
            wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={async () => {
                  setConnecting(wallet.name);
                  try {
                    await onConnect(wallet);
                  } catch {
                    // handled by parent
                  } finally {
                    setConnecting(null);
                  }
                }}
                disabled={connecting !== null}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center gap-3 ${
                  connecting === wallet.name
                    ? 'bg-white/5 cursor-wait'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--neon-cyan)]/30'
                }`}
              >
                {wallet.icon && (
                  <img
                    src={wallet.icon}
                    alt={wallet.name}
                    className="w-8 h-8 rounded-lg"
                  />
                )}
                <span className="flex-1 text-left text-sm">
                  {wallet.name}
                </span>
                {connecting === wallet.name && (
                  <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </button>
            ))
          )}

          <p className="text-xs text-muted-foreground text-center mt-4 pt-2 border-t border-white/5">
            You will be asked to sign a message to verify wallet ownership
          </p>
        </div>
      </div>
    </div>
  );
}
