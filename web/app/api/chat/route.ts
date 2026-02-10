/**
 * Chat API route — Anthropic API path with SSE streaming.
 * Used for AI conversational contract exploration.
 */

export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { buildSystemPrompt, type ChatContext } from '../../../lib/chat-context';

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: ChatContext;
}

export async function POST(request: NextRequest) {
  // Accept API key from: 1) env var, 2) request header (user-configured in Settings)
  const apiKey = process.env.ANTHROPIC_API_KEY || request.headers.get('x-anthropic-key');
  if (!apiKey) {
    return Response.json(
      {
        error: 'No API key. Configure it in Settings (gear icon) or start local server (pnpm run serve).',
      },
      { status: 503 }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages, context } = body;
  if (!messages?.length || !context) {
    return Response.json({ error: 'messages and context are required' }, { status: 400 });
  }

  // Build system prompt from context
  const systemPrompt = buildSystemPrompt(context);

  // Truncate conversation history to last 20 messages
  const recentMessages = messages.slice(-20).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    // Use Anthropic API directly via fetch for streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: recentMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: `Anthropic API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    // Stream the response as SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }
                try {
                  const event = JSON.parse(data);
                  if (event.type === 'content_block_delta' && event.delta?.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
                    );
                  } else if (event.type === 'message_stop') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  } else if (event.type === 'error') {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ error: event.error?.message || 'Unknown error' })}\n\n`)
                    );
                  }
                } catch {
                  // Skip malformed JSON lines
                }
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat request failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
