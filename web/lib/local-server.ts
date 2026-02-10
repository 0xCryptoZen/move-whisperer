/**
 * Local Server Client
 * Connects web UI to local MoveWhisperer server
 *
 * Security: Supports API key authentication via X-API-Key header
 */

const DEFAULT_SERVER_URL = 'http://127.0.0.1:3456';

export interface LocalServerConfig {
  baseUrl?: string;
  apiKey?: string;
}

export interface ServerHealth {
  status: 'ok' | 'degraded' | 'offline';
  timestamp: string;
  version: string;
  tools: {
    name: string;
    available: boolean;
    version: string | null;
  }[];
}

export interface DecompileResult {
  success: boolean;
  packageId: string;
  output: string;
  error?: string;
}

export interface ClaudeResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface PackageVersion {
  packageId: string;
  version: number;
  previousPackageId?: string;
  publishedAt?: string;
  digest?: string;
  sender?: string;
  timestampMs?: string;
}

export interface PackageVersionHistory {
  originalPackageId: string;
  upgradeCapId?: string;
  versions: PackageVersion[];
  currentVersion: number;
  network: string;
  fetchedAt: string;
}

export interface VersionCompareResult {
  metadata: {
    fromPackageId: string;
    toPackageId: string;
    fromVersion: number;
    toVersion: number;
    network: string;
    comparedAt: string;
  };
  structural?: {
    fromVersion: number;
    toVersion: number;
    summary: {
      functionsAdded: number;
      functionsRemoved: number;
      functionsModified: number;
      structsAdded: number;
      structsRemoved: number;
      structsModified: number;
      breakingChanges: boolean;
      totalChanges: number;
    };
    changes: Array<{
      type: 'added' | 'removed' | 'modified';
      category: string;
      name: string;
      risk: string;
      description: string;
    }>;
  };
  sources?: Record<string, {
    moduleName: string;
    stats: { linesAdded: number; linesRemoved: number; linesChanged: number };
    existsInOld: boolean;
    existsInNew: boolean;
  }>;
}

/**
 * Local Server Client class
 * Uses a persistent WebSocket for health push and streaming.
 */
