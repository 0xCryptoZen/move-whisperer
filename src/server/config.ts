/**
 * Server configuration with security settings
 */

export interface SecurityConfig {
  // Authentication
  apiKeys: string[];        // API keys (env: API_KEYS)
  authLocalhost: boolean;   // Skip auth for localhost (env: AUTH_LOCALHOST)

  // Rate limiting
  rateLimit: {
    windowMs: number;           // Window size in ms (env: RATE_LIMIT_WINDOW_MS)
    standardMaxRequests: number; // Standard endpoint limit (env: RATE_LIMIT_MAX)
    heavyMaxRequests: number;   // Heavy endpoint limit (env: RATE_LIMIT_HEAVY_MAX)
  };

  // Request limits
  maxBodySize: number;      // Max request body in bytes (env: MAX_BODY_SIZE)

  // CORS
  allowedOrigins: string[]; // Allowed origins
}

export interface ServerConfig {
  port: number;
  host: string;
  security: SecurityConfig;
}

/**
 * Parse boolean from environment variable
 */
function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer from environment variable
 */
function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse comma-separated list from environment variable
 */
function parseEnvList(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Load security configuration from environment
 */
export function loadSecurityConfig(): SecurityConfig {
  return {
    // Authentication
    apiKeys: parseEnvList(process.env.API_KEYS),
    authLocalhost: parseEnvBool(process.env.AUTH_LOCALHOST, true),

    // Rate limiting
    rateLimit: {
      windowMs: parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
      standardMaxRequests: parseEnvInt(process.env.RATE_LIMIT_MAX, 100),
      heavyMaxRequests: parseEnvInt(process.env.RATE_LIMIT_HEAVY_MAX, 10),
    },

    // Request limits
    maxBodySize: parseEnvInt(process.env.MAX_BODY_SIZE, 5 * 1024 * 1024), // 5MB

    // CORS - empty array = allow all origins
    allowedOrigins: parseEnvList(process.env.ALLOWED_ORIGINS, []),
  };
}

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: parseEnvInt(process.env.PORT, 3456),
  host: process.env.HOST || '0.0.0.0',
  security: loadSecurityConfig(),
};

/**
 * Create server config with overrides
 */
export function createServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...DEFAULT_SERVER_CONFIG,
    ...overrides,
    security: {
      ...DEFAULT_SERVER_CONFIG.security,
      ...overrides.security,
    },
  };
}
