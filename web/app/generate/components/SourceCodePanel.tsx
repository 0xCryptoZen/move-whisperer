'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface SourceCodePanelProps {
  modules: Record<string, string>;
  decompiledModules?: Record<string, string>;
  selectedModule?: string;
  onModuleSelect?: (moduleName: string) => void;
  packageId?: string;
}

// Fullscreen button component
function FullscreenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded text-sm font-mono-cyber border border-[rgba(var(--neon-cyan-rgb),0.15)] hover:border-[rgba(var(--neon-cyan-rgb),0.3)] hover:bg-[rgba(var(--neon-cyan-rgb),0.05)] transition-all flex items-center gap-1.5 text-[rgba(var(--neon-cyan-rgb),0.6)] hover:text-[var(--neon-cyan)]"
      title="Fullscreen"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
      <span>Fullscreen</span>
    </button>
  );
}

// Close button for fullscreen mode (inline in header bar)
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded text-sm font-mono-cyber border transition-all flex items-center gap-1.5"
      style={{ borderColor: '#555', color: '#d4d4d4', background: 'rgba(255,255,255,0.05)' }}
      title="Exit fullscreen (ESC)"
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = '#888'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = '#555'; }}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span>Exit</span>
    </button>
  );
}

// Download all code as zip
function DownloadButton({
  modules,
  decompiledModules,
  packageId,
  showDecompiled
}: {
  modules: Record<string, string>;
  decompiledModules?: Record<string, string>;
  packageId?: string;
  showDecompiled: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const sourceFolder = zip.folder('source');

      // Use decompiled modules if available and selected, otherwise use bytecode
      const codesToDownload = showDecompiled && decompiledModules
        ? decompiledModules
        : modules;

      // Add each module as a .move file
      for (const [moduleName, code] of Object.entries(codesToDownload)) {
        sourceFolder?.file(`${moduleName}.move`, code);
      }

      // Add a README with package info
      const readme = `# Decompiled Move Source Code

Package ID: ${packageId || 'Unknown'}
Generated: ${new Date().toISOString()}
Modules: ${Object.keys(codesToDownload).length}

## Files
${Object.keys(codesToDownload).map(name => `- ${name}.move`).join('\n')}

## Note
This code was decompiled from on-chain bytecode using Revela decompiler.
Some variable names and comments may not match the original source.
`;
      zip.file('README.md', readme);

      // Generate and download
      const content = await zip.generateAsync({ type: 'blob' });
      const filename = packageId
        ? `${packageId.slice(0, 8)}_source.zip`
        : 'move_source.zip';
      saveAs(content, filename);
    } catch (err) {
      console.error('Failed to download:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="px-3 py-1.5 rounded text-sm font-mono-cyber border border-[rgba(var(--neon-cyan-rgb),0.15)] hover:border-[rgba(var(--neon-cyan-rgb),0.3)] hover:bg-[rgba(var(--neon-cyan-rgb),0.05)] transition-all flex items-center gap-1.5 disabled:opacity-50 text-[rgba(var(--neon-cyan-rgb),0.6)] hover:text-[var(--neon-cyan)]"
      title="Download all as ZIP"
    >
      {isDownloading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Downloading...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Download ZIP</span>
        </>
      )}
    </button>
  );
}

// Move syntax highlighting (VS Code Dark+ theme)
function highlightMoveCode(code: string): React.ReactNode[] {
  const lines = code.split('\n');

  return lines.map((line, lineIndex) => {
    const tokens = tokenizeLine(line);
    return (
      <div key={lineIndex} className="flex hover:bg-[#2a2d2e]">
        <span className="w-12 text-right pr-4 select-none flex-shrink-0 font-mono-cyber" style={{ color: '#858585' }}>
          {lineIndex + 1}
        </span>
        <span className="flex-1">
          {tokens.map((token, tokenIndex) => (
            <span key={tokenIndex} className={token.className}>
              {token.text}
            </span>
          ))}
        </span>
      </div>
    );
  });
}

