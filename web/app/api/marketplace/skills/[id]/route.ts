/**
 * Marketplace Skill Detail API
 * GET /api/marketplace/skills/[id] - Get a single skill by ID
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { getSkillById } from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { DB } = getCloudflareEnv();
    const skill = await getSkillById(DB, id);

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    return NextResponse.json({ skill });
  } catch (error) {
    console.error('[Marketplace API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
