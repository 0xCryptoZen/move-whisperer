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
  PackageVersionHistory,
  VersionCompareResult,
  getLocalServerClient,
} from '../lib/local-server';

export interface UseLocalServerOptions {
  baseUrl?: string;
  autoConnect?: boolean;
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

  // Version History
  getVersionHistory: (
    packageId: string,
    network?: 'mainnet' | 'testnet' | 'devnet'
  ) => Promise<PackageVersionHistory>;
  compareVersions: (
    packageId: string,
    fromVersion: number,
    toVersion: number,
    options?: {
      network?: 'mainnet' | 'testnet' | 'devnet';
      diffType?: 'structural' | 'source' | 'both';
      module?: string;
    }
  ) => Promise<VersionCompareResult>;
  analyzeVersionChanges: (
    fromVersion: number,
    toVersion: number,
    comparison: VersionCompareResult,
    options?: {
      packageId?: string;
      network?: 'mainnet' | 'testnet' | 'devnet';
    }
  ) => Promise<string>;
  isFetchingHistory: boolean;
  isComparingVersions: boolean;
  isAnalyzingChanges: boolean;
}

export function useLocalServer(
  options: UseLocalServerOptions = {}
): UseLocalServerReturn {
  const { baseUrl, autoConnect = true } = options;

  const clientRef = useRef<LocalServerClient | null>(null);

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
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isComparingVersions, setIsComparingVersions] = useState(false);
  const [isAnalyzingChanges, setIsAnalyzingChanges] = useState(false);

  // Initialize client
  useEffect(() => {
    clientRef.current = getLocalServerClient(baseUrl);
  }, [baseUrl]);

  // Check health (HTTP fallback for manual use)
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

  // Connect via WebSocket (primary method)
  const connect = useCallback(async () => {
    if (!clientRef.current) return;
    setIsConnecting(true);
    setError(null);

    try {
      await clientRef.current.ensureWebSocket();
      // Health data will arrive via WebSocket push, but mark as connected
      setIsConnected(true);
    } catch {
      // WebSocket failed, try HTTP fallback
      try {
        const healthResult = await clientRef.current.checkHealth();
        setHealth(healthResult);
        setIsConnected(healthResult.status !== 'offline');
        if (healthResult.status === 'offline') {
          setError('Server offline');
        }
      } catch {
        setError('Connection failed');
        setIsConnected(false);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    setIsConnected(false);
    setHealth(null);
  }, []);

  // Auto-connect via WebSocket and listen for health pushes
  useEffect(() => {
    if (!autoConnect) return;

    const client = clientRef.current;
    if (!client) return;

    // Listen for health pushes from server
    const unsubHealth = client.onMessage('health', (data: unknown) => {
      const msg = data as { data: ServerHealth };
      if (msg.data) {
        setHealth(msg.data);
        setIsConnected(msg.data.status !== 'offline');
        setError(null);
      }
    });

    // Handle WebSocket disconnect
    client.onDisconnect(() => {
      setIsConnected(false);
      setError('Server disconnected');
    });

    // Initiate connection
    connect();

    return () => {
      unsubHealth();
      client.onDisconnect(null);
    };
  }, [autoConnect, connect]);

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

  // Get version history
  const getVersionHistory = useCallback(
    async (
      packageId: string,
      network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet'
    ): Promise<PackageVersionHistory> => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      setIsFetchingHistory(true);

      try {
        return await clientRef.current.getVersionHistory(packageId, network);
      } finally {
        setIsFetchingHistory(false);
      }
    },
    []
  );

  // Compare versions
  const compareVersions = useCallback(
    async (
      packageId: string,
      fromVersion: number,
      toVersion: number,
      opts: {
        network?: 'mainnet' | 'testnet' | 'devnet';
        diffType?: 'structural' | 'source' | 'both';
        module?: string;
      } = {}
    ): Promise<VersionCompareResult> => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      setIsComparingVersions(true);

      try {
        return await clientRef.current.compareVersions(packageId, fromVersion, toVersion, opts);
      } finally {
        setIsComparingVersions(false);
      }
    },
    []
  );

  // Analyze version changes with AI
  const analyzeVersionChanges = useCallback(
    async (
      fromVersion: number,
      toVersion: number,
      comparison: VersionCompareResult,
      opts: {
        packageId?: string;
        network?: 'mainnet' | 'testnet' | 'devnet';
      } = {}
    ): Promise<string> => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      setIsAnalyzingChanges(true);

      try {
        return await clientRef.current.analyzeVersionChanges(fromVersion, toVersion, comparison, opts);
      } finally {
        setIsAnalyzingChanges(false);
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

    // Version History
    getVersionHistory,
    compareVersions,
    analyzeVersionChanges,
    isFetchingHistory,
    isComparingVersions,
    isAnalyzingChanges,
  };
}
