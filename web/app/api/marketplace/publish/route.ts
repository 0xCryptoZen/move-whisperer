/**
 * Publish User Skill to Marketplace
 * POST /api/marketplace/publish - Publish a saved user skill directly to marketplace
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { getUserSkillById, checkDuplicateUrl, publishUserSkill } from '@/lib/db';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const { DB } = getCloudflareEnv();

    const body = await request.json() as {
      userSkillId?: string;
      description?: string;
    };

    if (!body.userSkillId) {
      return NextResponse.json({ error: 'userSkillId is required' }, { status: 400 });
    }

    // Fetch the user skill (ensures ownership)
    const userSkill = await getUserSkillById(DB, body.userSkillId, auth.sub);
    if (!userSkill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Check if already published
    const directUrl = `direct://${auth.sub}/${body.userSkillId}`;
    const isDuplicate = await checkDuplicateUrl(DB, directUrl);
    if (isDuplicate) {
      return NextResponse.json({ error: 'This skill has already been published' }, { status: 409 });
    }

    // Publish to marketplace
    const skill = await publishUserSkill(DB, {
      userSkillId: body.userSkillId,
      ownerId: auth.sub,
      title: userSkill.title,
      description: body.description || `Claude skill for ${userSkill.title}`,
      packageId: userSkill.packageId,
      moduleName: userSkill.moduleName,
      scene: userSkill.scene,
      network: userSkill.network,
      skillContent: userSkill.skillMd,
    });

    return NextResponse.json({ success: true, skill }, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[Marketplace Publish] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
