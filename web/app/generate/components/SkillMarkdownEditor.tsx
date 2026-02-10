'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';

interface SkillMarkdownEditorProps {
  initialContent: string;
  packageName: string;
  onContentChange: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  isSaving?: boolean;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold font-mono-cyber neon-text mb-4 mt-8 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold font-mono-cyber neon-text mb-3 mt-6 pb-2 border-b border-[rgba(var(--neon-cyan-rgb),0.15)]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold font-mono-cyber text-[var(--neon-purple)] mb-2 mt-5">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold font-mono-cyber text-[var(--neon-amber)] mb-2 mt-4">
      {children}
    </h4>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (!isBlock) {
      return (
        <code className="px-1.5 py-0.5 rounded text-xs font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.2)]">
          {children}
        </code>
      );
    }
    return (
      <code className={`${className || ''} font-mono-cyber text-sm block`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="code-block my-4 overflow-auto text-sm rounded p-4">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded border border-[rgba(var(--neon-cyan-rgb),0.12)]">
      <table className="w-full border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[rgba(var(--neon-cyan-rgb),0.05)]">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left font-mono-cyber text-xs uppercase tracking-wider text-[var(--neon-cyan)] border-b border-[rgba(var(--neon-cyan-rgb),0.15)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-sm font-mono-cyber border-b border-[rgba(var(--neon-cyan-rgb),0.06)]">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--neon-cyan)] hover:text-[var(--neon-magenta)] underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--neon-purple)] pl-4 my-4 text-[rgba(255,255,255,0.6)] italic">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 my-3 ml-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 my-3 ml-2">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm font-mono-cyber leading-relaxed">{children}</li>
  ),
  hr: () => (
    <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--neon-cyan-rgb),0.3)] to-transparent" />
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-[rgba(255,255,255,0.95)]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-[rgba(255,255,255,0.7)]">{children}</em>
  ),
};

function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  const rendered = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    ),
    [content]
  );

  return (
    <div className={`markdown-preview text-sm leading-relaxed text-[rgba(255,255,255,0.85)] ${className || ''}`}>
      {rendered}
    </div>
  );
}

function EditorPane({
  content,
  onChange,
  className,
}: {
  content: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={`relative ${className || ''}`}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="w-full h-full min-h-[500px] resize-none bg-transparent text-sm text-[rgba(255,255,255,0.85)] font-mono-cyber leading-relaxed p-4 focus:outline-none placeholder:text-[rgba(var(--neon-cyan-rgb),0.2)] selection:bg-[rgba(var(--neon-cyan-rgb),0.2)]"
        placeholder="Edit your SKILL.md content here..."
      />
    </div>
  );
}

export default function SkillMarkdownEditor({
  initialContent,
  packageName,
  onContentChange,
  onSave,
  isSaving,
}: SkillMarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<string>('preview');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync when initialContent changes (new generation)
  useEffect(() => {
    setContent(initialContent);
    setHasUnsavedChanges(false);
  }, [initialContent]);

  const stats = useMemo(() => {
    const lines = content.split('\n').length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { lines, words };
  }, [content]);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setHasUnsavedChanges(true);
      onContentChange(value);
    },
    [onContentChange]
  );

  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave(content);
      setHasUnsavedChanges(false);
    }
  }, [content, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (!hasUnsavedChanges || !onSave) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [content, hasUnsavedChanges, onSave, handleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape' && activeTab !== 'preview') {
        setActiveTab('preview');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, activeTab]);

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
      {/* Tab bar + status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(var(--neon-cyan-rgb),0.08)] bg-[rgba(var(--neon-cyan-rgb),0.02)]">
        <Tabs.List className="flex gap-1">
          <Tabs.Trigger value="preview" className="mode-tab-trigger flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </Tabs.Trigger>
          <Tabs.Trigger value="edit" className="mode-tab-trigger flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Tabs.Trigger>
          <Tabs.Trigger value="split" className="mode-tab-trigger flex items-center gap-1.5 hidden md:flex">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            Split
          </Tabs.Trigger>
        </Tabs.List>

        {/* Status info */}
        <div className="flex items-center gap-4 text-xs font-mono-cyber text-[rgba(var(--neon-cyan-rgb),0.4)]">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1.5 text-[var(--neon-amber)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-amber)] unsaved-indicator" />
              {isSaving ? 'Saving...' : 'Unsaved'}
            </span>
          )}
          <span>{stats.lines} lines</span>
          <span>{stats.words} words</span>
        </div>
      </div>

      {/* Preview */}
      <Tabs.Content value="preview" className="focus:outline-none">
        <div className="p-6 max-h-[600px] overflow-auto">
          <MarkdownPreview content={content} />
        </div>
      </Tabs.Content>

      {/* Edit */}
      <Tabs.Content value="edit" className="focus:outline-none">
        <div className="max-h-[600px] overflow-auto bg-[rgba(0,0,0,0.2)]">
          <EditorPane content={content} onChange={handleChange} />
        </div>
      </Tabs.Content>

      {/* Split */}
      <Tabs.Content value="split" className="focus:outline-none">
        <div className="flex max-h-[600px]">
          <div className="w-1/2 overflow-auto bg-[rgba(0,0,0,0.2)] border-r border-[rgba(var(--neon-cyan-rgb),0.08)]">
            <EditorPane content={content} onChange={handleChange} />
          </div>
          <div className="w-1/2 overflow-auto p-6">
            <MarkdownPreview content={content} />
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
