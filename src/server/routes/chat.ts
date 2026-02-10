/**
 * Chat endpoint for AI conversational contract exploration.
 * Uses Claude CLI with conversation transcript as context.
 */

import { ServerResponse } from 'http';
import { WebSocket } from 'ws';
import { commandExists, streamCommand, executeCommand } from '../terminal.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatContext {
  skillMd: string;
  analysisJson: string;
  sourceCodeSnippet?: string;
  packageId: string;
  network: string;
  scene: string;
  moduleName?: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context: ChatContext;
  streamId?: string;
}

/**
 * Build a single prompt for Claude CLI from conversation history + context.
 * Since Claude CLI --print doesn't support multi-turn natively,
 * we embed the full conversation as a transcript in one prompt.
 */
function buildClaudePrompt(messages: ChatMessage[], context: ChatContext): string {
  const systemParts: string[] = [
    'You are a Sui Move smart contract expert assistant.',
    'Answer questions based on the contract context below. Use code examples when helpful.',
    'Respond in the same language the user writes in.',
    '',
    '## Generated Skill (excerpt)',
    context.skillMd.slice(0, 8000),
    '',
    `## Contract: ${context.packageId} on ${context.network} (scene: ${context.scene})`,
  ];

  if (context.analysisJson && context.analysisJson !== '{}') {
    systemParts.push('', '## Analysis', context.analysisJson.slice(0, 6000));
  }

  if (context.sourceCodeSnippet) {
    systemParts.push('', '## Source Code (excerpt)', '```move', context.sourceCodeSnippet.slice(0, 4000), '```');
  }

  const systemContext = systemParts.join('\n');

  // Build conversation transcript for multi-turn
  const lastMessages = messages.slice(-20);

  if (lastMessages.length === 1) {
    // Single message — just prepend context
    return `${systemContext}\n\n---\n\nUser question: ${lastMessages[0].content}`;
  }

  // Multi-turn — embed as transcript
  const transcript = lastMessages
    .slice(0, -1) // All except the last
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const lastMsg = lastMessages[lastMessages.length - 1];

  return `${systemContext}\n\n---\n\nPrevious conversation:\n${transcript}\n\nHuman: ${lastMsg.content}\n\nRespond to the latest question based on the contract context and conversation history.`;
}

/**
 * Handle chat request with optional WebSocket streaming.
 */
export async function handleChat(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
  wsConnections: Map<string, WebSocket>
) {
  const request = body as ChatRequest;
  const { messages, context, streamId } = request;

  if (!messages?.length || !context) {
    sendError(res, 'messages and context are required', 400);
    return;
  }

  // Check if claude CLI is available
  const hasClaude = await commandExists('claude');
  if (!hasClaude) {
    sendError(
      res,
      'Claude Code CLI not found. Install it or set ANTHROPIC_API_KEY for direct API access.',
      503
    );
    return;
  }

  const prompt = buildClaudePrompt(messages, context);
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const command = `claude --print '${escapedPrompt}'`;

  const ws = streamId ? wsConnections.get(streamId) : null;

  try {
    if (ws) {
      ws.send(JSON.stringify({ type: 'start', source: 'chat' }));

      const result = await streamCommand(command, {
        timeout: 300000,
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

      sendJson(res, {
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
      });
    } else {
      const result = await executeCommand(command, { timeout: 300000 });
      sendJson(res, {
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat execution failed';
    sendError(res, message);
  }
}
