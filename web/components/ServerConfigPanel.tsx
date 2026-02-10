'use client';

import { useState, useEffect } from 'react';

export interface ServerConfig {
  mode: 'local' | 'remote' | 'auto';
  localUrl: string;
  remoteUrl: string;
  apiKey: string;
  anthropicApiKey: string;
  encryptionEnabled: boolean;
  connectionTimeout: number;
}

const DEFAULT_CONFIG: ServerConfig = {
  mode: 'auto',
  localUrl: 'http://localhost:3456',
  remoteUrl: '',
  apiKey: '',
  anthropicApiKey: '',
  encryptionEnabled: true,
  connectionTimeout: 10000,
};

const CONFIG_KEY = 'move-whisperer-server-config';

interface ServerConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: ServerConfig) => void;
}

export default function ServerConfigPanel({
  isOpen,
  onClose,
  onConfigChange,
}: ServerConfigPanelProps) {
  const [config, setConfig] = useState<ServerConfig>(DEFAULT_CONFIG);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load server config:', e);
    }
  }, []);

  // Save config
  const saveConfig = () => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      onConfigChange?.(config);
      onClose();
    } catch (e) {
      console.error('Failed to save server config:', e);
    }
  };

  // Test connection
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const url = config.mode === 'local' ? config.localUrl : config.remoteUrl;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.connectionTimeout);

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as { version?: string };
        setTestResult({
          success: true,
          message: `Connected! Server version: ${data.version || 'unknown'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Server returned status ${response.status}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg glass-panel rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-semibold text-lg">Server Configuration</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Connection Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'local', 'remote'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setConfig(c => ({ ...c, mode }))}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    config.mode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {config.mode === 'auto' && 'Automatically detect local server, fallback to remote'}
              {config.mode === 'local' && 'Always use local server'}
              {config.mode === 'remote' && 'Always use remote server'}
            </p>
          </div>

          {/* Local URL */}
          <div>
            <label className="block text-sm font-medium mb-2">Local Server URL</label>
            <input
              type="url"
              value={config.localUrl}
              onChange={(e) => setConfig(c => ({ ...c, localUrl: e.target.value }))}
              placeholder="http://localhost:3456"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 text-sm"
            />
          </div>

          {/* Remote URL */}
          <div>
            <label className="block text-sm font-medium mb-2">Remote Server URL</label>
            <input
              type="url"
              value={config.remoteUrl}
              onChange={(e) => setConfig(c => ({ ...c, remoteUrl: e.target.value }))}
              placeholder="https://api.example.com"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 text-sm"
            />
          </div>

          {/* Anthropic API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">Anthropic API Key</label>
            <p className="text-xs text-muted-foreground mb-2">
              Optional. Used for AI chat when local Claude CLI is not connected.
            </p>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.anthropicApiKey}
                onChange={(e) => setConfig(c => ({ ...c, anthropicApiKey: e.target.value }))}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 pr-10 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 text-sm font-mono"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showApiKey ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">API Key (for remote server)</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig(c => ({ ...c, apiKey: e.target.value }))}
                placeholder="Enter API key..."
                className="w-full px-3 py-2 pr-10 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 text-sm"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showApiKey ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Encryption Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Enable Encryption</label>
              <p className="text-xs text-muted-foreground">Encrypt requests to remote server</p>
            </div>
            <button
              onClick={() => setConfig(c => ({ ...c, encryptionEnabled: !c.encryptionEnabled }))}
              className={`w-12 h-6 rounded-full transition-colors ${
                config.encryptionEnabled ? 'bg-primary' : 'bg-white/20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                config.encryptionEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Connection Timeout: {config.connectionTimeout / 1000}s
            </label>
            <input
              type="range"
              min="5000"
              max="30000"
              step="1000"
              value={config.connectionTimeout}
              onChange={(e) => setConfig(c => ({ ...c, connectionTimeout: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>

          {/* Test Connection */}
          <button
            onClick={testConnection}
            disabled={testing}
            className={`w-full py-2.5 rounded-xl font-medium transition-all ${
              testing
                ? 'bg-white/5 text-muted-foreground cursor-wait'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {testing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Testing...
              </span>
            ) : (
              'Test Connection'
            )}
          </button>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-xl text-sm ${
              testResult.success
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {testResult.success ? '✓' : '✗'} {testResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-white/10">
          <button
            onClick={() => setConfig(DEFAULT_CONFIG)}
            className="flex-1 py-2.5 rounded-xl font-medium bg-white/5 hover:bg-white/10 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={saveConfig}
            className="flex-1 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to get server config
 */
export function useServerConfig(): ServerConfig {
  const [config, setConfig] = useState<ServerConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      }
    } catch {
      // ignore
    }
  }, []);

  return config;
}

/**
 * Get Anthropic API key from config (localStorage)
 */
export function getAnthropicApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ServerConfig>;
      return parsed.anthropicApiKey || '';
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Get effective server URL based on config
 */
export async function getServerUrl(config: ServerConfig): Promise<string> {
  if (config.mode === 'local') {
    return config.localUrl;
  }

  if (config.mode === 'remote') {
    return config.remoteUrl;
  }

  // Auto mode: try local first
  try {
    const response = await fetch(`${config.localUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      return config.localUrl;
    }
  } catch {
    // Local not available
  }

  return config.remoteUrl;
}
