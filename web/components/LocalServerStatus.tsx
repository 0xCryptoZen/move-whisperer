'use client';

import { useLocalServer } from '../hooks/useLocalServer';

export function LocalServerStatus() {
  const { isConnected, isConnecting, health, error, connect } = useLocalServer({
    autoConnect: true,
    pollInterval: 30000, // Check every 30 seconds instead of 10
  });

  return (
    <div className="flex items-center gap-3">
      {/* Connection indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnecting
              ? 'bg-yellow-400 animate-pulse'
              : isConnected
                ? 'bg-green-400'
                : 'bg-red-400'
          }`}
        />
        <span className="text-sm text-muted-foreground">
          {isConnecting
            ? 'Connecting...'
            : isConnected
              ? 'Local Server'
              : 'Offline'}
        </span>
      </div>

      {/* Server info tooltip */}
      {isConnected && health && (
        <div className="group relative">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            v{health.version}
          </button>

          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
              <div className="text-xs font-medium mb-2">CLI Tools</div>
              <div className="space-y-1">
                {health.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">{tool.name}</span>
                    <span
                      className={tool.available ? 'text-green-400' : 'text-red-400'}
                    >
                      {tool.available ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reconnect button when offline */}
      {!isConnected && !isConnecting && (
        <button
          onClick={() => connect()}
          className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Connect
        </button>
      )}

      {/* Error display */}
      {error && !isConnecting && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}

/**
 * Server connection required wrapper
 * Shows a message when local server is not connected
 */
export function RequireLocalServer({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isConnected, isConnecting, connect } = useLocalServer();

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Connecting to local server...</p>
      </div>
    );
  }

  if (!isConnected) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center glass-panel rounded-2xl">
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Local Server Required</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          This feature requires the local server to be running. Start the server
          with:
        </p>
        <code className="px-4 py-2 rounded-lg bg-black/50 text-green-400 font-mono text-sm mb-4">
          pnpm serve
        </code>
        <p className="text-xs text-muted-foreground mb-4">
          or
        </p>
        <code className="px-4 py-2 rounded-lg bg-black/50 text-green-400 font-mono text-sm mb-6">
          npx auto-sui-skills serve
        </code>
        <button
          onClick={() => connect()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
