/**
 * Nonce Store
 * Uses Cloudflare KV for wallet authentication nonces
 */

import type { NonceData } from './types';

const NONCE_TTL_SECONDS = 600; // 10 minutes

/**
 * Store a nonce in KV
 */
export async function storeNonce(kv: KVNamespace, key: string, data: NonceData): Promise<void> {
  await kv.put(`nonce:${key}`, JSON.stringify(data), {
    expirationTtl: NONCE_TTL_SECONDS,
  });
}

/**
 * Get a nonce from KV
 */
export async function getNonce(kv: KVNamespace, key: string): Promise<NonceData | undefined> {
  const raw = await kv.get(`nonce:${key}`);
  if (!raw) return undefined;
  return JSON.parse(raw) as NonceData;
}

/**
 * Delete a nonce from KV (one-time use)
 */
export async function deleteNonce(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(`nonce:${key}`);
}
