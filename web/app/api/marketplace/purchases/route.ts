/**
 * Marketplace Purchases API
 * GET /api/marketplace/purchases - List current user's purchases
 * POST /api/marketplace/purchases - Record a new purchase
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { createPurchase, getUserPurchases, recordEarning, getSkillById } from '@/lib/db';
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

    const purchases = await getUserPurchases(DB, payload.sub);

    return NextResponse.json({ success: true, purchases });
  } catch (error) {
    console.error('[Purchases API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json() as {
      skillId: string;
      accessCapId: string;
      txDigest: string;
      priceMist: number;
      buyerAddress?: string;
    };

    if (!body.skillId || !body.accessCapId || !body.txDigest) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Record purchase
    const purchase = await createPurchase(DB, {
      userId: payload.sub,
      skillId: body.skillId,
      accessCapId: body.accessCapId,
      txDigest: body.txDigest,
      priceMist: body.priceMist || 0,
    });

    // Record earnings for the creator
    const skill = await getSkillById(DB, body.skillId);
    if (skill?.creatorAddress && body.priceMist > 0) {
      await recordEarning(DB, {
        creatorAddress: skill.creatorAddress,
        skillId: body.skillId,
        buyerAddress: body.buyerAddress,
        amountMist: body.priceMist,
        txDigest: body.txDigest,
      });
    }

    return NextResponse.json({ success: true, purchase }, { status: 201 });
  } catch (error) {
    console.error('[Purchases API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
