/**
 * Security middleware
 * Composes authentication, rate limiting, and validation
 */

import { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import {
  createAuthenticator,
  createRateLimiters,
  createCorsHandler,
  checkEndpointRateLimit,
  getClientIp,
  validateRequest,
  checkBodySize,
} from './security/index.js';
import { type SecurityConfig } from './config.js';

export interface MiddlewareResult {
  allowed: boolean;
  status?: number;
  error?: string;
  headers?: Record<string, string>;
  body?: unknown;  // Validated request body
}

export interface EndpointConfig {
  requireAuth?: boolean;
  rateLimit?: boolean;
  schema?: z.ZodSchema;
}

// Endpoint configurations
const ENDPOINT_CONFIGS: Record<string, EndpointConfig> = {
  '/': { requireAuth: false, rateLimit: false },
  '/health': { requireAuth: false, rateLimit: false },
  // All other endpoints require auth and rate limiting
};

/**
 * Create security middleware
 */
export function createSecurityMiddleware(config: SecurityConfig) {
  // Initialize security components
  const authenticator = createAuthenticator({
    apiKeys: config.apiKeys,
    authLocalhost: config.authLocalhost,
  });

  const rateLimiters = createRateLimiters({
    standardWindowMs: config.rateLimit.windowMs,
    standardMaxRequests: config.rateLimit.standardMaxRequests,
    heavyWindowMs: config.rateLimit.windowMs,
    heavyMaxRequests: config.rateLimit.heavyMaxRequests,
  });

  const corsHandler = createCorsHandler({
    allowedOrigins: config.allowedOrigins,
  });

  return {
    authenticator,
    rateLimiters,
    corsHandler,

    /**
     * Check all security constraints for a request
     */
    async check(
      req: IncomingMessage,
      _res: ServerResponse,
      pathname: string,
      rawBody: string,
      schema?: z.ZodSchema
    ): Promise<MiddlewareResult> {
      const endpointConfig = ENDPOINT_CONFIGS[pathname] || {
        requireAuth: true,
        rateLimit: true,
      };

      // 1. CORS check (for cross-origin requests)
      const origin = req.headers.origin;
      if (origin && !corsHandler.isAllowed(origin)) {
        return {
          allowed: false,
          status: 403,
          error: 'Origin not allowed',
        };
      }

      // 2. Authentication check
      if (endpointConfig.requireAuth !== false && authenticator.isEnabled()) {
        const authResult = authenticator.validate(req);
        if (!authResult.authenticated) {
          return {
            allowed: false,
            status: 401,
            error: authResult.error || 'Unauthorized',
            headers: {
              'WWW-Authenticate': 'ApiKey',
            },
          };
        }
      }

      // 3. Rate limit check
      if (endpointConfig.rateLimit !== false) {
        const clientIp = getClientIp(req);
        const rateLimitResult = checkEndpointRateLimit(rateLimiters, clientIp, pathname);

        if (!rateLimitResult.allowed) {
          return {
            allowed: false,
            status: 429,
            error: 'Too many requests',
            headers: {
              'Retry-After': String(rateLimitResult.retryAfter || 60),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            },
          };
        }
      }

      // 4. Body size check
      if (rawBody && !checkBodySize(rawBody, config.maxBodySize)) {
        return {
          allowed: false,
          status: 413,
          error: `Request body too large. Maximum size: ${config.maxBodySize} bytes`,
        };
      }

      // 5. Body validation (if schema provided)
      if (schema && rawBody) {
        try {
          const parsedBody = JSON.parse(rawBody);
          const validationResult = validateRequest(schema, parsedBody);

          if (!validationResult.success) {
            return {
              allowed: false,
              status: 400,
              error: validationResult.error || 'Invalid request body',
            };
          }

          return {
            allowed: true,
            body: validationResult.data,
          };
        } catch {
          return {
            allowed: false,
            status: 400,
            error: 'Invalid JSON body',
          };
        }
      }

      // All checks passed
      return { allowed: true };
    },

    /**
     * Apply CORS headers to response
     */
    applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
      corsHandler.applyHeaders(req, res);
    },

    /**
     * Handle preflight request
     */
    handlePreflight(req: IncomingMessage, res: ServerResponse): boolean {
      return corsHandler.handlePreflight(req, res);
    },

    /**
     * Validate WebSocket connection
     */
    validateWebSocket(url: string): { allowed: boolean; error?: string } {
      if (!authenticator.isEnabled()) {
        return { allowed: true };
      }

      const result = authenticator.validateWebSocket(url);
      return {
        allowed: result.authenticated,
        error: result.error,
      };
    },

    /**
     * Get security status (for health check)
     */
    getStatus(): {
      authEnabled: boolean;
      rateLimitStats: { standard: object; heavy: object };
    } {
      return {
        authEnabled: authenticator.isEnabled(),
        rateLimitStats: {
          standard: rateLimiters.standard.getStats(),
          heavy: rateLimiters.heavy.getStats(),
        },
      };
    },

    /**
     * Cleanup resources
     */
    destroy(): void {
      rateLimiters.standard.destroy();
      rateLimiters.heavy.destroy();
    },
  };
}

export type SecurityMiddleware = ReturnType<typeof createSecurityMiddleware>;
