/**
 * Creator Earnings API
 * GET /api/marketplace/earnings?address=0x... - Get earnings for a creator
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { getCreatorEarnings } from '@/lib/db';
import { extractToken, verifyToken } from '@/lib/auth/jwt';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { DB, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();

    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const payload = await verifyToken(JWT_SECRET, token, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Creator address is required' }, { status: 400 });
    }

    // Only allow users to view their own earnings
    const wallets = payload.wallets as string[] | undefined;
    if (!wallets?.includes(address)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await getCreatorEarnings(DB, address);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Earnings API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