interface Token {
  text: string;
  className: string;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  // Move language keywords
  const keywords = [
    'module', 'public', 'fun', 'struct', 'use', 'const', 'let', 'mut',
    'if', 'else', 'while', 'loop', 'return', 'move', 'copy', 'abort',
    'has', 'store', 'key', 'drop', 'entry', 'native', 'friend', 'acquires',
    'spec', 'assert', 'assume', 'ensures', 'requires', 'modifies', 'pragma',
    'invariant', 'apply', 'except', 'internal', 'include', 'aborts_if',
    'with', 'update', 'pack', 'unpack', 'borrow_global', 'borrow_global_mut',
    'exists', 'global', 'old', 'TRACE', 'true', 'false', 'as', 'break',
    'continue', 'phantom', 'script', 'address', 'macro', 'match', 'enum',
  ];

  // Built-in types
  const types = [
    'u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'address', 'bool',
    'vector', 'signer', 'Option', 'String', 'UID', 'ID', 'TxContext',
    'Coin', 'Balance', 'Table', 'VecMap', 'VecSet', 'ObjectTable',
  ];

  // Common Sui framework modules
  const frameworkModules = [
    'sui', 'object', 'transfer', 'tx_context', 'coin', 'balance',
    'table', 'event', 'clock', 'package', 'display', 'kiosk',
  ];

  // VS Code Dark+ color classes (using inline styles for exact color matching)
  const colors = {
    comment: 'vsc-comment',      // #6a9955
    string: 'vsc-string',        // #ce9178
    keyword: 'vsc-keyword',      // #569cd6
    control: 'vsc-control',      // #c586c0
    type: 'vsc-type',            // #4ec9b0
    number: 'vsc-number',        // #b5cea8
    function: 'vsc-function',    // #dcdcaa
    variable: 'vsc-variable',    // #9cdcfe
    constant: 'vsc-constant',    // #4fc1ff
    error: 'vsc-error',          // #f44747
    operator: 'vsc-operator',    // #d4d4d4
    text: 'vsc-text',            // #d4d4d4
    framework: 'vsc-type',       // #4ec9b0 (same as types)
    address: 'vsc-number',       // #b5cea8
  };

  while (remaining.length > 0) {
    let matched = false;

    // Match comments
    if (remaining.startsWith('//')) {
      tokens.push({ text: remaining, className: colors.comment });
      break;
    }

    // Match block comment start (simplified - doesn't handle multi-line)
    if (remaining.startsWith('/*')) {
      const endIndex = remaining.indexOf('*/');
      if (endIndex !== -1) {
        tokens.push({ text: remaining.slice(0, endIndex + 2), className: colors.comment });
        remaining = remaining.slice(endIndex + 2);
        matched = true;
        continue;
      }
    }

    // Match strings
    const stringMatch = remaining.match(/^(b?"(?:[^"\\]|\\.)*")/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[1], className: colors.string });
      remaining = remaining.slice(stringMatch[1].length);
      matched = true;
      continue;
    }

    // Match hex numbers (addresses)
    const hexMatch = remaining.match(/^(0x[a-fA-F0-9]+)/);
    if (hexMatch) {
      tokens.push({ text: hexMatch[1], className: colors.address });
      remaining = remaining.slice(hexMatch[1].length);
      matched = true;
      continue;
    }

    // Match decimal numbers
    const numMatch = remaining.match(/^(\d+)/);
    if (numMatch) {
      tokens.push({ text: numMatch[1], className: colors.number });
      remaining = remaining.slice(numMatch[1].length);
      matched = true;
      continue;
    }

