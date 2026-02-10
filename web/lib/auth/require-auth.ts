/**
 * Auth Guard for API Routes
 * Extracts and verifies JWT token from request, returns payload or throws 401 Response.
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { extractToken, verifyToken } from './jwt';
import type { JWTPayload } from './types';

export async function requireAuth(request: Request): Promise<JWTPayload> {
  const token = extractToken(request);

  if (!token) {
    throw NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();
  const payload = await verifyToken(JWT_SECRET, token, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (!payload) {
    throw NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return payload;
}
