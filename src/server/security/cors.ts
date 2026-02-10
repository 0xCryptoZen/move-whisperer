/**
 * CORS (Cross-Origin Resource Sharing) handler
 * Properly validates origins against whitelist
 */

import { IncomingMessage, ServerResponse } from 'http';

export interface CorsConfig {
  allowedOrigins: string[];  // Allowed origins (empty = allow all)
  allowedMethods: string[];  // Allowed HTTP methods
  allowedHeaders: string[];  // Allowed request headers
  maxAge: number;            // Preflight cache duration in seconds
  credentials: boolean;      // Allow credentials
}

const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [], // Empty = allow all origins
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  maxAge: 86400, // 24 hours
  credentials: true,
};

/**
 * Create a CORS handler with the given config
 */
export function createCorsHandler(config: Partial<CorsConfig> = {}) {
  const finalConfig: CorsConfig = {
    ...DEFAULT_CORS_CONFIG,
    ...config,
  };

  /**
   * Check if origin is allowed
   */
  function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
      // No origin header = same-origin or non-browser request
      return true;
    }

    // If no origins configured, allow all
    if (finalConfig.allowedOrigins.length === 0) {
      return true;
    }

    return finalConfig.allowedOrigins.includes(origin);
  }

  /**
   * Get CORS headers for a request
   */
  function getCorsHeaders(origin: string | undefined): Record<string, string> {
    const headers: Record<string, string> = {};

    // Only set CORS headers if origin is allowed
    if (isOriginAllowed(origin)) {
      // Set specific origin (not wildcard) when credentials are allowed
      if (origin && finalConfig.credentials) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      } else if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
      } else if (finalConfig.allowedOrigins.length === 0) {
        // No origin in request and no restrictions = allow all
        headers['Access-Control-Allow-Origin'] = '*';
      }

      headers['Access-Control-Allow-Methods'] = finalConfig.allowedMethods.join(', ');
      headers['Access-Control-Allow-Headers'] = finalConfig.allowedHeaders.join(', ');
    }

    return headers;
  }

  /**
   * Get preflight response headers
   */
  function getPreflightHeaders(origin: string | undefined): Record<string, string> {
    const headers = getCorsHeaders(origin);

    if (isOriginAllowed(origin)) {
      headers['Access-Control-Max-Age'] = finalConfig.maxAge.toString();
    }

    return headers;
  }

  return {
    /**
     * Check if origin is allowed
     */
    isAllowed(origin: string | undefined): boolean {
      return isOriginAllowed(origin);
    },

    /**
     * Apply CORS headers to response
     */
    applyHeaders(req: IncomingMessage, res: ServerResponse): void {
      const origin = req.headers.origin;
      const headers = getCorsHeaders(origin);

      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
    },

    /**
     * Handle preflight (OPTIONS) request
     */
    handlePreflight(req: IncomingMessage, res: ServerResponse): boolean {
      if (req.method !== 'OPTIONS') {
        return false;
      }

      const origin = req.headers.origin;

      if (!isOriginAllowed(origin)) {
        // Reject preflight for disallowed origins
        res.writeHead(403);
        res.end('CORS not allowed');
        return true;
      }

      const headers = getPreflightHeaders(origin);

      res.writeHead(204, headers);
      res.end();
      return true;
    },

    /**
     * Middleware-style handler
     * Returns true if request was blocked (CORS violation)
     */
    validate(req: IncomingMessage, res: ServerResponse): boolean {
      const origin = req.headers.origin;

      // No origin = not a CORS request (same-origin or server-to-server)
      if (!origin) {
        return false;
      }

      // Check if origin is allowed
      if (!isOriginAllowed(origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Origin not allowed' }));
        return true; // Request blocked
      }

      // Apply CORS headers
      this.applyHeaders(req, res);
      return false; // Request allowed
    },

    /**
     * Get config (for debugging)
     */
    getConfig(): CorsConfig {
      return { ...finalConfig };
    },
  };
}

export type CorsHandler = ReturnType<typeof createCorsHandler>;
