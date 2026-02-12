/**
 * Skill-based audit endpoint
 * Uses Claude CLI with the move-audit SKILL.md to perform
 * a comprehensive Sui Move security audit.
 *
 * Flow: Frontend → Server → claude CLI (--dangerously-skip-permissions)
 */

import { ServerResponse } from 'http';
import { WebSocket } from 'ws';
import { readFile, writeFile, unlink } from 'fs/promises';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { commandExists, streamCommand, executeCommand } from '../terminal.js';

interface SkillAuditRequest {
  packageId: string;
  sourceCode: string;
  network?: string;
  version?: number;
  streamId?: string;
}

/**
 * Write source code to a temp file so claude can read it as context
 */
async function writeTempSourceFile(sourceCode: string, packageId: string): Promise<string> {
  const id = randomBytes(8).toString('hex');
  const filename = `audit_${packageId.slice(0, 8)}_${id}.move`;
  const filepath = resolve(tmpdir(), filename);
  await writeFile(filepath, sourceCode, 'utf-8');
  return filepath;
}

/**
 * Build the audit prompt for Claude CLI
 */
function buildAuditPrompt(request: SkillAuditRequest, sourceFilePath: string): string {
  const { packageId, network = 'mainnet', version } = request;

  return `Perform a security audit of this Sui Move contract using the move-audit skill framework.

Target:
- Package ID: ${packageId}
- Network: ${network}${version ? `\n- Version: ${version}` : ''}
- Source file: ${sourceFilePath}

Read the source file and perform a comprehensive security audit following the move-audit SKILL.md framework. Focus on:
1. Access control and capability checks
2. Financial safety (coin/balance operations)
3. Shared object mutation guards
4. Bit-shift overflow risks (<<, >> silently truncate in Move)
5. Logic bugs and edge cases
6. Third-party dependency risks

Output a structured audit report with risk level, vulnerabilities found, function permissions analysis, and actionable recommendations.

IMPORTANT: Only report REAL issues verified from the code. Avoid false positives — shared objects with key+store are normal in Sui, Move arithmetic aborts on overflow, and Sui prevents reentrancy.`;
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

  // Verify SKILL.md exists
  const skillPath = resolve(process.cwd(), '.claude/skills/move-audit/SKILL.md');
  try {
    await readFile(skillPath, 'utf-8');
  } catch {
    sendError(res, `move-audit SKILL.md not found at ${skillPath}`, 500);
    return;
  }

  // Write source code to temp file
  let tempFile: string;
  try {
    tempFile = await writeTempSourceFile(sourceCode, packageId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to write temp file';
    sendError(res, msg, 500);
    return;
  }

  // Build prompt and command
  const prompt = buildAuditPrompt(request, tempFile);
  // Use --dangerously-skip-permissions to avoid interactive permission prompts
  // Use -p (print mode) for non-interactive output
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const command = `claude -p --dangerously-skip-permissions '${escapedPrompt}'`;

  console.log(`[SkillAudit] Starting audit for ${packageId} (source: ${sourceCode.length} chars, temp: ${tempFile})`);

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
  } finally {
    // Clean up temp file
    try { await unlink(tempFile); } catch { /* ignore */ }
  }
}
