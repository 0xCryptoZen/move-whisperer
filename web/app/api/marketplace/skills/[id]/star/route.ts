/**
 * Skill Star API
 * GET  /api/marketplace/skills/[id]/star - Check if current user starred
 * POST /api/marketplace/skills/[id]/star - Toggle star
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { extractToken, verifyToken } from '@/lib/auth/jwt';
import { isStarred, toggleStar } from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ starred: false });
    }

    const { DB, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();
    const payload = await verifyToken(JWT_SECRET, token, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (!payload?.sub) {
      return NextResponse.json({ starred: false });
    }

    const { id } = await params;
    const starred = await isStarred(DB, payload.sub, id);
    return NextResponse.json({ starred });
  } catch {
    return NextResponse.json({ starred: false });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { DB, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();
    const payload = await verifyToken(JWT_SECRET, token, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { id } = await params;
    const starred = await toggleStar(DB, payload.sub, id);
    return NextResponse.json({ starred });
  } catch (error) {
    console.error('[Star API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
