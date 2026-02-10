'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useLocalServer } from '../../hooks/useLocalServer';
import { usePlaygroundStore, type PlaygroundMessage } from '../../lib/stores/playground-store';
import { useAuth } from '../../lib/auth/context';

// --- Types ---

interface CloudSkill {
  id: string;
  title: string;
  packageId: string;
  network: string;
  scene: string;
}

// --- Markdown rendering ---

function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(<CodeBlock key={`code-${elements.length}`} code={codeLines.join('\n')} lang={lang} />);
      continue;
    }

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

// --- Message bubble ---

function MessageBubble({ message }: { message: PlaygroundMessage }) {
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
            {isUser ? 'You' : 'Claude'}
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

// --- Skill card ---

function SkillCard({
  skill,
  isSelected,
  onSelect,
  badge,
}: {
  skill: { name: string; preview: string };
  isSelected: boolean;
  onSelect: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? 'border-[var(--neon-cyan)] bg-[rgba(var(--neon-cyan-rgb),0.08)] shadow-[0_0_12px_rgba(0,240,255,0.15)]'
          : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(var(--neon-cyan-rgb),0.3)] hover:bg-[rgba(var(--neon-cyan-rgb),0.03)]'
      }`}
    >
      <div className="font-mono-cyber text-sm font-medium truncate mb-1 flex items-center gap-1.5">
        {isSelected && (
          <span className="text-[var(--neon-cyan)]">&#10003;</span>
        )}
        <span className="truncate">{skill.name}</span>
        {badge && (
          <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-[rgba(var(--neon-purple-rgb),0.15)] text-[var(--neon-purple)] border border-[rgba(var(--neon-purple-rgb),0.2)]">
            {badge}
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground line-clamp-2 font-mono-cyber leading-relaxed">
        {skill.preview || 'No preview available'}
      </div>
    </button>
  );
}

// --- Add Skill Modal ---

function AddSkillModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, content: string) => void;
}) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel rounded-xl p-6 w-full max-w-lg mx-4 border border-[rgba(var(--neon-cyan-rgb),0.2)]">
        <h3 className="font-mono-cyber text-lg font-semibold neon-text mb-4">Add Skill</h3>

        <label className="block mb-3">
          <span className="text-xs font-mono-cyber text-muted-foreground uppercase tracking-wider">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-skill"
            className="mt-1 w-full cyber-input rounded px-3 py-2 text-sm font-mono-cyber"
          />
        </label>

        <label className="block mb-4">
          <span className="text-xs font-mono-cyber text-muted-foreground uppercase tracking-wider">SKILL.md Content</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your SKILL.md content here..."
            rows={10}
            className="mt-1 w-full cyber-input rounded px-3 py-2 text-sm font-mono-cyber resize-none"
          />
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono-cyber rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim() && content.trim()) {
                onSave(name.trim(), content.trim());
                setName('');
                setContent('');
                onClose();
              }
            }}
            disabled={!name.trim() || !content.trim()}
            className="px-4 py-2 text-sm font-mono-cyber rounded cyber-btn disabled:opacity-30"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

type SkillTab = 'cloud' | 'local';

export default function PlaygroundPage() {
  const { isConnected, isConnecting, connect } = useLocalServer({ autoConnect: true });
  const { user } = useAuth();
  const walletAccount = useCurrentAccount();

  const {
    skills,
    selectedSkill,
    skillContent,
    isLoadingSkills,
    messages,
    isStreaming,
    error,
    setSkills,
    setSelectedSkill,
    setSkillContent,
    setLoadingSkills,
    addMessage,
    appendToLastAssistant,
    finalizeLastAssistant,
    setStreaming,
    setError,
    clearMessages,
  } = usePlaygroundStore();

  const [input, setInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cloud skills state
  const [cloudSkills, setCloudSkills] = useState<CloudSkill[]>([]);
  const [loadingCloudSkills, setLoadingCloudSkills] = useState(false);
  const [activeTab, setActiveTab] = useState<SkillTab>('cloud');
  // Track whether the currently selected skill is a cloud skill
  const [isCloudSkillSelected, setIsCloudSkillSelected] = useState(false);

  // Load local skills when connected
  useEffect(() => {
    if (!isConnected) return;

    const loadSkills = async () => {
      setLoadingSkills(true);
      try {
        const { getLocalServerClient } = await import('../../lib/local-server');
        const client = getLocalServerClient();
        const result = await client.listSkills();
        setSkills(result.skills);
      } catch {
        setSkills([]);
      } finally {
        setLoadingSkills(false);
      }
    };

    loadSkills();
  }, [isConnected, setSkills, setLoadingSkills]);

  // Load cloud skills when user is authenticated
  useEffect(() => {
    if (!user) {
      setCloudSkills([]);
      return;
    }

    const loadCloudSkills = async () => {
      setLoadingCloudSkills(true);
      try {
        const res = await fetch('/api/user/skills');
        if (res.ok) {
          const data = await res.json() as { skills: CloudSkill[] };
          setCloudSkills(data.skills);
        }
      } catch {
        // ignore
      } finally {
        setLoadingCloudSkills(false);
      }
    };

    loadCloudSkills();
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Select a local skill — load its full content
  const handleSelectSkill = useCallback(async (skill: { name: string; preview: string; path?: string }) => {
    setSelectedSkill({ name: skill.name, path: (skill as { path: string }).path || '', preview: skill.preview });
    setError(null);
    setIsCloudSkillSelected(false);
    clearMessages();

    try {
      const { getLocalServerClient } = await import('../../lib/local-server');
      const client = getLocalServerClient();
      const result = await client.readSkill(skill.name);
      setSkillContent(result.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skill');
    }
  }, [setSelectedSkill, setSkillContent, setError, clearMessages]);

  // Select a cloud skill — fetch full content from API
  const handleSelectCloudSkill = useCallback(async (skill: CloudSkill) => {
    setSelectedSkill({ name: skill.title, path: `cloud:${skill.id}`, preview: `${skill.network} / ${skill.scene}` });
    setError(null);
    setIsCloudSkillSelected(true);
    setSkillContent(null);
    clearMessages();

    try {
      const res = await fetch(`/api/user/skills/${skill.id}`);
      if (!res.ok) throw new Error('Failed to load skill');
      const data = await res.json() as { skill: { skillMd: string } };
      setSkillContent(data.skill.skillMd);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skill');
    }
  }, [setSelectedSkill, setSkillContent, setError, clearMessages]);

  // Save new local skill
  const handleSaveSkill = useCallback(async (name: string, content: string) => {
    try {
      const { getLocalServerClient } = await import('../../lib/local-server');
      const client = getLocalServerClient();
      await client.saveSkill(name, content);

      const result = await client.listSkills();
      setSkills(result.skills);

      const newSkill = result.skills.find((s: { name: string }) => s.name === name);
      if (newSkill) {
        handleSelectSkill(newSkill);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save skill');
    }
  }, [setSkills, setError, handleSelectSkill]);

  // Send message — use local server if connected, otherwise fall back to cloud /api/chat
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !skillContent) return;

    setInput('');
    setError(null);
    addMessage('user', trimmed);
    addMessage('assistant', '');
    setStreaming(true);

    const chatMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: trimmed },
    ];

    try {
      if (isConnected) {
        // Use local server Claude CLI (works for both local and cloud skills)
        const { getLocalServerClient } = await import('../../lib/local-server');
        const client = getLocalServerClient();

        const result = await client.chat(
          chatMessages,
          { skillMd: skillContent },
          {
            onStdout: (data) => {
              appendToLastAssistant(data);
            },
          }
        );

        finalizeLastAssistant();

        const store = usePlaygroundStore.getState();
        const lastMsg = store.messages[store.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content && result.output) {
          appendToLastAssistant(result.output);
          finalizeLastAssistant();
        }

        if (!result.success && result.error) {
          setError(result.error);
        }
      } else {
        // No local server — try cloud /api/chat (SSE), needs ANTHROPIC_API_KEY
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatMessages,
            context: {
              skillMd: skillContent,
              analysisJson: '{}',
              packageId: '',
              network: '',
              scene: '',
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string; hint?: string };
          throw new Error(data.error || `Chat failed (${res.status})`);
        }

        // Parse SSE stream
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data) as { text?: string; error?: string };
                if (parsed.text) {
                  appendToLastAssistant(parsed.text);
                } else if (parsed.error) {
                  setError(parsed.error);
                }
              } catch {
                // skip malformed
              }
            }
          }
        }

        finalizeLastAssistant();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed');
      finalizeLastAssistant();
    } finally {
      setStreaming(false);
    }
  }, [input, isStreaming, skillContent, messages, isConnected, isCloudSkillSelected, addMessage, appendToLastAssistant, finalizeLastAssistant, setStreaming, setError]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Determine chat mode label
  const chatModeLabel = isConnected && !isCloudSkillSelected ? 'Local CLI' : 'Cloud API';

  // Determine if we have any skills to show (don't block page for local server)
  const hasCloudSkills = cloudSkills.length > 0;
  const hasLocalSkills = skills.length > 0;
  const showLocalTab = isConnected || hasLocalSkills;

  // Default to cloud tab if user is logged in, otherwise local
  useEffect(() => {
    if (user && hasCloudSkills) {
      setActiveTab('cloud');
    } else if (showLocalTab) {
      setActiveTab('local');
    }
  // Only on initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold neon-text font-mono-cyber">Playground</h1>
        <p className="text-sm text-muted-foreground font-mono-cyber mt-1">
          Select a skill and chat with Claude
        </p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left sidebar — Skill selector */}
        <div className="w-72 flex-shrink-0 glass-panel rounded-xl overflow-hidden flex flex-col">
          {/* Tab header */}
          <div className="px-4 py-3 border-b border-[rgba(var(--neon-cyan-rgb),0.1)]">
            <div className="flex items-center gap-1 mb-2">
              {user && (
                <button
                  onClick={() => setActiveTab('cloud')}
                  className={`flex-1 text-[10px] font-mono-cyber uppercase tracking-wider py-1.5 rounded transition-colors ${
                    activeTab === 'cloud'
                      ? 'text-[var(--neon-purple)] bg-[rgba(var(--neon-purple-rgb),0.1)] border border-[rgba(var(--neon-purple-rgb),0.3)]'
                      : 'text-muted-foreground hover:text-white border border-transparent'
                  }`}
                >
                  My Skills
                  {cloudSkills.length > 0 && (
                    <span className="ml-1 text-[9px] opacity-70">({cloudSkills.length})</span>
                  )}
                </button>
              )}
              {showLocalTab && (
                <button
                  onClick={() => setActiveTab('local')}
                  className={`flex-1 text-[10px] font-mono-cyber uppercase tracking-wider py-1.5 rounded transition-colors ${
                    activeTab === 'local'
                      ? 'text-[var(--neon-cyan)] bg-[rgba(var(--neon-cyan-rgb),0.1)] border border-[rgba(var(--neon-cyan-rgb),0.3)]'
                      : 'text-muted-foreground hover:text-white border border-transparent'
                  }`}
                >
                  Local
                  {skills.length > 0 && (
                    <span className="ml-1 text-[9px] opacity-70">({skills.length})</span>
                  )}
                </button>
              )}
            </div>
            {activeTab === 'local' && isConnected && (
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-xs font-mono-cyber text-[var(--neon-cyan)] hover:text-white transition-colors"
                >
                  + Add
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Cloud skills tab */}
            {activeTab === 'cloud' && (
              <>
                {loadingCloudSkills ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[var(--neon-purple)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !user && !walletAccount ? (
                  <div className="text-center py-8 px-2">
                    <svg className="w-10 h-10 text-[var(--neon-purple)] opacity-30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-sm text-muted-foreground font-mono-cyber mb-2">
                      Connect wallet to see saved skills
                    </p>
                  </div>
                ) : !user && walletAccount ? (
                  <div className="text-center py-8 px-2">
                    <svg className="w-10 h-10 text-[var(--neon-yellow)] opacity-30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-muted-foreground font-mono-cyber mb-2">
                      Wallet connected, signing in...
                    </p>
                    <p className="text-xs text-muted-foreground font-mono-cyber">
                      If sign-in fails, try disconnecting and reconnecting your wallet
                    </p>
                  </div>
                ) : cloudSkills.length === 0 ? (
                  <div className="text-center py-8 px-2">
                    <p className="text-sm text-muted-foreground font-mono-cyber mb-3">
                      No saved skills yet
                    </p>
                    <p className="text-xs text-muted-foreground font-mono-cyber">
                      Generate a skill on the{' '}
                      <a href="/generate" className="text-[var(--neon-cyan)] hover:underline">Generate</a>
                      {' '}page and save it
                    </p>
                  </div>
                ) : (
                  cloudSkills.map((cs) => (
                    <SkillCard
                      key={cs.id}
                      skill={{
                        name: cs.title,
                        preview: `${cs.network} / ${cs.scene} / ${cs.packageId.slice(0, 10)}...`,
                      }}
                      isSelected={selectedSkill?.path === `cloud:${cs.id}`}
                      onSelect={() => handleSelectCloudSkill(cs)}
                      badge={cs.scene}
                    />
                  ))
                )}
              </>
            )}

            {/* Local skills tab */}
            {activeTab === 'local' && (
              <>
                {!isConnected ? (
                  <div className="text-center py-8 px-2">
                    <p className="text-sm text-muted-foreground font-mono-cyber mb-3">
                      Local server offline
                    </p>
                    <code className="text-xs px-2 py-1 rounded bg-black/50 text-[var(--neon-green)]">pnpm serve</code>
                    <button
                      onClick={() => connect()}
                      className="mt-3 block mx-auto px-3 py-1.5 text-xs font-mono-cyber rounded cyber-btn"
                    >
                      Reconnect
                    </button>
                  </div>
                ) : isLoadingSkills ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[var(--neon-cyan)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : skills.length === 0 ? (
                  <div className="text-center py-8 px-2">
                    <p className="text-sm text-muted-foreground font-mono-cyber mb-3">
                      No local skills found
                    </p>
                    <p className="text-xs text-muted-foreground font-mono-cyber mb-4">
                      Skills are stored in<br />
                      <code className="text-[var(--neon-cyan)]">.claude/skills/</code>
                    </p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-3 py-1.5 text-xs font-mono-cyber rounded cyber-btn"
                    >
                      Create First Skill
                    </button>
                  </div>
                ) : (
                  skills.map((skill) => (
                    <SkillCard
                      key={skill.name}
                      skill={skill}
                      isSelected={selectedSkill?.name === skill.name && !isCloudSkillSelected}
                      onSelect={() => handleSelectSkill(skill)}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Main area — Chat */}
        <div className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col">
          {!selectedSkill ? (
            // No skill selected
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[rgba(var(--neon-cyan-rgb),0.1)] border border-[rgba(var(--neon-cyan-rgb),0.2)] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold font-mono-cyber mb-2">Select a Skill</h3>
              <p className="text-sm text-muted-foreground font-mono-cyber max-w-sm">
                Choose a skill from the sidebar to start chatting with Claude using that skill as context.
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-6 py-3 border-b border-[rgba(var(--neon-cyan-rgb),0.1)] bg-[rgba(var(--neon-cyan-rgb),0.02)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded border flex items-center justify-center ${
                    isCloudSkillSelected
                      ? 'border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)]'
                      : 'border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)]'
                  }`}>
                    <svg className={`w-3.5 h-3.5 ${isCloudSkillSelected ? 'text-[var(--neon-purple)]' : 'text-[var(--neon-cyan)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className={`font-mono-cyber text-sm font-semibold ${isCloudSkillSelected ? 'text-[var(--neon-purple)]' : 'text-[var(--neon-cyan)]'}`}>
                    {selectedSkill.name}
                  </span>
                  <span className={`text-[10px] font-mono-cyber text-muted-foreground px-2 py-0.5 rounded border ${
                    isCloudSkillSelected
                      ? 'border-[rgba(var(--neon-purple-rgb),0.2)] bg-[rgba(var(--neon-purple-rgb),0.05)]'
                      : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]'
                  }`}>
                    {chatModeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={clearMessages}
                      className="text-[10px] font-mono-cyber text-muted-foreground hover:text-[var(--neon-red)] transition-colors px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    {!skillContent ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-[var(--neon-cyan)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-mono-cyber">Loading skill...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground font-mono-cyber mb-4">
                          Chat with Claude using <span className={isCloudSkillSelected ? 'text-[var(--neon-purple)]' : 'text-[var(--neon-cyan)]'}>{selectedSkill.name}</span> as context
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                          {[
                            'Explain the main functions',
                            'What are the security concerns?',
                            'Show me a usage example',
                            'How does this contract work?',
                          ].map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => {
                                setInput(prompt);
                                inputRef.current?.focus();
                              }}
                              className="px-3 py-1.5 rounded text-xs font-mono-cyber border border-[rgba(var(--neon-cyan-rgb),0.2)] bg-[rgba(var(--neon-cyan-rgb),0.05)] text-[rgba(255,255,255,0.7)] hover:text-[var(--neon-cyan)] hover:border-[rgba(var(--neon-cyan-rgb),0.4)] transition-all"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}
                {error && (
                  <div className="mt-2 px-3 py-2 rounded text-xs font-mono-cyber text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.2)] bg-[rgba(var(--neon-red-rgb),0.05)]">
                    {error}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-6 py-3 border-t border-[rgba(var(--neon-cyan-rgb),0.1)] bg-[rgba(var(--neon-cyan-rgb),0.02)]">
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={skillContent ? 'Ask a question...' : 'Loading skill...'}
                    disabled={isStreaming || !skillContent}
                    rows={1}
                    className="flex-1 cyber-input rounded px-4 py-2.5 text-sm font-mono-cyber resize-none focus:border-[rgba(var(--neon-cyan-rgb),0.5)] focus:outline-none disabled:opacity-50"
                    style={{ maxHeight: '120px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming || !skillContent}
                    className="flex-shrink-0 w-10 h-10 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] flex items-center justify-center hover:bg-[rgba(var(--neon-cyan-rgb),0.2)] hover:border-[rgba(var(--neon-cyan-rgb),0.5)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isStreaming ? (
                      <svg className="w-4 h-4 text-[var(--neon-cyan)] animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono-cyber mt-1.5 opacity-50">
                  Shift+Enter for newline | {chatModeLabel}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Skill Modal */}
      <AddSkillModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveSkill}
      />
    </div>
  );
}
