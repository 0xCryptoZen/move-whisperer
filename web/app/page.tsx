'use client';

import Link from 'next/link';
import { useLocalServer } from '../hooks/useLocalServer';

export default function HomePage() {
  const { isConnected, isConnecting, health, connect } = useLocalServer({ autoConnect: true });

  return (
    <div className="mx-auto px-6 sm:px-10 lg:px-12 py-12 max-w-[1680px]">
      {/* Hero Section */}
      <div className="text-center mb-16 relative">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          <span
            className="gradient-text glitch-text"
            data-text="MoveWhisperer"
          >
            MoveWhisperer
          </span>
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed holo-shimmer p-2">
          <span className="relative z-10">
            The AI that speaks Move.
            Transform Sui Move contracts into intelligent Claude skills.
          </span>
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/generate" className="btn-pill-primary">
            Get Started
            <svg className="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a
            href="https://github.com/example/move-whisperer"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pill-ghost"
          >
            <svg className="w-4 h-4 mr-2 inline" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            View Source
          </a>
        </div>
      </div>

      {/* Quick Start - Terminal Style */}
      <div className="mb-12">
        <div className="glass-panel rounded p-6 hud-corners">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded bg-[rgba(var(--neon-cyan-rgb),0.15)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold font-mono-cyber uppercase tracking-wider text-[var(--neon-cyan)]">Quick Start</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Option 1: Web UI */}
            <div className="rounded bg-black/40 p-4 border border-[rgba(var(--neon-cyan-rgb),0.1)] holo-shimmer">
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="text-xs px-2 py-0.5 rounded bg-[rgba(var(--neon-cyan-rgb),0.15)] text-[var(--neon-cyan)] font-mono-cyber tracking-wider">REC</span>
                <span className="text-sm font-medium font-mono-cyber">Web UI</span>
              </div>
              <div className="space-y-2 font-mono text-xs relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="neon-text-green text-[10px]">01</span>
                  <code className="bg-black/50 px-2 py-1 rounded flex-1 text-[var(--neon-green)]">pnpm run serve</code>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="neon-text-green text-[10px]">02</span>
                  <code className="bg-black/50 px-2 py-1 rounded flex-1 text-[var(--neon-green)]">cd web && pnpm dev</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="neon-text-green text-[10px]">03</span>
                  <Link href="/generate" className="text-[var(--neon-cyan)] hover:text-[var(--neon-magenta)] transition-colors neon-link">
                    Open Generator &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Option 2: CLI */}
            <div className="rounded bg-black/40 p-4 border border-[rgba(var(--neon-cyan-rgb),0.1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded bg-[rgba(var(--neon-green-rgb),0.1)] text-[var(--neon-green)] font-mono-cyber tracking-wider">CLI</span>
                <span className="text-sm font-medium font-mono-cyber">Terminal</span>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="bg-black/50 px-3 py-2 rounded text-[var(--neon-green)]">
                  <span className="text-[var(--neon-cyan)]">$</span> pnpm run cli generate 0xdee9 -n mainnet
                </div>
                <div className="bg-black/50 px-3 py-2 rounded text-[var(--neon-green)]">
                  <span className="text-[var(--neon-cyan)]">$</span> pnpm run cli generate 0x2::coin -s audit
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Server Status Section */}
      <div className="mb-16">
          {/* STATE: Connecting */}
          {isConnecting && (
            <div className="glass-panel rounded p-8 hud-corners animate-border-pulse">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded bg-[rgba(var(--neon-amber-rgb),0.15)] flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[var(--neon-amber)] border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-mono-cyber neon-text-amber">CONNECTING...</h2>
                  <p className="text-sm text-muted-foreground font-mono-cyber">Target: localhost:3456</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded p-5 border border-[rgba(var(--neon-cyan-rgb),0.08)] bg-black/30 animate-pulse">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded bg-[rgba(var(--neon-cyan-rgb),0.05)]" />
                      <div className="w-8 h-8 rounded-full bg-[rgba(var(--neon-cyan-rgb),0.05)]" />
                    </div>
                    <div className="h-4 w-24 bg-[rgba(var(--neon-cyan-rgb),0.05)] rounded mb-2" />
                    <div className="h-3 w-32 bg-[rgba(var(--neon-cyan-rgb),0.05)] rounded" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATE: Offline */}
          {!isConnected && !isConnecting && (
            <div className="glass-panel rounded p-8 border-[rgba(var(--neon-red-rgb),0.2)] hud-corners hud-corners-red">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded bg-[rgba(var(--neon-red-rgb),0.1)] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[var(--neon-red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L6.343 6.343m0 0L3 3" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 font-mono-cyber neon-text-red">SERVER OFFLINE</h2>
                <p className="text-muted-foreground font-mono-cyber text-sm">Start local server for CLI tool access</p>
              </div>

              <div className="bg-black/60 rounded p-6 mb-6 border border-[rgba(var(--neon-green-rgb),0.1)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground font-mono-cyber">Execute in project root:</span>
                  <button
                    onClick={() => navigator.clipboard.writeText('pnpm run serve')}
                    className="text-xs px-2 py-1 rounded cyber-btn font-mono-cyber"
                  >
                    COPY
                  </button>
                </div>
                <code className="text-lg terminal-text cursor-blink">$ pnpm run serve</code>
              </div>

              <div className="text-center">
                <button
                  onClick={() => connect()}
                  className="px-6 py-3 rounded cyber-btn font-mono-cyber tracking-wider"
                >
                  RECONNECT
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-[rgba(var(--neon-cyan-rgb),0.08)]">
                <p className="text-xs text-muted-foreground text-center mb-4 font-mono-cyber uppercase tracking-wider">Available tools on connection:</p>
                <div className="flex justify-center gap-6 opacity-40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[rgba(var(--neon-purple-rgb),0.15)] flex items-center justify-center">
                      <svg className="w-4 h-4 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <span className="text-sm font-mono-cyber">revela</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[rgba(var(--neon-amber-rgb),0.15)] flex items-center justify-center">
                      <svg className="w-4 h-4 text-[var(--neon-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-mono-cyber">claude</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[rgba(var(--neon-cyan-rgb),0.15)] flex items-center justify-center">
                      <svg className="w-4 h-4 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <span className="text-sm font-mono-cyber">sui</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATE: Connected */}
          {isConnected && (
            <div className="glass-panel rounded p-8 border-[rgba(var(--neon-green-rgb),0.2)] hud-corners scan-line">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-[rgba(var(--neon-green-rgb),0.15)] flex items-center justify-center relative">
                    <svg className="w-6 h-6 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="absolute -top-1 -right-1 status-dot status-dot-online" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-mono-cyber neon-text-green">SYSTEM ONLINE</h2>
                    <p className="text-sm text-muted-foreground font-mono-cyber">
                      v{health?.version} // localhost:3456 // {health?.tools.filter(t => t.available).length}/{health?.tools.length} tools active
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono-cyber">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Move Decompiler */}
                <div className={`rounded p-5 border transition-all duration-300 hud-corners ${
                  health?.tools.find(t => t.name === 'move-decompiler')?.available
                    ? 'bg-[rgba(var(--neon-green-rgb),0.05)] border-[rgba(var(--neon-green-rgb),0.2)]'
                    : 'bg-black/30 border-[rgba(var(--neon-cyan-rgb),0.08)]'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded bg-[rgba(var(--neon-purple-rgb),0.15)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-mono-cyber ${
                      health?.tools.find(t => t.name === 'move-decompiler')?.available
                        ? 'bg-[rgba(var(--neon-green-rgb),0.15)] neon-text-green'
                        : 'bg-[rgba(var(--neon-red-rgb),0.15)] neon-text-red'
                    }`}>
                      {health?.tools.find(t => t.name === 'move-decompiler')?.available ? '+' : 'x'}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1 font-mono-cyber text-sm">move-decompiler</h3>
                  <p className="text-xs text-muted-foreground mb-2">Sui Move bytecode decompiler</p>
                  {health?.tools.find(t => t.name === 'move-decompiler')?.available ? (
                    <p className="text-xs neon-text-green font-mono-cyber">
                      {health.tools.find(t => t.name === 'move-decompiler')?.version || 'INSTALLED'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-mono-cyber">Prerequisites (Ubuntu):</p>
                      <code className="block text-[10px] bg-black/50 px-2 py-1.5 rounded text-[var(--neon-green)] font-mono opacity-70">
                        apt install build-essential libssl-dev libclang-dev cmake
                      </code>
                      <p className="text-xs text-muted-foreground mt-2 font-mono-cyber">One-click install:</p>
                      <code className="block text-[10px] bg-black/50 px-2 py-1.5 rounded text-[var(--neon-purple)] font-mono">
                        pnpm run install:revela
                      </code>
                      <a
                        href="https://github.com/verichains/revela"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--neon-purple)] hover:text-[var(--neon-cyan)] transition-colors neon-link mt-2"
                      >
                        <span>GitHub Repo</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>

                {/* Claude CLI */}
                <div className={`rounded p-5 border transition-all duration-300 hud-corners ${
                  health?.tools.find(t => t.name === 'claude')?.available
                    ? 'bg-[rgba(var(--neon-green-rgb),0.05)] border-[rgba(var(--neon-green-rgb),0.2)]'
                    : 'bg-black/30 border-[rgba(var(--neon-cyan-rgb),0.08)]'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded bg-[rgba(var(--neon-amber-rgb),0.15)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--neon-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-mono-cyber ${
                      health?.tools.find(t => t.name === 'claude')?.available
                        ? 'bg-[rgba(var(--neon-green-rgb),0.15)] neon-text-green'
                        : 'bg-[rgba(var(--neon-red-rgb),0.15)] neon-text-red'
                    }`}>
                      {health?.tools.find(t => t.name === 'claude')?.available ? '+' : 'x'}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1 font-mono-cyber text-sm">claude</h3>
                  <p className="text-xs text-muted-foreground mb-2">Claude Code CLI AI generation</p>
                  {health?.tools.find(t => t.name === 'claude')?.available ? (
                    <p className="text-xs neon-text-green truncate font-mono-cyber">
                      {health.tools.find(t => t.name === 'claude')?.version || 'INSTALLED'}
                    </p>
                  ) : (
                    <a
                      href="https://claude.ai/code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--neon-amber)] hover:text-[var(--neon-cyan)] transition-colors neon-link"
                    >
                      Install Guide &rarr;
                    </a>
                  )}
                </div>

                {/* Sui CLI */}
                <div className={`rounded p-5 border transition-all duration-300 hud-corners ${
                  health?.tools.find(t => t.name === 'sui')?.available
                    ? 'bg-[rgba(var(--neon-green-rgb),0.05)] border-[rgba(var(--neon-green-rgb),0.2)]'
                    : 'bg-black/30 border-[rgba(var(--neon-cyan-rgb),0.08)]'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded bg-[rgba(var(--neon-cyan-rgb),0.15)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-mono-cyber ${
                      health?.tools.find(t => t.name === 'sui')?.available
                        ? 'bg-[rgba(var(--neon-green-rgb),0.15)] neon-text-green'
                        : 'bg-[rgba(var(--neon-red-rgb),0.15)] neon-text-red'
                    }`}>
                      {health?.tools.find(t => t.name === 'sui')?.available ? '+' : 'x'}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1 font-mono-cyber text-sm">sui</h3>
                  <p className="text-xs text-muted-foreground mb-2">Sui CLI blockchain interface</p>
                  {health?.tools.find(t => t.name === 'sui')?.available ? (
                    <p className="text-xs neon-text-green truncate font-mono-cyber">
                      {health.tools.find(t => t.name === 'sui')?.version || 'INSTALLED'}
                    </p>
                  ) : (
                    <a
                      href="https://docs.sui.io/guides/developer/getting-started/sui-install"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-magenta)] transition-colors neon-link"
                    >
                      Install Guide &rarr;
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <div className="glass-panel-hover rounded p-8 hud-corners">
          <div className="w-14 h-14 rounded bg-[rgba(var(--neon-cyan-rgb),0.1)] flex items-center justify-center mb-6 cyber-glow">
            <svg className="w-7 h-7 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-3 font-mono-cyber text-[var(--neon-cyan)]">From Package ID</h3>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Enter any Sui package ID to automatically fetch ABI and generate comprehensive skill documentation.
          </p>
        </div>

        <div className="glass-panel-hover rounded p-8 hud-corners">
          <div className="w-14 h-14 rounded bg-[rgba(var(--neon-magenta-rgb),0.1)] flex items-center justify-center mb-6 cyber-glow-magenta">
            <svg className="w-7 h-7 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-3 font-mono-cyber text-[var(--neon-magenta)]">6 Scene Modes</h3>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Generate specialized documentation for SDK integration, security audit, frontend dev, trading bots, and more.
          </p>
        </div>

        <div className="glass-panel-hover rounded p-8 hud-corners">
          <div className="w-14 h-14 rounded bg-[rgba(var(--neon-green-rgb),0.1)] flex items-center justify-center mb-6 cyber-glow-green">
            <svg className="w-7 h-7 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-3 font-mono-cyber text-[var(--neon-green)]">Complete Package</h3>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Download skill package with SKILL.md, TypeScript types, code examples, and ready-to-use scripts.
          </p>
        </div>
      </div>

      {/* Scene Preview */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-3 text-center font-mono-cyber">
          <span className="gradient-text">Choose Your Scene</span>
        </h2>
        <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto text-sm">
          Different purposes require different documentation. Select the scene that fits your needs.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'SDK', desc: 'Integration', color: 'cyan' },
            { name: 'Learn', desc: 'Protocol', color: 'purple' },
            { name: 'Audit', desc: 'Security', color: 'magenta' },
            { name: 'Frontend', desc: 'UI/UX', color: 'amber' },
            { name: 'Bot', desc: 'Trading', color: 'green' },
            { name: 'Docs', desc: 'Reference', color: 'cyan' },
          ].map((scene) => (
            <Link
              key={scene.name}
              href={`/generate?scene=${scene.name.toLowerCase()}`}
              className={`glass-panel rounded p-4 text-center transition-all duration-300 cursor-pointer group hover:border-[rgba(var(--neon-${scene.color}-rgb),0.3)] hud-corners`}
            >
              <div className={`text-2xl mb-2 font-mono-cyber font-bold group-hover:scale-110 transition-transform duration-300 neon-text-${scene.color}`}>
                {scene.name.charAt(0)}
              </div>
              <div className="font-medium text-sm font-mono-cyber">{scene.name}</div>
              <div className="text-xs text-muted-foreground">{scene.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-16 pt-10 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--neon-cyan)] to-transparent opacity-30" />
        <p className="text-sm text-muted-foreground font-mono-cyber">
          Built for the Sui ecosystem. Open source and free to use.
        </p>
      </div>
    </div>
  );
}
