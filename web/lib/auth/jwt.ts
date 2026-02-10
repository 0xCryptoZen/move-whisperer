/**
 * JWT Authentication Module
 * Edge-compatible JWT signing and verification using jose library
 */

import * as jose from 'jose';
import type { JWTPayload, User, AuthIdentity } from './types';

const JWT_CONFIG = {
  algorithm: 'HS256' as const,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  sessionMaxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

/**
 * Get JWT secret as Uint8Array from explicit parameter
 */
function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '');
  return `${timestamp}_${random}`;
}

/**
 * Sign a JWT token
 */
export async function signToken(
  secret: string,
  payload: Omit<JWTPayload, 'iss' | 'aud' | 'exp' | 'iat'>,
  options: { expiresIn?: string; issuer?: string; audience?: string } = {}
): Promise<string> {
  const key = encodeSecret(secret);
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iss: options.issuer || 'move-whisperer',
    aud: options.audience || 'web',
    iat: now,
    exp: 0, // Will be set by jose
  };

  const token = await new jose.SignJWT(fullPayload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_CONFIG.algorithm })
    .setIssuedAt()
    .setExpirationTime(options.expiresIn || JWT_CONFIG.accessTokenExpiry)
    .sign(key);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  secret: string,
  token: string,
  options: { issuer?: string; audience?: string } = {}
): Promise<JWTPayload | null> {
  try {
    const key = encodeSecret(secret);

    const { payload } = await jose.jwtVerify(token, key, {
      issuer: options.issuer || 'move-whisperer',
      audience: options.audience || 'web',
    });

    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error('[JWT] Verification failed:', error);
    return null;
  }
}

/**
 * Create access token for a user
 */
export async function createAccessToken(
  secret: string,
  user: User,
  identities: AuthIdentity[],
  sessionId: string,
  options: { issuer?: string; audience?: string } = {}
): Promise<string> {
  const wallets = identities
    .filter(i => i.walletAddress)
    .map(i => i.walletAddress!);

  return signToken(secret, {
    sub: user.id,
    jti: sessionId,
    name: user.displayName || undefined,
    avatar: user.avatarUrl || undefined,
    email: user.email || undefined,
    providers: identities.map(i => i.provider),
    wallets: wallets.length > 0 ? wallets : undefined,
  }, options);
}

/**
 * Parse token from Authorization header or cookie
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies['auth_token']) {
      return cookies['auth_token'];
    }
  }

  return null;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

/**
 * Create Set-Cookie header for auth token
 */
export function createAuthCookie(token: string, maxAge?: number): string {
  const age = maxAge || JWT_CONFIG.sessionMaxAge;

  const parts = [
    `auth_token=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${age}`,
  ];

  // Only set Secure flag when not in local dev (HTTP).
  // Browsers silently reject Secure cookies on non-HTTPS origins.
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  if (!isDev) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Create Set-Cookie header to clear auth token
 */
export function clearAuthCookie(): string {
  return 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

export const SESSION_MAX_AGE = JWT_CONFIG.sessionMaxAge;
