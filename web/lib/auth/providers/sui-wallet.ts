/**
 * Sui Wallet Authentication Provider
 * Handles Sui wallet signature verification for authentication
 */

import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import type { NonceData, SuiWalletVerifyRequest } from '../types';

// Nonce configuration
const NONCE_CONFIG = {
  expiryMs: 5 * 60 * 1000, // 5 minutes
  messagePrefix: 'Sign this message to authenticate with MoveWhisperer:\n\n',
};

/**
 * Generate a nonce for wallet signing
 */
export function generateWalletNonce(address: string): NonceData {
  const nonce = generateSecureNonce();
  const now = Date.now();

  const message = formatSignMessage(nonce, address);

  return {
    nonce,
    message,
    address: normalizeAddress(address),
    createdAt: now,
    expiresAt: now + NONCE_CONFIG.expiryMs,
  };
}

/**
 * Generate a secure random nonce
 */
function generateSecureNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format the message to be signed
 */
function formatSignMessage(nonce: string, address: string): string {
  const timestamp = new Date().toISOString();
  return [
    NONCE_CONFIG.messagePrefix,
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
    '',
    'This signature does not authorize any blockchain transactions.',
  ].join('\n');
}

/**
 * Normalize Sui address (ensure 0x prefix and lowercase)
 */
export function normalizeAddress(address: string): string {
  let normalized = address.toLowerCase();
  if (!normalized.startsWith('0x')) {
    normalized = '0x' + normalized;
  }
  // Pad to 66 characters (0x + 64 hex chars)
  if (normalized.length < 66) {
    normalized = '0x' + normalized.slice(2).padStart(64, '0');
  }
  return normalized;
}

/**
 * Verify a wallet signature
 */
export async function verifyWalletSignature(
  request: SuiWalletVerifyRequest,
  storedNonce: NonceData
): Promise<{ valid: boolean; error?: string }> {
  const { address, signature, nonce } = request;

  // Validate nonce
  if (nonce !== storedNonce.nonce) {
    return { valid: false, error: 'Invalid nonce' };
  }

  // Check expiry
  if (Date.now() > storedNonce.expiresAt) {
    return { valid: false, error: 'Nonce expired' };
  }

  // Normalize addresses
  const normalizedAddress = normalizeAddress(address);
  const normalizedStoredAddress = normalizeAddress(storedNonce.address);

  if (normalizedAddress !== normalizedStoredAddress) {
    return { valid: false, error: 'Address mismatch' };
  }

  try {
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(storedNonce.message);

    // Verify using Sui SDK
    const publicKey = await verifyPersonalMessageSignature(
      messageBytes,
      signature
    );

    // Get address from public key
    const recoveredAddress = publicKey.toSuiAddress();

    // Compare addresses
    if (normalizeAddress(recoveredAddress) !== normalizedAddress) {
      return { valid: false, error: 'Signature does not match address' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[Sui Wallet] Signature verification failed:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Get signature algorithm from signature format
 */
export function detectSignatureAlgorithm(
  signature: string
): 'ed25519' | 'secp256k1' | 'secp256r1' | 'unknown' {
  // Sui signatures have a flag byte indicating the scheme
  // 0x00 = Ed25519, 0x01 = Secp256k1, 0x02 = Secp256r1
  try {
    // Decode base64 signature
    const bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const flag = bytes[0];

    switch (flag) {
      case 0x00:
        return 'ed25519';
      case 0x01:
        return 'secp256k1';
      case 0x02:
        return 'secp256r1';
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Validate Sui address format
 */
export function isValidSuiAddress(address: string): boolean {
  // Sui addresses are 32 bytes (64 hex chars) with 0x prefix
  const normalized = normalizeAddress(address);
  return /^0x[a-f0-9]{64}$/i.test(normalized);
}
