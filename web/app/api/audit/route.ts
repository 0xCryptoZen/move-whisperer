/**
 * Audit API - Thin fallback route
 *
 * The real audit is done by the server's /api/skill-audit endpoint
 * which invokes Claude CLI with the move-audit SKILL.md.
 * This route only serves as a fallback when the server is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { packageId?: string; sourceCode?: string };

    if (!body.packageId || !body.sourceCode) {
      return NextResponse.json(
        { error: 'packageId and sourceCode are required' },
        { status: 400 }
      );
    }

    // This edge route cannot run Claude CLI.
    // Return a message indicating the server is needed.
    return NextResponse.json({
      success: true,
      audit: {
        version: 1,
        packageId: body.packageId,
        summary: {
          riskLevel: 'unknown',
          overview: 'AI-powered audit requires the MoveWhisperer server. The server uses Claude CLI with the move-audit skill for comprehensive analysis.',
          totalFunctions: 0,
          criticalRiskFunctions: 0,
          highRiskFunctions: 0,
          adminFunctions: 0,
          capabilities: [],
          coinHandlers: [],
        },
        permissions: [],
        vulnerabilities: [],
        recommendations: [
          'Connect to the MoveWhisperer server for AI-powered audit (the server runs Claude CLI with the move-audit skill).',
          'Configure the server URL in Settings (gear icon) or start a local server with: pnpm run serve',
        ],
        aiPowered: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Audit] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit failed' },
      { status: 500 }
    );
  }
}
