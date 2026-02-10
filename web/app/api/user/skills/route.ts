/**
 * User Skills API
 * GET  /api/user/skills - List saved skills
 * POST /api/user/skills - Save a new skill (max 10)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { listUserSkills, countUserSkills, saveUserSkill, MAX_USER_SKILLS } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const { DB } = getCloudflareEnv();

    const skills = await listUserSkills(DB, auth.sub);

    return NextResponse.json({
      skills: skills.map(s => ({
        id: s.id,
        title: s.title,
        packageId: s.packageId,
        moduleName: s.moduleName,
        network: s.network,
        scene: s.scene,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      count: skills.length,
      limit: MAX_USER_SKILLS,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[User Skills] List error:', err);
    return NextResponse.json({ error: 'Failed to list skills' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const { DB } = getCloudflareEnv();

    // Check limit
    const count = await countUserSkills(DB, auth.sub);
    if (count >= MAX_USER_SKILLS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_USER_SKILLS} saved skills reached. Delete an existing skill to save a new one.` },
        { status: 409 }
      );
    }

    const body = await request.json() as {
      title?: string;
      packageId?: string;
      moduleName?: string;
      network?: string;
      scene?: string;
      skillMd?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.title || !body.packageId || !body.network || !body.scene || !body.skillMd) {
      return NextResponse.json(
        { error: 'Missing required fields: title, packageId, network, scene, skillMd' },
        { status: 400 }
      );
    }

    const skill = await saveUserSkill(DB, {
      userId: auth.sub,
      title: body.title,
      packageId: body.packageId,
      moduleName: body.moduleName,
      network: body.network,
      scene: body.scene,
      skillMd: body.skillMd,
      metadata: body.metadata,
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[User Skills] Save error:', err);
    return NextResponse.json({ error: 'Failed to save skill' }, { status: 500 });
  }
}
