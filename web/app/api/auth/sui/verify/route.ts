/**
 * Sui Wallet - Verify Signature
 * POST /api/auth/sui/verify
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import {
  verifyWalletSignature,
  normalizeAddress,
  detectSignatureAlgorithm,
  isValidSuiAddress,
} from '@/lib/auth/providers/sui-wallet';
import {
  createAccessToken,
  createAuthCookie,
  generateSessionId,
  SESSION_MAX_AGE,
} from '@/lib/auth/jwt';
import type { SuiWalletVerifyRequest } from '@/lib/auth/types';
import { getNonce, deleteNonce } from '@/lib/auth/nonce-store';
import { getUserByWallet, createUser, updateUserLogin, createAuthIdentity, getIdentitiesByUser } from '@/lib/db';
import { createSession } from '@/lib/db';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json() as SuiWalletVerifyRequest;
    const { address, signature, nonce } = body;

    if (!address || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Address, signature, and nonce are required' },
        { status: 400 }
      );
    }

    if (!isValidSuiAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Sui address format' },
        { status: 400 }
      );
    }

    const { DB, CACHE, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();
    const normalizedAddress = normalizeAddress(address);

    // Get stored nonce from KV
    const storedNonce = await getNonce(CACHE, normalizedAddress);
    if (!storedNonce) {
      return NextResponse.json(
        { error: 'No pending authentication request found' },
        { status: 400 }
      );
    }

    // Verify signature
    const verification = await verifyWalletSignature(body, storedNonce);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Signature verification failed' },
        { status: 401 }
      );
    }

    // Delete used nonce
    await deleteNonce(CACHE, normalizedAddress);

    // Detect signature algorithm
    const sigAlgorithm = detectSignatureAlgorithm(signature);

    // Find or create user in D1
    let user = await getUserByWallet(DB, normalizedAddress);
    let identities;

    if (user) {
      // Existing user - update login
      await updateUserLogin(DB, user.id);
      identities = await getIdentitiesByUser(DB, user.id);
    } else {
      // New user - create
      const displayName = `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
      user = await createUser(DB, { displayName });
      const identity = await createAuthIdentity(DB, {
        userId: user.id,
        provider: 'sui_wallet',
        providerId: normalizedAddress,
        walletAddress: normalizedAddress,
        signatureAlgorithm: sigAlgorithm,
        providerData: { verifiedAt: Date.now() },
      });
      identities = [identity];
    }

    // Create session in D1
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    await createSession(DB, {
      id: sessionId,
      userId: user.id,
      expiresAt,
      userAgent: request.headers.get('User-Agent'),
    });

    // Create JWT
    const accessToken = await createAccessToken(
      JWT_SECRET, user, identities, sessionId,
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        walletAddress: normalizedAddress,
      },
    });

    response.headers.set('Set-Cookie', createAuthCookie(accessToken));
    return response;
  } catch (error) {
    console.error('[Sui Auth] Verification error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
