/**
 * Skill-based audit endpoint
 * Reads .claude/skills/move-audit/SKILL.md and injects it as prompt context
 * for Claude CLI to perform a comprehensive Sui Move security audit.
 */

import { ServerResponse } from 'http';
import { WebSocket } from 'ws';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { commandExists, streamCommand, executeCommand } from '../terminal.js';

interface SkillAuditRequest {
  packageId: string;
  sourceCode: string;
  network?: string;
  version?: number;
  streamId?: string;
}

// Cache the SKILL.md content to avoid re-reading on every request
let cachedSkillMd: string | null = null;

/**
 * Load the move-audit SKILL.md content (cached)
 */
async function loadSkillMd(): Promise<string> {
  if (cachedSkillMd) return cachedSkillMd;

  // Try multiple possible locations
  const candidates = [
    resolve(process.cwd(), '.claude/skills/move-audit/SKILL.md'),
    resolve(process.cwd(), '../.claude/skills/move-audit/SKILL.md'),
  ];

  for (const path of candidates) {
    try {
      const content = await readFile(path, 'utf-8');
      // Strip frontmatter (--- ... ---) since we're injecting as prompt
      const stripped = content.replace(/^---[\s\S]*?---\n*/, '');
      cachedSkillMd = stripped;
      console.log(`[SkillAudit] Loaded SKILL.md from ${path} (${stripped.length} chars)`);
      return cachedSkillMd;
    } catch {
      // Try next candidate
    }
  }

  throw new Error('move-audit SKILL.md not found');
}

/**
 * Build the full audit prompt
 */
function buildAuditPrompt(skillMd: string, request: SkillAuditRequest): string {
  const { packageId, sourceCode, network = 'mainnet', version } = request;

  return `${skillMd}

## Target Contract

- **Package ID:** ${packageId}
- **Network:** ${network}${version ? `\n- **Version:** ${version}` : ''}

Perform a comprehensive security audit of this contract following the framework above. Skip Phase 2 (automated analysis) since we only have decompiled source. Focus on Phases 3-7.

\`\`\`move
${sourceCode}
\`\`\``;
}

/**
 * Handle skill audit request
 */
export async function handleSkillAudit(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
  wsConnections: Map<string, WebSocket>
) {
  const request = body as SkillAuditRequest;
  const { packageId, sourceCode, streamId } = request;

  if (!packageId) {
    sendError(res, 'packageId is required', 400);
    return;
  }

  if (!sourceCode) {
    sendError(res, 'sourceCode is required', 400);
    return;
  }

  // Check Claude CLI
  const hasClaude = await commandExists('claude');
  if (!hasClaude) {
    sendError(res, 'Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code', 503);
    return;
  }

  // Load SKILL.md
  let skillMd: string;
  try {
    skillMd = await loadSkillMd();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load SKILL.md';
    console.error('[SkillAudit]', msg);
    sendError(res, msg, 500);
    return;
  }

  // Build prompt
  const prompt = buildAuditPrompt(skillMd, request);
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const command = `claude --print '${escapedPrompt}'`;

  console.log(`[SkillAudit] Starting audit for ${packageId} (prompt: ${prompt.length} chars)`);

  // Get WebSocket for streaming
  const ws = streamId ? wsConnections.get(streamId) : null;

  try {
    if (ws) {
      ws.send(JSON.stringify({ type: 'start', command: 'skill-audit' }));

      const result = await streamCommand(command, {
        cwd: process.cwd(),
        timeout: 300000, // 5 minutes
        onStdout: (chunk) => {
          ws.send(JSON.stringify({ type: 'stdout', data: chunk }));
        },
        onStderr: (chunk) => {
          ws.send(JSON.stringify({ type: 'stderr', data: chunk }));
        },
        onExit: (code) => {
          ws.send(JSON.stringify({ type: 'exit', code }));
        },
      });

      console.log(`[SkillAudit] Audit complete (success: ${result.success}, output: ${result.stdout.length} chars)`);

      sendJson(res, {
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
      });
    } else {
      // Non-streaming
      const result = await executeCommand(command, {
        cwd: process.cwd(),
        timeout: 300000,
      });

      console.log(`[SkillAudit] Audit complete (success: ${result.success}, output: ${result.stdout.length} chars)`);

      sendJson(res, {
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Skill audit failed';
    console.error('[SkillAudit] Error:', message);
    sendError(res, message);
  }
}
