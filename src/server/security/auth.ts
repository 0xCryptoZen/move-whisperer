/**
 * API Key Authentication
 * Validates requests against configured API keys
 */

import { IncomingMessage } from 'http';
import { getClientIp } from './rate-limit.js';

export interface AuthConfig {
  apiKeys: string[];       // Valid API keys
  authLocalhost: boolean;  // Skip auth for localhost (dev mode)
  headerName: string;      // Header to check for API key
}

export interface AuthResult {
  authenticated: boolean;
  error?: string;
  keyId?: string;          // Identifier for the key used (for logging)
}

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  apiKeys: [],
  authLocalhost: true,
  headerName: 'x-api-key',
};

/**
 * Load API keys from environment
 */
export function loadApiKeysFromEnv(): string[] {
  const keysEnv = process.env.API_KEYS;
  if (!keysEnv) {
    return [];
  }
  return keysEnv
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

/**
 * Check if IP is localhost
 */
function isLocalhost(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip === '::ffff:127.0.0.1'
  );
}

/**
 * Create an authenticator with the given config
 */
export function createAuthenticator(config: Partial<AuthConfig> = {}) {
  const finalConfig: AuthConfig = {
    ...DEFAULT_AUTH_CONFIG,
    ...config,
    apiKeys: config.apiKeys ?? loadApiKeysFromEnv(),
  };

  // Check if auth is enabled
  const authEnabled = finalConfig.apiKeys.length > 0;

  return {
    /**
     * Check if authentication is enabled
     */
    isEnabled(): boolean {
      return authEnabled;
    },

    /**
     * Validate a request
     */
    validate(req: IncomingMessage): AuthResult {
      // If no API keys configured, allow all requests
      if (!authEnabled) {
        return { authenticated: true };
      }

      // Check if localhost bypass is enabled
      if (finalConfig.authLocalhost) {
        const clientIp = getClientIp(req);
        if (isLocalhost(clientIp)) {
          return { authenticated: true, keyId: 'localhost' };
        }
      }

      // Get API key from header
      const apiKey = req.headers[finalConfig.headerName];
      if (!apiKey || Array.isArray(apiKey)) {
        return {
          authenticated: false,
          error: 'API key required. Include X-API-Key header.',
        };
      }

      // Validate API key
      const keyIndex = finalConfig.apiKeys.indexOf(apiKey);
      if (keyIndex === -1) {
        return {
          authenticated: false,
          error: 'Invalid API key.',
        };
      }

      // Return success with key identifier (index, for logging)
      return {
        authenticated: true,
        keyId: `key-${keyIndex}`,
      };
    },

    /**
     * Validate a WebSocket connection
     * Checks query parameter or first message
     */
    validateWebSocket(url: string): AuthResult {
      // If no API keys configured, allow all connections
      if (!authEnabled) {
        return { authenticated: true };
      }

      // Parse URL to get query parameters
      try {
        const parsedUrl = new URL(url, 'http://localhost');
        const apiKey = parsedUrl.searchParams.get('apiKey') ||
                       parsedUrl.searchParams.get('api_key') ||
                       parsedUrl.searchParams.get('key');

        if (!apiKey) {
          return {
            authenticated: false,
            error: 'API key required. Include apiKey query parameter.',
          };
        }

        const keyIndex = finalConfig.apiKeys.indexOf(apiKey);
        if (keyIndex === -1) {
          return {
            authenticated: false,
            error: 'Invalid API key.',
          };
        }

        return {
          authenticated: true,
          keyId: `key-${keyIndex}`,
        };
      } catch {
        return {
          authenticated: false,
          error: 'Invalid connection URL.',
        };
      }
    },

    /**
     * Get config (for debugging)
     */
    getConfig(): { enabled: boolean; keyCount: number; authLocalhost: boolean } {
      return {
        enabled: authEnabled,
        keyCount: finalConfig.apiKeys.length,
        authLocalhost: finalConfig.authLocalhost,
      };
    },
  };
}

export type Authenticator = ReturnType<typeof createAuthenticator>;