    // Match identifiers (keywords, types, etc.)
    const identMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (identMatch) {
      const word = identMatch[1];
      let cls = colors.text; // default

      // Control flow keywords
      const controlKeywords = ['if', 'else', 'while', 'loop', 'return', 'break', 'continue', 'abort', 'match'];

      if (controlKeywords.includes(word)) {
        cls = colors.control;
      } else if (keywords.includes(word)) {
        cls = colors.keyword;
      } else if (types.includes(word)) {
        cls = colors.type;
      } else if (frameworkModules.includes(word)) {
        cls = colors.framework;
      } else if (word.startsWith('E') && word.length > 1 && word[1] === word[1].toUpperCase()) {
        // Error constants like EInsufficientBalance
        cls = colors.error;
      } else if (word === word.toUpperCase() && word.length > 1) {
        // Constants like MAX_SUPPLY
        cls = colors.constant;
      } else if (word[0] === word[0].toUpperCase()) {
        // Type/struct names starting with uppercase
        cls = colors.type;
      }

      tokens.push({ text: word, className: cls });
      remaining = remaining.slice(word.length);
      matched = true;
      continue;
    }

    // Match generic type parameters
    const genericMatch = remaining.match(/^(<[^>]+>)/);
    if (genericMatch) {
      tokens.push({ text: genericMatch[1], className: colors.type });
      remaining = remaining.slice(genericMatch[1].length);
      matched = true;
      continue;
    }

