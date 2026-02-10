/**
 * Marketplace Skills API
 * GET /api/marketplace/skills - List skills with filtering
 * POST /api/marketplace/skills - Submit a new skill
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { listSkills, createSkill, checkDuplicateUrl } from '@/lib/db';
import { extractToken, verifyToken } from '@/lib/auth/jwt';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      scene: searchParams.get('scene') || undefined,
      network: searchParams.get('network') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    const { DB } = getCloudflareEnv();
    const result = await listSkills(DB, filters);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Marketplace API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { DB, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();

    // Verify auth
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const payload = await verifyToken(JWT_SECRET, token, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json() as {
      githubUrl?: string; title?: string; description?: string;
      scene?: string; network?: string; packageId?: string;
    };
    const { githubUrl, title, description, scene, network, packageId } = body;

    if (!githubUrl) {
      return NextResponse.json({ error: 'GitHub URL is required' }, { status: 400 });
    }

    // Validate GitHub URL format
    const urlPattern = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/blob\/([\w.-]+)\/(.+\.md)$/;
    const match = githubUrl.match(urlPattern);
    if (!match) {
      return NextResponse.json({ error: 'Invalid GitHub URL format' }, { status: 400 });
    }

    const [, repoOwner, repoName, , filePath] = match;

    // Check for duplicates
    const isDuplicate = await checkDuplicateUrl(DB, githubUrl);
    if (isDuplicate) {
      return NextResponse.json({ error: 'This skill URL has already been submitted' }, { status: 409 });
    }

    // Create skill in D1
    const skill = await createSkill(DB, {
      githubUrl,
      ownerId: payload.sub,
      title: title || `${repoName} Skill`,
      description: description || `Claude skill for ${repoName}`,
      packageId: packageId || null,
      scene: scene || 'sdk',
      network: network || 'mainnet',
      repoOwner,
      repoName,
      filePath,
    });

    return NextResponse.json({ success: true, skill }, { status: 201 });
  } catch (error) {
    console.error('[Marketplace API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
