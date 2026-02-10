'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { usePlayground } from '../../../hooks/useChatExplorer';
import { buildChatContext, generateSuggestedPrompts, type ChatContext } from '../../../lib/chat-context';
import type { ChatMessage } from '../../../lib/stores/chat-store';
import type { ServerHealth } from '../../../lib/local-server';

interface ContractAnalysis {
  purpose: { summary: string; category: string; protocols: string[] };
  functions: Array<{ name: string; purpose: string; category: string; risk: string }>;
  types: Array<{ name: string; purpose: string; isCapability: boolean; isSharedObject: boolean }>;
  generics: { mapping: Record<string, { name: string; description: string; commonTypes: string[] }>; confidence: number };
  errorCodes: Array<{ name: string; code: number; description: string; possibleCauses: string[]; solutions: string[]; category: string }>;
  security: { riskLevel: string; concerns: string[]; adminFunctions: string[] };
  confidence: number;
  analysisSource: string;
}

interface GenerateResult {
  skillMd: string;
  packageName: string;
  metadata: { packageId: string; modules: string[]; network: string };
}

interface IntermediateArtifacts {
  sourceCode?: string;
  decompiledCode?: string;
  moduleName?: string;
  packageId?: string;
}

interface PlaygroundPanelProps {
  result: GenerateResult;
  analysis: ContractAnalysis | null;
  artifacts: IntermediateArtifacts;
  network: string;
  scene: string;
  isLocalServerConnected: boolean;
  localServerHealth: ServerHealth | null;
}

// --- Markdown rendering helpers ---

function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = codeLines.join('\n');
      elements.push(<CodeBlock key={`code-${elements.length}`} code={code} lang={lang} />);
      continue;
    }

    // Regular line with inline formatting
    elements.push(
      <span key={`line-${elements.length}`} className="block">
        {renderInline(line)}
      </span>
    );
    i++;
  }

  return elements;
}

function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  // Match inline code, bold, or plain text
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`ic-${match.index}`}
          className="px-1.5 py-0.5 rounded text-xs font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.2)]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded border border-[rgba(var(--neon-cyan-rgb),0.15)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[rgba(var(--neon-cyan-rgb),0.05)] border-b border-[rgba(var(--neon-cyan-rgb),0.1)]">
        <span className="text-[10px] font-mono-cyber text-muted-foreground uppercase tracking-wider">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="text-[10px] font-mono-cyber text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono-cyber overflow-x-auto leading-relaxed text-[rgba(255,255,255,0.85)]">
        {code}
      </pre>
    </div>
  );
}

// --- Message component ---

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[rgba(var(--neon-cyan-rgb),0.08)] border border-[rgba(var(--neon-cyan-rgb),0.2)] text-[rgba(255,255,255,0.9)]'
            : 'bg-[rgba(var(--neon-purple-rgb),0.05)] border border-[rgba(var(--neon-purple-rgb),0.15)] text-[rgba(255,255,255,0.85)]'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {isUser ? (
            <svg className="w-3.5 h-3.5 text-[var(--neon-cyan)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-[var(--neon-purple)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
          <span className={`text-[10px] font-mono-cyber uppercase tracking-wider ${isUser ? 'text-[var(--neon-cyan)]' : 'text-[var(--neon-purple)]'}`}>
            {isUser ? 'You' : 'AI'}
          </span>
        </div>
        <div className="font-mono-cyber">
          {renderMarkdown(message.content)}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--neon-purple)] animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main component ---

export default function PlaygroundPanel({
  result,
  analysis,
  artifacts,
  network,
  scene,
  isLocalServerConnected,
  localServerHealth,
}: PlaygroundPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const context: ChatContext = buildChatContext(result, analysis, artifacts, network, scene);
  const suggestedPrompts = generateSuggestedPrompts(analysis);

  const {
    messages,
    isStreaming,
    isOpen,
    error,
    backendMode,
    sendMessage,
    toggleOpen,
    clearChat,
  } = usePlayground({
    context,
    isLocalServerConnected,
    localServerHealth,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestedClick = useCallback(
    (prompt: string) => {
      setInput('');
      sendMessage(prompt);
    },
    [sendMessage]
  );

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Collapsed bar
  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="w-full mt-4 glass-panel rounded overflow-hidden hud-corners group cursor-pointer transition-all hover:border-[rgba(var(--neon-purple-rgb),0.4)]"
        style={{ borderColor: 'rgba(var(--neon-purple-rgb), 0.2)' }}
      >
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="w-8 h-8 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-mono-cyber text-sm text-muted-foreground group-hover:text-[var(--neon-purple)] transition-colors">
            Ask about this contract...
          </span>
          <svg className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-[var(--neon-purple)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      className="w-full mt-4 glass-panel rounded overflow-hidden hud-corners"
      style={{ borderColor: 'rgba(var(--neon-purple-rgb), 0.25)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[rgba(var(--neon-purple-rgb),0.15)] bg-[rgba(var(--neon-purple-rgb),0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-mono-cyber text-sm font-semibold text-[var(--neon-purple)]">
            Playground
          </span>
          {backendMode !== 'none' && (
            <span className="text-[10px] font-mono-cyber text-muted-foreground px-2 py-0.5 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]">
              {backendMode === 'anthropic-api' ? 'API' : 'CLI'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-[10px] font-mono-cyber text-muted-foreground hover:text-[var(--neon-red)] transition-colors px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={toggleOpen}
            className="text-muted-foreground hover:text-[var(--neon-purple)] transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="px-6 py-4 max-h-[300px] md:max-h-[400px] lg:max-h-[500px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono-cyber text-center">
              Ask anything about <span className="text-[var(--neon-purple)]">{result.packageName}</span>
            </p>
            {/* Suggested prompts */}
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedClick(prompt)}
                  className="px-3 py-1.5 rounded text-xs font-mono-cyber border border-[rgba(var(--neon-purple-rgb),0.2)] bg-[rgba(var(--neon-purple-rgb),0.05)] text-[rgba(255,255,255,0.7)] hover:text-[var(--neon-purple)] hover:border-[rgba(var(--neon-purple-rgb),0.4)] transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </>
        )}
        {error && (
          <div className="mt-2 px-3 py-2 rounded text-xs font-mono-cyber text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.2)] bg-[rgba(var(--neon-red-rgb),0.05)]">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-6 py-3 border-t border-[rgba(var(--neon-purple-rgb),0.15)] bg-[rgba(var(--neon-purple-rgb),0.02)]">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this contract..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 cyber-input rounded px-4 py-2.5 text-sm font-mono-cyber resize-none focus:border-[rgba(var(--neon-purple-rgb),0.5)] focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-10 h-10 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)] flex items-center justify-center hover:bg-[rgba(var(--neon-purple-rgb),0.2)] hover:border-[rgba(var(--neon-purple-rgb),0.5)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <svg className="w-4 h-4 text-[var(--neon-purple)] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono-cyber mt-1.5 opacity-50">
          Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
