/**
 * Playground hook - AI conversational contract exploration.
 * Dual backend: Anthropic API (primary) + local server Claude CLI (fallback).
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore, type BackendMode } from '../lib/stores/chat-store';
import type { ChatContext } from '../lib/chat-context';
import type { ServerHealth } from '../lib/local-server';

export interface UsePlaygroundOptions {
  context: ChatContext | null;
  isLocalServerConnected: boolean;
  localServerHealth: ServerHealth | null;
}

export interface UsePlaygroundReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages'];
  isStreaming: boolean;
  isOpen: boolean;
  error: string | null;
  backendMode: BackendMode;
  sendMessage: (content: string) => Promise<void>;
  toggleOpen: () => void;
  clearChat: () => void;
}

/**
 * Read an SSE stream and call onDelta for each text chunk.
 */
async function readSSEStream(
  response: Response,
  onDelta: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (abortSignal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              onDelta(parsed.text);
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Send chat via the Next.js API route (Anthropic API path).
 */
async function sendViaAnthropicAPI(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ChatContext,
  onDelta: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<boolean> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal: abortSignal,
  });

  if (response.status === 503) {
    // API key not configured — signal to try fallback
    return false;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  await readSSEStream(response, onDelta, abortSignal);
  return true;
}

/**
 * Send chat via the local server (Claude CLI path).
 */
async function sendViaLocalServer(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ChatContext,
  onDelta: (text: string) => void,
  _abortSignal?: AbortSignal
): Promise<void> {
  const response = await fetch('http://127.0.0.1:3456/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Local server request failed' })) as { error?: string };
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json() as { success?: boolean; output?: string; error?: string };
  if (data.success && data.output) {
    onDelta(data.output);
  } else if (data.error) {
    throw new Error(data.error);
  }
}

export function usePlayground(options: UsePlaygroundOptions): UsePlaygroundReturn {
  const { context, isLocalServerConnected, localServerHealth } = options;
  const abortRef = useRef<AbortController | null>(null);

  const {
    messages,
    isStreaming,
    isOpen,
    error,
    backendMode,
    addMessage,
    appendToLastAssistant,
    finalizeLastAssistant,
    setStreaming,
    toggleOpen,
    setError,
    setBackendMode,
    removeLastMessage,
    clearMessages,
    reset,
  } = useChatStore();

  // Detect available backend on mount / when connection changes
  useEffect(() => {
    const hasClaudeCli = localServerHealth?.tools?.some(
      (t) => t.name === 'claude' && t.available
    );

    if (isLocalServerConnected && hasClaudeCli) {
      setBackendMode('local-claude');
    } else {
      setBackendMode('anthropic-api');
    }
  }, [isLocalServerConnected, localServerHealth, setBackendMode]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!context || isStreaming) return;

      setError(null);
      addMessage('user', content);
      addMessage('assistant', ''); // placeholder for streaming
      setStreaming(true);

      // Build message history for API
      const currentMessages = useChatStore.getState().messages;
      const apiMessages = currentMessages
        .filter((m) => m.content !== '') // skip empty placeholder
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        if (isLocalServerConnected) {
          // Local server available — use Claude CLI directly
          setBackendMode('local-claude');
          await sendViaLocalServer(
            apiMessages,
            context,
            (text) => appendToLastAssistant(text),
            abortController.signal
          );
        } else {
          // No local server — try Anthropic API
          const success = await sendViaAnthropicAPI(
            apiMessages,
            context,
            (text) => appendToLastAssistant(text),
            abortController.signal
          );

          if (!success) {
            setBackendMode('none');
            removeLastMessage();
            setError(
              'No AI backend available. Start the local server (pnpm run serve) to use Claude CLI.'
            );
            setStreaming(false);
            return;
          }
          setBackendMode('anthropic-api');
        }

        finalizeLastAssistant();
      } catch (err) {
        if (abortController.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Chat request failed';
        setError(msg);
        // Remove the empty assistant placeholder on error
        removeLastMessage();
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      context,
      isStreaming,
      isLocalServerConnected,
      addMessage,
      appendToLastAssistant,
      finalizeLastAssistant,
      setStreaming,
      setError,
      setBackendMode,
      removeLastMessage,
    ]
  );

  const clearChat = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    clearMessages();
  }, [clearMessages]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      reset();
    };
  }, [reset]);

  return {
    messages,
    isStreaming,
    isOpen,
    error,
    backendMode,
    sendMessage,
    toggleOpen,
    clearChat,
  };
}