    // Match operators and punctuation
    const opMatch = remaining.match(/^(::|\->|=>|&&|\|\||==|!=|<=|>=|<<|>>|[+\-*/%&|^!<>=:;,.()\[\]{}@#])/);
    if (opMatch) {
      const op = opMatch[1];
      let cls = colors.operator;
      if (['&', '*'].includes(op)) {
        cls = colors.keyword;
      }
      tokens.push({ text: op, className: cls });
      remaining = remaining.slice(op.length);
      matched = true;
      continue;
    }

    // Match whitespace
    const wsMatch = remaining.match(/^(\s+)/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[1], className: '' });
      remaining = remaining.slice(wsMatch[1].length);
      matched = true;
      continue;
    }

    // Fallback: take one character
    if (!matched) {
      tokens.push({ text: remaining[0], className: colors.text });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

// Copy button component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 rounded text-sm font-mono-cyber border border-[rgba(var(--neon-cyan-rgb),0.15)] hover:border-[rgba(var(--neon-cyan-rgb),0.3)] hover:bg-[rgba(var(--neon-cyan-rgb),0.05)] transition-all flex items-center gap-1.5 text-[rgba(var(--neon-cyan-rgb),0.6)] hover:text-[var(--neon-cyan)]"
      title="Copy code"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[var(--neon-green)]">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export default function SourceCodePanel({
  modules,
  decompiledModules,
  selectedModule: externalSelectedModule,
  onModuleSelect,
  packageId,
}: SourceCodePanelProps) {
  const moduleNames = useMemo(() => Object.keys(modules).sort(), [modules]);
  const [internalSelectedModule, setInternalSelectedModule] = useState<string>(moduleNames[0] || '');
  const [showDecompiled, setShowDecompiled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedModule = externalSelectedModule ?? internalSelectedModule;

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when fullscreen
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const handleModuleSelect = useCallback((moduleName: string) => {
    setInternalSelectedModule(moduleName);
    onModuleSelect?.(moduleName);
  }, [onModuleSelect]);

  const currentCode = useMemo(() => {
    if (showDecompiled && decompiledModules?.[selectedModule]) {
      return decompiledModules[selectedModule];
    }
    return modules[selectedModule] || '';
  }, [modules, decompiledModules, selectedModule, showDecompiled]);

  const hasDecompiled = decompiledModules && Object.keys(decompiledModules).length > 0;

  const highlightedCode = useMemo(() => {
    return highlightMoveCode(currentCode);
  }, [currentCode]);

  // Count lines and characters
  const stats = useMemo(() => {
    const lines = currentCode.split('\n').length;
    const chars = currentCode.length;
    return { lines, chars };
  }, [currentCode]);

  if (moduleNames.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground font-mono-cyber">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No modules available</p>
      </div>
    );
  }

  // Render the panel UI
  const renderPanel = (fullscreen: boolean) => (
    <div className={`flex flex-col ${fullscreen ? 'h-screen w-screen' : 'h-full'}`} style={fullscreen ? { background: '#1e1e1e' } : undefined}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: fullscreen ? '#333' : 'rgba(var(--neon-cyan-rgb),0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.08)] flex items-center justify-center shadow-[0_0_10px_rgba(var(--neon-purple-rgb),0.15)]">
            <svg className="w-5 h-5 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="font-mono-cyber text-sm uppercase tracking-wider" style={{ color: fullscreen ? '#d4d4d4' : undefined }}>
              {fullscreen ? '' : <span className="neon-text">Source Code</span>}
              {fullscreen && 'Source Code'}
            </h3>
            <p className="text-xs font-mono-cyber" style={{ color: fullscreen ? '#858585' : undefined }}>
              {!fullscreen && <span className="text-muted-foreground">{moduleNames.length} module{moduleNames.length > 1 ? 's' : ''} &bull; {stats.lines} lines</span>}
              {fullscreen && `${moduleNames.length} module${moduleNames.length > 1 ? 's' : ''} \u2022 ${stats.lines} lines`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasDecompiled && (
            <div className="flex items-center gap-1 p-1 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
              <button
                onClick={() => setShowDecompiled(false)}
                className={`px-3 py-1 rounded text-xs font-mono-cyber transition-all ${
                  !showDecompiled
                    ? 'bg-[rgba(var(--neon-cyan-rgb),0.15)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.3)]'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                Bytecode
              </button>
              <button
                onClick={() => setShowDecompiled(true)}
                className={`px-3 py-1 rounded text-xs font-mono-cyber transition-all ${
                  showDecompiled
                    ? 'bg-[rgba(var(--neon-purple-rgb),0.15)] text-[var(--neon-purple)] border border-[rgba(var(--neon-purple-rgb),0.3)]'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                Decompiled
              </button>
            </div>
          )}
          <CopyButton text={currentCode} />
          <DownloadButton
            modules={modules}
            decompiledModules={decompiledModules}
            packageId={packageId}
            showDecompiled={showDecompiled}
          />
          {fullscreen ? (
            <CloseButton onClick={() => setIsFullscreen(false)} />
          ) : (
            <FullscreenButton onClick={() => setIsFullscreen(true)} />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Module list - Left sidebar */}
        <div className={`w-48 flex-shrink-0 border-r overflow-y-auto ${!fullscreen ? 'border-[rgba(var(--neon-cyan-rgb),0.06)]' : ''}`} style={{ borderColor: fullscreen ? '#333' : undefined, background: fullscreen ? '#252526' : undefined }}>
          <div className="p-2">
            <div className="text-[10px] uppercase tracking-widest px-2 py-1.5 mb-1 font-mono-cyber" style={{ color: fullscreen ? '#858585' : 'rgba(var(--neon-cyan-rgb),0.4)' }}>
              Modules
            </div>
            {moduleNames.map((name) => {
              const isSelected = name === selectedModule;
              const hasDecompiledVersion = decompiledModules?.[name];

              return (
                <button
                  key={name}
                  onClick={() => handleModuleSelect(name)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-all mb-0.5 ${
                    fullscreen
                      ? isSelected
                        ? 'border border-transparent'
                        : 'border border-transparent hover:bg-[#2a2d2e]'
                      : isSelected
                        ? 'bg-[rgba(var(--neon-cyan-rgb),0.08)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.25)] shadow-[0_0_8px_rgba(var(--neon-cyan-rgb),0.1)]'
                        : 'text-[rgba(var(--neon-cyan-rgb),0.5)] hover:bg-[rgba(var(--neon-cyan-rgb),0.03)] hover:text-[rgba(var(--neon-cyan-rgb),0.8)] border border-transparent'
                  }`}
                  style={fullscreen ? {
                    color: isSelected ? '#ffffff' : '#cccccc',
                    background: isSelected ? '#37373d' : undefined,
                  } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${!fullscreen ? (isSelected ? 'text-[var(--neon-cyan)]' : 'text-[rgba(var(--neon-cyan-rgb),0.3)]') : ''}`} style={fullscreen ? { color: isSelected ? '#cccccc' : '#858585' } : undefined} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate font-mono-cyber text-xs">{name}</span>
                    {hasDecompiledVersion && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-purple)] shadow-[0_0_4px_var(--neon-purple)] flex-shrink-0" title="Has decompiled version" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Package info */}
          {packageId && (
            <div className="border-t p-3 mt-2" style={{ borderColor: fullscreen ? '#333' : 'rgba(var(--neon-cyan-rgb),0.06)' }}>
              <div className="text-[10px] uppercase tracking-widest mb-1 font-mono-cyber" style={{ color: fullscreen ? '#858585' : 'rgba(var(--neon-cyan-rgb),0.4)' }}>
                Package
              </div>
              <div className="text-[10px] font-mono-cyber break-all" style={{ color: fullscreen ? '#858585' : 'rgba(var(--neon-cyan-rgb),0.35)' }}>
                {packageId.slice(0, 16)}...{packageId.slice(-8)}
              </div>
            </div>
          )}
        </div>

        {/* Code display - Right panel */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {/* Code header - VS Code tab bar style */}
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: fullscreen ? '#333' : 'rgba(var(--neon-cyan-rgb),0.06)', background: fullscreen ? '#252526' : 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono-cyber" style={{ color: fullscreen ? '#d4d4d4' : 'rgba(var(--neon-cyan-rgb),0.7)' }}>{selectedModule}</span>
              {showDecompiled && decompiledModules?.[selectedModule] ? (
                <span className="px-1.5 py-0.5 text-[9px] font-mono-cyber font-medium rounded bg-[rgba(var(--neon-purple-rgb),0.15)] text-[var(--neon-purple)] border border-[rgba(var(--neon-purple-rgb),0.25)]">
                  Revela Decompiled
                </span>
              ) : (
                <span
                  className={fullscreen
                    ? "px-1.5 py-0.5 text-[9px] font-mono-cyber font-medium rounded"
                    : "px-1.5 py-0.5 text-[9px] font-mono-cyber font-medium rounded bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.2)]"
                  }
                  style={fullscreen ? { background: '#333', color: '#858585', border: '1px solid #444' } : undefined}
                >
                  Disassembled
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono-cyber" style={{ color: fullscreen ? '#858585' : undefined }}>
              {!fullscreen && <span className="text-muted-foreground">{stats.lines} lines &bull; {(stats.chars / 1024).toFixed(1)} KB</span>}
              {fullscreen && `${stats.lines} lines \u2022 ${(stats.chars / 1024).toFixed(1)} KB`}
            </div>
          </div>

          {/* Code block - VS Code editor area */}
          <div className="flex-1 overflow-auto p-4" style={{ background: '#1e1e1e' }}>
            <pre className="text-sm font-mono-cyber leading-relaxed" style={{ color: '#d4d4d4' }}>
              {highlightedCode}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer legend - VS Code status bar style */}
      <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] overflow-x-auto font-mono-cyber" style={{ borderColor: fullscreen ? '#333' : 'rgba(var(--neon-cyan-rgb),0.06)', background: fullscreen ? '#007acc' : undefined }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#569cd6' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Keywords</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#4ec9b0' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Types</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#c586c0' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Control</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#dcdcaa' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Functions</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#b5cea8' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Numbers</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#ce9178' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Strings</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#6a9955' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Comments</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#f44747' }}></span>
          <span style={{ color: fullscreen ? '#fff' : undefined }} className={fullscreen ? '' : 'text-muted-foreground'}>Errors</span>
        </span>
      </div>
    </div>
  );

  // Fullscreen mode - use portal to escape parent container constraints
  if (isFullscreen) {
    return (
      <>
        {renderPanel(false)}
        {createPortal(
          <div className="fixed inset-0 z-[9999]" style={{ background: '#1e1e1e' }}>
            {renderPanel(true)}
          </div>,
          document.body
        )}
      </>
    );
  }

  // Normal mode
  return renderPanel(false);
}
