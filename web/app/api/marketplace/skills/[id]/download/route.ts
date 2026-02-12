/**
 * Skill Download Counter API
 * POST /api/marketplace/skills/[id]/download - Increment download count
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { incrementDownloads } from '@/lib/db';

export const runtime = 'edge';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { DB } = getCloudflareEnv();
    const { id } = await params;
    await incrementDownloads(DB, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Download API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
