/**
 * Local Server Client
 * Connects web UI to local auto-sui-skill server
 */

const DEFAULT_SERVER_URL = 'http://localhost:3456';

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

/**
 * Local Server Client class
 */
export class LocalServerClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private wsId: string | null = null;
  private messageHandlers: Map<string, (data: unknown) => void> = new Map();

  constructor(baseUrl: string = DEFAULT_SERVER_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if local server is running
   */
  async checkHealth(): Promise<ServerHealth> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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

      return await response.json();
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
   * Connect to WebSocket for streaming
   */
  connectWebSocket(): Promise<string> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LocalServer] WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            this.wsId = data.id;
            resolve(data.id);
          }

          // Call registered handlers
          const handler = this.messageHandlers.get(data.type);
          if (handler) {
            handler(data);
          }
        } catch (error) {
          console.error('[LocalServer] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[LocalServer] WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[LocalServer] WebSocket closed');
        this.ws = null;
        this.wsId = null;
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.wsId) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Register a message handler for a specific type
   */
  onMessage(type: string, handler: (data: unknown) => void) {
    this.messageHandlers.set(type, handler);
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
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsId = null;
    }
  }

  /**
   * Decompile a Sui package using local move-decompiler
   */
  async decompile(
    packageId: string,
    options: {
      bytecode?: Record<string, string>; // base64-encoded bytecode per module
      network?: 'mainnet' | 'testnet' | 'devnet';
      module?: string;
      onProgress?: (message: string) => void;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<DecompileResult> {
    const { bytecode, network = 'mainnet', module, onProgress, onStdout, onStderr } = options;

    // Connect WebSocket for progress/streaming updates if callbacks provided
    let streamId: string | undefined;
    const hasCallbacks = onProgress || onStdout || onStderr;

    if (hasCallbacks) {
      try {
        streamId = await this.connectWebSocket();

        if (onProgress) {
          this.onMessage('progress', (data: unknown) => {
            const msg = data as { message: string };
            onProgress(msg.message);
          });
        }

        if (onStdout) {
          this.onMessage('stdout', (data: unknown) => {
            const msg = data as { data: string };
            onStdout(msg.data);
          });
        }

        if (onStderr) {
          this.onMessage('stderr', (data: unknown) => {
            const msg = data as { data: string };
            onStderr(msg.data);
          });
        }
      } catch {
        console.warn('[LocalServer] Could not connect WebSocket, continuing without streaming');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/decompile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          bytecode,
          network,
          module,
          streamId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Decompilation failed');
      }

      return await response.json();
    } finally {
      if (streamId) {
        this.disconnect();
      }
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

    // Connect WebSocket for streaming if callbacks provided
    let streamId: string | undefined;
    if (onStdout || onStderr) {
      try {
        streamId = await this.connectWebSocket();
        if (onStdout) {
          this.onMessage('stdout', (data: unknown) => {
            const msg = data as { data: string };
            onStdout(msg.data);
          });
        }
        if (onStderr) {
          this.onMessage('stderr', (data: unknown) => {
            const msg = data as { data: string };
            onStderr(msg.data);
          });
        }
      } catch {
        console.warn('[LocalServer] Could not connect WebSocket, continuing without streaming');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          cwd,
          model,
          streamId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Claude execution failed');
      }

      return await response.json();
    } finally {
      if (streamId) {
        this.disconnect();
      }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        cwd: options.cwd,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Command execution failed');
    }

    return await response.json();
  }
}

// Singleton instance
let clientInstance: LocalServerClient | null = null;

/**
 * Get the local server client instance
 */
export function getLocalServerClient(baseUrl?: string): LocalServerClient {
  if (!clientInstance || baseUrl) {
    clientInstance = new LocalServerClient(baseUrl);
  }
  return clientInstance;
}
