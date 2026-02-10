/**
 * Authentication Types
 * Type definitions for the auth system
 */

export type AuthProvider = 'sui_wallet';

export interface User {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  loginCount: number;
}

export interface AuthIdentity {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerId: string;
  providerData: Record<string, unknown> | null;
  walletAddress: string | null;
  signatureAlgorithm: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  lastActiveAt: number;
  userAgent: string | null;
  ipAddress: string | null;
  revokedAt: number | null;
  revokedReason: string | null;
}

export interface JWTPayload {
  // Standard claims
  iss: string;       // Issuer
  sub: string;       // Subject (User ID)
  aud: string;       // Audience
  exp: number;       // Expiry timestamp
  iat: number;       // Issued at timestamp
  jti: string;       // Session ID (for revocation)

  // Custom claims
  name?: string;     // Display name
  avatar?: string;   // Avatar URL
  email?: string;    // Email
  providers: AuthProvider[];  // Linked providers
  wallets?: string[];        // Sui wallet addresses
}

export interface SuiWalletVerifyRequest {
  address: string;
  signature: string;
  nonce: string;
  publicKey?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface NonceData {
  nonce: string;
  message: string;
  address: string;
  createdAt: number;
  expiresAt: number;
}
