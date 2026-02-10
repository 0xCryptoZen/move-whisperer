/**
 * Auth Library - Main Exports
 */

// Types
export type {
  AuthProvider,
  User,
  AuthIdentity,
  Session,
  JWTPayload,
  SuiWalletVerifyRequest,
  AuthResult,
  NonceData,
} from './types';

// JWT utilities
export {
  signToken,
  verifyToken,
  createAccessToken,
  extractToken,
  createAuthCookie,
  clearAuthCookie,
  generateSessionId,
  SESSION_MAX_AGE,
} from './jwt';

// Sui wallet provider
export {
  generateWalletNonce,
  verifyWalletSignature,
  normalizeAddress,
  detectSignatureAlgorithm,
  isValidSuiAddress,
} from './providers/sui-wallet';

// Nonce store (KV-backed)
export {
  storeNonce,
  getNonce,
  deleteNonce,
} from './nonce-store';

// Auth guard for API routes
export { requireAuth } from './require-auth';
