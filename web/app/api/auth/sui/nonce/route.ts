/**
 * Sui Wallet - Generate Nonce
 * POST /api/auth/sui/nonce
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import {
  generateWalletNonce,
  isValidSuiAddress,
  normalizeAddress,
} from '@/lib/auth/providers/sui-wallet';
import { storeNonce } from '@/lib/auth/nonce-store';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body as { address?: string };

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!isValidSuiAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Sui address format' },
        { status: 400 }
      );
    }

    const { CACHE } = getCloudflareEnv();

    // Generate nonce
    const nonceData = generateWalletNonce(address);

    // Store nonce in KV (keyed by normalized address)
    const key = normalizeAddress(address);
    await storeNonce(CACHE, key, nonceData);

    return NextResponse.json({
      nonce: nonceData.nonce,
      message: nonceData.message,
      expiresAt: nonceData.expiresAt,
    });
  } catch (error) {
    console.error('[Sui Auth] Nonce generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate nonce' },
      { status: 500 }
    );
  }
}
