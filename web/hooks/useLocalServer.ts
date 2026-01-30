/**
 * React hook for local server connection
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LocalServerClient,
  ServerHealth,
  DecompileResult,
  ClaudeResult,
  getLocalServerClient,
} from '../lib/local-server';

export interface UseLocalServerOptions {
  baseUrl?: string;
  autoConnect?: boolean;
  pollInterval?: number;
}

export interface UseLocalServerReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  health: ServerHealth | null;
  error: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  checkHealth: () => Promise<ServerHealth>;

  // Decompile
  decompile: (
    packageId: string,
    options?: {
      bytecode?: Record<string, string>;
      network?: 'mainnet' | 'testnet' | 'devnet';
      module?: string;
      onProgress?: (message: string) => void;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }
  ) => Promise<DecompileResult>;
  isDecompiling: boolean;
  decompileProgress: string | null;
  decompileOutput: string;

  // Claude Code
  executeClaudeCode: (
    prompt: string,
    options?: { cwd?: string; model?: string }
  ) => Promise<ClaudeResult>;
  isExecutingClaude: boolean;
  claudeOutput: string;

  // Terminal
  executeTerminal: (
    command: string,
    options?: { cwd?: string }
  ) => Promise<{ stdout: string; stderr: string; exitCode: number; success: boolean }>;
  isExecutingTerminal: boolean;
}

export function useLocalServer(
  options: UseLocalServerOptions = {}
): UseLocalServerReturn {
  const { baseUrl, autoConnect = true, pollInterval = 5000 } = options;

  const clientRef = useRef<LocalServerClient | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Operation state
  const [isDecompiling, setIsDecompiling] = useState(false);
  const [decompileProgress, setDecompileProgress] = useState<string | null>(null);
  const [decompileOutput, setDecompileOutput] = useState('');
  const [isExecutingClaude, setIsExecutingClaude] = useState(false);
  const [claudeOutput, setClaudeOutput] = useState('');
  const [isExecutingTerminal, setIsExecutingTerminal] = useState(false);

  // Initialize client
  useEffect(() => {
    clientRef.current = getLocalServerClient(baseUrl);
  }, [baseUrl]);

  // Check health
  const checkHealth = useCallback(async (): Promise<ServerHealth> => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }

    const healthResult = await clientRef.current.checkHealth();
    setHealth(healthResult);
    setIsConnected(healthResult.status !== 'offline');
    setError(healthResult.status === 'offline' ? 'Server offline' : null);
    return healthResult;
  }, []);

  // Connect to server
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await checkHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [checkHealth]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    setIsConnected(false);
    setHealth(null);
  }, []);

  // Auto-connect and poll
  useEffect(() => {
    if (autoConnect) {
      connect();

      // Poll for health status
      pollIntervalRef.current = setInterval(() => {
        checkHealth().catch(console.error);
      }, pollInterval);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [autoConnect, connect, checkHealth, pollInterval]);

  // Decompile
  const decompile = useCallback(
    async (
      packageId: string,
      opts: {
        bytecode?: Record<string, string>;
        network?: 'mainnet' | 'testnet' | 'devnet';
        module?: string;
        onProgress?: (message: string) => void;
        onStdout?: (data: string) => void;
        onStderr?: (data: string) => void;
      } = {}
    ): Promise<DecompileResult> => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      setIsDecompiling(true);
      setDecompileProgress(null);
      setDecompileOutput('');

      try {
        const result = await clientRef.current.decompile(packageId, {
          bytecode: opts.bytecode,
          network: opts.network,
          module: opts.module,
          onProgress: (message: string) => {
            setDecompileProgress(message);
            opts.onProgress?.(message);
          },
          onStdout: (data: string) => {
            setDecompileOutput((prev) => prev + data);
            opts.onStdout?.(data);
          },
          onStderr: (data: string) => {
            opts.onStderr?.(data);
          },
        });
        return result;
      } finally {
        setIsDecompiling(false);
      }
    },
    []
  );

  // Execute Claude Code
  const executeClaudeCode = useCallback(
    async (
      prompt: string,
      opts: { cwd?: string; model?: string } = {}
    ): Promise<ClaudeResult> => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      setIsExecutingClaude(true);
      setClaudeOutput('');

      try {
        const result = await clientRef.current.executeClaudeCode(prompt, {
          ...opts,
          onStdout: (data) => {
            setClaudeOutput((prev) => prev + data);
          },
          onStderr: (data) => {
            setClaudeOutput((prev) => prev + data);
          },
        });
        return result;
      } finally {
        setIsExecutingClaude(false);
      }
    },
    []
  );

  // Execute terminal command
  const executeTerminal = useCallback(
    async (
      command: string,
      opts: { cwd?: string } = {}
    ) => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      setIsExecutingTerminal(true);

      try {
        return await clientRef.current.executeTerminal(command, opts);
      } finally {
        setIsExecutingTerminal(false);
      }
    },
    []
  );

  return {
    // Connection state
    isConnected,
    isConnecting,
    health,
    error,

    // Actions
    connect,
    disconnect,
    checkHealth,

    // Decompile
    decompile,
    isDecompiling,
    decompileProgress,
    decompileOutput,

    // Claude Code
    executeClaudeCode,
    isExecutingClaude,
    claudeOutput,

    // Terminal
    executeTerminal,
    isExecutingTerminal,
  };
}
