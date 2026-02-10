/**
 * Rate limiting implementation using sliding window algorithm
 * In-memory per-IP rate limiting with configurable limits
 */

export interface RateLimitConfig {
  windowMs: number;      // Window size in milliseconds
  maxRequests: number;   // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;       // Unix timestamp when limit resets
  retryAfter?: number;   // Seconds until retry allowed (if blocked)
}

interface RequestRecord {
  timestamps: number[];  // Request timestamps within window
}

/**
 * In-memory rate limiter with sliding window
 */
export class RateLimiter {
  private records: Map<string, RequestRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private config: RateLimitConfig = {
      windowMs: 60000,   // 1 minute
      maxRequests: 100,
    }
  ) {
    // Cleanup old records every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed and record it
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create record
    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Remove timestamps outside current window
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    // Calculate remaining requests
    const remaining = Math.max(0, this.config.maxRequests - record.timestamps.length);
    const resetAt = record.timestamps.length > 0
      ? record.timestamps[0] + this.config.windowMs
      : now + this.config.windowMs;

    // Check if allowed
    if (record.timestamps.length >= this.config.maxRequests) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Record this request
    record.timestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  }

  /**
   * Reset limit for a key
   */
  reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Cleanup old records
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, record] of this.records.entries()) {
      // Remove old timestamps
      record.timestamps = record.timestamps.filter(ts => ts > windowStart);

      // Remove empty records
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Get current stats
   */
  getStats(): { totalKeys: number; totalRequests: number } {
    let totalRequests = 0;
    for (const record of this.records.values()) {
      totalRequests += record.timestamps.length;
    }
    return {
      totalKeys: this.records.size,
      totalRequests,
    };
  }
}

// ============ Endpoint-specific Rate Limiters ============

/**
 * Heavy endpoints (AI, decompilation) - stricter limits
 */
export const HEAVY_ENDPOINTS = [
  '/api/decompile',
  '/api/claude',
  '/api/analyze-contract',
  '/api/analyze-changes',
  '/api/transaction/skill',
  '/api/terminal',
];

/**
 * Endpoints excluded from rate limiting
 */
export const EXEMPT_ENDPOINTS = [
  '/',
  '/health',
];

export interface EndpointRateLimiters {
  standard: RateLimiter;
  heavy: RateLimiter;
}

/**
 * Create rate limiters for different endpoint classes
 */
export function createRateLimiters(config?: {
  standardWindowMs?: number;
  standardMaxRequests?: number;
  heavyWindowMs?: number;
  heavyMaxRequests?: number;
}): EndpointRateLimiters {
  return {
    standard: new RateLimiter({
      windowMs: config?.standardWindowMs ?? 60000,
      maxRequests: config?.standardMaxRequests ?? 100,
    }),
    heavy: new RateLimiter({
      windowMs: config?.heavyWindowMs ?? 60000,
      maxRequests: config?.heavyMaxRequests ?? 10,
    }),
  };
}

/**
 * Check rate limit for a specific endpoint
 */
export function checkEndpointRateLimit(
  limiters: EndpointRateLimiters,
  ip: string,
  endpoint: string
): RateLimitResult {
  // Skip exempt endpoints
  if (EXEMPT_ENDPOINTS.includes(endpoint)) {
    return { allowed: true, remaining: -1, resetAt: 0 };
  }

  // Use heavy limiter for heavy endpoints
  const limiter = HEAVY_ENDPOINTS.includes(endpoint)
    ? limiters.heavy
    : limiters.standard;

  // Create composite key: ip + endpoint class
  const key = HEAVY_ENDPOINTS.includes(endpoint)
    ? `${ip}:heavy`
    : `${ip}:standard`;

  return limiter.check(key);
}

/**
 * Get client IP from request
 */
export function getClientIp(req: {
  headers: { [key: string]: string | string[] | undefined };
  socket?: { remoteAddress?: string };
}): string {
  // Check X-Forwarded-For header (proxy)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket address
  return req.socket?.remoteAddress ?? 'unknown';
}