export class LocalServerClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private ws: WebSocket | null = null;
  private wsId: string | null = null;
  private messageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private intentionalClose = false;
  private connectingPromise: Promise<string> | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  constructor(config: LocalServerConfig | string = DEFAULT_SERVER_URL) {
    if (typeof config === 'string') {
      this.baseUrl = config;
    } else {
      this.baseUrl = config.baseUrl || DEFAULT_SERVER_URL;
      this.apiKey = config.apiKey || null;
    }
  }

  /**
   * Set API key for authenticated requests
   */
  setApiKey(apiKey: string | null) {
    this.apiKey = apiKey;
  }

  /**
   * Get common headers including API key if set
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Check if local server is running (HTTP fallback, used only for initial probe)
   */
  async checkHealth(): Promise<ServerHealth> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          status: 'offline',
          timestamp: new Date().toISOString(),
          version: '0.0.0',
          tools: [],
        };
      }

      return await response.json() as ServerHealth;
    } catch {
      clearTimeout(timeoutId);
      return {
        status: 'offline',
        timestamp: new Date().toISOString(),
        version: '0.0.0',
        tools: [],
      };
    }
  }

  /**
   * Ensure a persistent WebSocket connection exists.
   * Returns existing connection ID if already connected, or connects if not.
   */
  ensureWebSocket(): Promise<string> {
    // Already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.wsId) {
      return Promise.resolve(this.wsId);
    }

    // Connection in progress
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = this.createWebSocket();
    return this.connectingPromise;
  }

  private createWebSocket(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.intentionalClose = false;

      let wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
      if (this.apiKey) {
        wsUrl += `?apiKey=${encodeURIComponent(this.apiKey)}`;
      }

      const ws = new WebSocket(wsUrl);

      const timeoutId = setTimeout(() => {
        this.connectingPromise = null;
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.onopen = () => {
        this.reconnectDelay = 1000; // Reset backoff on success
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            clearTimeout(timeoutId);
            this.ws = ws;
            this.wsId = data.id;
            this.connectingPromise = null;
            resolve(data.id);
          }

          // Dispatch to all registered handlers for this type
          const handlers = this.messageHandlers.get(data.type);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        } catch (error) {
          console.error('[LocalServer] Failed to parse message:', error);
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, handle reconnect there
      };

      ws.onclose = () => {
        clearTimeout(timeoutId);
        const wasConnected = this.ws === ws;
        this.ws = null;
        this.wsId = null;
        this.connectingPromise = null;

        if (wasConnected) {
          this.onDisconnectCallback?.();
        }

        // Auto-reconnect unless intentionally closed
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureWebSocket().catch(() => {
        // Increase backoff delay
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      });
    }, this.reconnectDelay);
  }

  /**
   * Register a callback for WebSocket disconnect events
   */
  onDisconnect(callback: (() => void) | null) {
    this.onDisconnectCallback = callback;
  }

  /**
   * Register a message handler for a specific type.
   * Returns an unsubscribe function.
   */
  onMessage(type: string, handler: (data: unknown) => void): () => void {
    let handlers = this.messageHandlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.messageHandlers.set(type, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.messageHandlers.delete(type);
      }
    };
  }

  /**
   * Send a message over WebSocket
   */
  sendMessage(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  /**
   * Request health status via WebSocket
   */
  requestHealth() {
    this.sendMessage({ type: 'request_health' });
  }

  /**
   * Get current WebSocket connection ID (for streaming operations)
   */
  getWsId(): string | null {
    return this.wsId;
  }

  /**
   * Check if WebSocket is currently connected
   */
  isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect WebSocket and stop auto-reconnect
   */
  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsId = null;
    }
    this.connectingPromise = null;
  }

  /**
   * Decompile a Sui package using local move-decompiler
   */
  async decompile(
    packageId: string,
    options: {
      bytecode?: Record<string, string>;
      network?: 'mainnet' | 'testnet' | 'devnet';
      module?: string;
      onProgress?: (message: string) => void;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<DecompileResult> {
    const { bytecode, network = 'mainnet', module, onProgress, onStdout, onStderr } = options;

    // Use persistent WebSocket for streaming
    let streamId: string | undefined;
    const hasCallbacks = onProgress || onStdout || onStderr;
    const unsubscribers: (() => void)[] = [];

    if (hasCallbacks) {
      try {
        streamId = await this.ensureWebSocket();

        if (onProgress) {
          unsubscribers.push(this.onMessage('progress', (data: unknown) => {
            const msg = data as { message: string };
            onProgress(msg.message);
          }));
        }
        if (onStdout) {
          unsubscribers.push(this.onMessage('stdout', (data: unknown) => {
            const msg = data as { data: string };
            onStdout(msg.data);
          }));
        }
        if (onStderr) {
          unsubscribers.push(this.onMessage('stderr', (data: unknown) => {
            const msg = data as { data: string };
            onStderr(msg.data);
          }));
        }
      } catch {
        console.warn('[LocalServer] Could not connect WebSocket, continuing without streaming');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/decompile`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          packageId,
          bytecode,
          network,
          module,
          streamId,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || 'Decompilation failed');
      }

      return await response.json() as DecompileResult;
    } finally {
      // Unsubscribe streaming handlers (keep connection alive)
      for (const unsub of unsubscribers) unsub();
    }
  }

  /**
   * Execute a Claude Code CLI command
   */
  async executeClaudeCode(
    prompt: string,
    options: {
      cwd?: string;
      model?: string;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ClaudeResult> {
    const { cwd, model, onStdout, onStderr } = options;

    let streamId: string | undefined;
    const unsubscribers: (() => void)[] = [];

    if (onStdout || onStderr) {
      try {
        streamId = await this.ensureWebSocket();
        if (onStdout) {
          unsubscribers.push(this.onMessage('stdout', (data: unknown) => {
            const msg = data as { data: string };
            onStdout(msg.data);
          }));
        }
        if (onStderr) {
          unsubscribers.push(this.onMessage('stderr', (data: unknown) => {
            const msg = data as { data: string };
            onStderr(msg.data);
          }));
        }
      } catch {
        console.warn('[LocalServer] Could not connect WebSocket, continuing without streaming');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/claude`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          prompt,
          cwd,
          model,
          streamId,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || 'Claude execution failed');
      }

      return await response.json() as ClaudeResult;
    } finally {
      for (const unsub of unsubscribers) unsub();
    }
  }

  /**
   * Execute a terminal command
   */
  async executeTerminal(
    command: string,
    options: { cwd?: string } = {}
  ): Promise<TerminalResult> {
    const response = await fetch(`${this.baseUrl}/api/terminal`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        command,
        cwd: options.cwd,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Command execution failed');
    }

    return await response.json() as TerminalResult;
  }

  /**
   * Get package version history
   */
  async getVersionHistory(
    packageId: string,
    network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet'
  ): Promise<PackageVersionHistory> {
    const response = await fetch(`${this.baseUrl}/api/history`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ packageId, network }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to fetch version history');
    }

    return await response.json() as PackageVersionHistory;
  }

  /**
   * Compare two package versions
   */
  async compareVersions(
    packageId: string,
    fromVersion: number,
    toVersion: number,
    options: {
      network?: 'mainnet' | 'testnet' | 'devnet';
      diffType?: 'structural' | 'source' | 'both';
      module?: string;
    } = {}
  ): Promise<VersionCompareResult> {
    const { network = 'mainnet', diffType = 'structural', module } = options;

    const response = await fetch(`${this.baseUrl}/api/compare`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        packageId,
        network,
        fromVersion,
        toVersion,
        diffType,
        module,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to compare versions');
    }

    return await response.json() as VersionCompareResult;
  }

  /**
   * Analyze version changes using AI
   */
  async analyzeVersionChanges(
    fromVersion: number,
    toVersion: number,
    comparison: VersionCompareResult,
    options: {
      packageId?: string;
      network?: 'mainnet' | 'testnet' | 'devnet';
    } = {}
  ): Promise<string> {
    if (!comparison.structural) {
      throw new Error('No structural comparison data available');
    }

    const response = await fetch(`${this.baseUrl}/api/analyze-changes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        fromVersion,
        toVersion,
        changes: comparison.structural.changes,
        summary: comparison.structural.summary,
        packageId: options.packageId,
        network: options.network,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to analyze version changes');
    }

    const result = await response.json() as { analysis: string };
    return result.analysis;
  }

  /**
   * List available skills
   */
  async listSkills(): Promise<{ skills: { name: string; path: string; preview: string }[] }> {
    const response = await fetch(`${this.baseUrl}/api/skills`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to list skills');
    }

    return await response.json() as { skills: { name: string; path: string; preview: string }[] };
  }

  /**
   * Read full skill content
   */
  async readSkill(name: string): Promise<{ name: string; content: string; path: string }> {
    const response = await fetch(`${this.baseUrl}/api/skills/read`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to read skill');
    }

    return await response.json() as { name: string; content: string; path: string };
  }

  /**
   * Save a skill
   */
  async saveSkill(name: string, content: string): Promise<{ success: boolean; path: string }> {
    const response = await fetch(`${this.baseUrl}/api/skills/save`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, content }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to save skill');
    }

    return await response.json() as { success: boolean; path: string };
  }

  /**
   * Send a chat message using local Claude CLI
   */
  async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: {
      skillMd: string;
      analysisJson?: string;
      sourceCodeSnippet?: string;
      packageId?: string;
      network?: string;
      scene?: string;
      moduleName?: string;
    },
    options: {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const { onStdout, onStderr } = options;

    let streamId: string | undefined;
    const unsubscribers: (() => void)[] = [];

    if (onStdout || onStderr) {
      try {
        streamId = await this.ensureWebSocket();
        if (onStdout) {
          unsubscribers.push(this.onMessage('stdout', (data: unknown) => {
            const msg = data as { data: string };
            onStdout(msg.data);
          }));
        }
        if (onStderr) {
          unsubscribers.push(this.onMessage('stderr', (data: unknown) => {
            const msg = data as { data: string };
            onStderr(msg.data);
          }));
        }
      } catch {
        console.warn('[LocalServer] Could not connect WebSocket for chat streaming');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages,
          context: {
            skillMd: context.skillMd,
            analysisJson: context.analysisJson || '{}',
            sourceCodeSnippet: context.sourceCodeSnippet,
            packageId: context.packageId || '0x0',
            network: context.network || 'mainnet',
            scene: context.scene || 'playground',
            moduleName: context.moduleName,
          },
          streamId,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || 'Chat failed');
      }

      return await response.json() as { success: boolean; output: string; error?: string };
    } finally {
      for (const unsub of unsubscribers) unsub();
    }
  }
}

// Singleton instance
let clientInstance: LocalServerClient | null = null;

/**
 * Get the local server client instance
 */
export function getLocalServerClient(config?: LocalServerConfig | string): LocalServerClient {
  if (!clientInstance || config) {
    clientInstance = new LocalServerClient(config || DEFAULT_SERVER_URL);
  }
  return clientInstance;
}

/**
 * Configure the global client with an API key
 */
export function configureLocalServerApiKey(apiKey: string | null): void {
  const client = getLocalServerClient();
  client.setApiKey(apiKey);
}
