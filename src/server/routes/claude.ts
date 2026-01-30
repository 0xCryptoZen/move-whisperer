/**
 * Claude Code CLI endpoint
 * Execute Claude Code commands and stream output
 */

import { ServerResponse } from 'http';
import { WebSocket } from 'ws';
import { commandExists, streamCommand, executeCommand } from '../terminal.js';

interface ClaudeRequest {
  prompt: string;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  allowedTools?: string[];
  streamId?: string; // WebSocket connection ID for streaming
  mode?: 'interactive' | 'print' | 'json';
}

interface ClaudeResponse {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Build claude CLI command from request
 */
function buildClaudeCommand(request: ClaudeRequest): string {
  const { prompt, model, maxTurns, allowedTools, mode = 'print' } = request;

  const args: string[] = ['claude'];

  // Add print mode for non-interactive output
  if (mode === 'print') {
    args.push('--print');
  } else if (mode === 'json') {
    args.push('--output-format', 'json');
  }

  // Add model if specified
  if (model) {
    args.push('--model', model);
  }

  // Add max turns if specified
  if (maxTurns) {
    args.push('--max-turns', maxTurns.toString());
  }

  // Add allowed tools if specified
  if (allowedTools && allowedTools.length > 0) {
    args.push('--allowedTools', allowedTools.join(','));
  }

  // Add the prompt (escaped for shell)
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  args.push(`'${escapedPrompt}'`);

  return args.join(' ');
}

/**
 * Handle Claude CLI request with streaming support
 */
export async function handleClaude(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
  wsConnections: Map<string, WebSocket>
) {
  const request = body as ClaudeRequest;
  const { prompt, cwd, streamId } = request;

  if (!prompt) {
    sendError(res, 'prompt is required', 400);
    return;
  }

  // Check if claude CLI is available
  const hasClaude = await commandExists('claude');
  if (!hasClaude) {
    sendError(res, 'Claude Code CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code', 503);
    return;
  }

  // Get WebSocket for streaming
  const ws = streamId ? wsConnections.get(streamId) : null;

  const command = buildClaudeCommand(request);

  try {
    if (ws) {
      // Stream output via WebSocket
      ws.send(JSON.stringify({ type: 'start', command }));

      const result = await streamCommand(command, {
        cwd,
        timeout: 300000, // 5 minutes for Claude operations
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

      const response: ClaudeResponse = {
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
      };

      sendJson(res, response);
    } else {
      // Non-streaming response
      const result = await executeCommand(command, {
        cwd,
        timeout: 300000,
      });

      const response: ClaudeResponse = {
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
      };

      sendJson(res, response);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Claude execution failed';
    sendError(res, message);
  }
}

/**
 * Generate skill using Claude Code
 */
export async function generateSkillWithClaude(
  packageId: string,
  decompiledSource: string,
  scene: string,
  cwd: string
): Promise<{ success: boolean; skillMd: string; error?: string }> {
  const prompt = `
You are generating a Claude Code skill for a Sui Move smart contract.

Package ID: ${packageId}
Scene: ${scene}

Decompiled Source Code:
\`\`\`move
${decompiledSource}
\`\`\`

Please analyze this Move contract and generate a comprehensive skill markdown file that includes:
1. Overview of the contract's purpose
2. Key functions and their parameters
3. Example usage patterns
4. Common transaction patterns

Output the skill in markdown format.
`;

  const result = await executeCommand(
    `claude --print '${prompt.replace(/'/g, "'\\''")}'`,
    { cwd, timeout: 120000 }
  );

  return {
    success: result.success,
    skillMd: result.stdout,
    error: result.success ? undefined : result.stderr,
  };
}
