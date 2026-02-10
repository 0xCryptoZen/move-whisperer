/**
 * User Skill by ID
 * GET    /api/user/skills/[id] - Get full skill content
 * PUT    /api/user/skills/[id] - Update skill (title, content)
 * DELETE /api/user/skills/[id] - Delete skill
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { getUserSkillById, updateUserSkill, deleteUserSkill } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    const { DB } = getCloudflareEnv();

    const skill = await getUserSkillById(DB, params.id, auth.sub);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    return NextResponse.json({ skill });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[User Skills] Get error:', err);
    return NextResponse.json({ error: 'Failed to get skill' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    const { DB } = getCloudflareEnv();

    const body = await request.json() as {
      title?: string;
      skillMd?: string;
    };

    if (!body.title && !body.skillMd) {
      return NextResponse.json(
        { error: 'At least one of title or skillMd is required' },
        { status: 400 }
      );
    }

    const updated = await updateUserSkill(DB, params.id, auth.sub, body);
    if (!updated) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[User Skills] Update error:', err);
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    const { DB } = getCloudflareEnv();

    const deleted = await deleteUserSkill(DB, params.id, auth.sub);
    if (!deleted) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[User Skills] Delete error:', err);
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 });
  }
}
