'use client';

import Link from 'next/link';
import { useLocalServer } from '../hooks/useLocalServer';

export default function HomePage() {
  const { isConnected, isConnecting, health, connect } = useLocalServer({ autoConnect: true });

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          <span className="gradient-text">auto-sui-skills</span>
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Transform Sui Move contracts into intelligent Claude skills.
          Decompile bytecode and generate AI-ready documentation.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/generate" className="btn-pill-primary">
            Get Started
            <svg className="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a
            href="https://github.com/example/auto-sui-skills"
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

      {/* Quick Start - Prominent */}
      <div className="mb-12 max-w-4xl mx-auto">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Quick Start</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Option 1: Web UI */}
            <div className="rounded-xl bg-white/5 p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">推荐</span>
                <span className="text-sm font-medium">Web 界面</span>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-primary">1.</span>
                  <code className="bg-black/30 px-2 py-1 rounded flex-1">bun run serve</code>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-primary">2.</span>
                  <code className="bg-black/30 px-2 py-1 rounded flex-1">cd web && bun dev</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary">3.</span>
                  <Link href="/generate" className="text-primary hover:underline">
                    打开生成器 →
                  </Link>
                </div>
              </div>
            </div>

            {/* Option 2: CLI */}
            <div className="rounded-xl bg-white/5 p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground font-medium">CLI</span>
                <span className="text-sm font-medium">命令行</span>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="bg-black/30 px-3 py-2 rounded text-muted-foreground">
                  <span className="text-green-400">$</span> bun run cli generate 0xdee9 -n mainnet
                </div>
                <div className="bg-black/30 px-3 py-2 rounded text-muted-foreground">
                  <span className="text-green-400">$</span> bun run cli generate 0x2::coin -s audit
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Server Status Section - State-based display */}
      <div className="mb-16">
        <div className="max-w-4xl mx-auto">
          {/* STATE: Connecting */}
          {isConnecting && (
            <div className="glass-panel rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">正在连接本地服务器...</h2>
                  <p className="text-sm text-muted-foreground">Connecting to localhost:3456</p>
                </div>
              </div>
              {/* Skeleton loader for tools */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl p-5 border border-white/10 bg-white/5 animate-pulse">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl bg-white/10" />
                      <div className="w-8 h-8 rounded-full bg-white/10" />
                    </div>
                    <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-32 bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATE: Offline */}
          {!isConnected && !isConnecting && (
            <div className="glass-panel rounded-3xl p-8 border-red-500/20">
              {/* Offline Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L6.343 6.343m0 0L3 3" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2">本地服务器未运行</h2>
                <p className="text-muted-foreground">启动服务器以使用 CLI 工具进行反编译和 AI 生成</p>
              </div>

              {/* Start Command */}
              <div className="bg-black/40 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">在项目根目录执行:</span>
                  <button
                    onClick={() => navigator.clipboard.writeText('bun run serve')}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    复制
                  </button>
                </div>
                <code className="text-lg font-mono text-green-400">$ bun run serve</code>
              </div>

              {/* Retry button */}
              <div className="text-center">
                <button
                  onClick={() => connect()}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  重新连接
                </button>
              </div>

              {/* Dimmed tools preview */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-xs text-muted-foreground text-center mb-4">连接后可用的工具:</p>
                <div className="flex justify-center gap-6 opacity-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <span className="text-sm">move-decompiler</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm">claude</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <span className="text-sm">sui</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATE: Connected */}
          {isConnected && (
            <div className="glass-panel rounded-3xl p-8 border-green-500/20">
              {/* Connected Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center relative">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-green-400">服务器已连接</h2>
                    <p className="text-sm text-muted-foreground">
                      v{health?.version} • localhost:3456 • {health?.tools.filter(t => t.available).length}/{health?.tools.length} 工具可用
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>

              {/* Tools Grid - Full detail */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Move Decompiler */}
                <div className={`rounded-2xl p-5 border transition-all duration-300 ${
                  health?.tools.find(t => t.name === 'move-decompiler')?.available
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                      health?.tools.find(t => t.name === 'move-decompiler')?.available
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {health?.tools.find(t => t.name === 'move-decompiler')?.available ? '✓' : '✗'}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">move-decompiler</h3>
                  <p className="text-xs text-muted-foreground mb-2">Sui Move 高质量反编译器</p>
                  {health?.tools.find(t => t.name === 'move-decompiler')?.available ? (
                    <p className="text-xs text-green-400">
                      {health.tools.find(t => t.name === 'move-decompiler')?.version || '已安装'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">前置依赖 (Ubuntu):</p>
                      <code className="block text-[10px] bg-black/40 px-2 py-1.5 rounded text-gray-400 font-mono">
                        apt install build-essential libssl-dev libclang-dev cmake
                      </code>
                      <p className="text-xs text-muted-foreground mt-2">一键安装:</p>
                      <code className="block text-[10px] bg-black/40 px-2 py-1.5 rounded text-purple-300 font-mono">
                        bun run install:revela
                      </code>
                      <a
                        href="https://github.com/verichains/revela"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-400 hover:underline mt-2"
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
                <div className={`rounded-2xl p-5 border transition-all duration-300 ${
                  health?.tools.find(t => t.name === 'claude')?.available
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                      health?.tools.find(t => t.name === 'claude')?.available
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {health?.tools.find(t => t.name === 'claude')?.available ? '✓' : '✗'}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">claude</h3>
                  <p className="text-xs text-muted-foreground mb-2">Claude Code CLI AI 生成</p>
                  {health?.tools.find(t => t.name === 'claude')?.available ? (
                    <p className="text-xs text-green-400 truncate">
                      {health.tools.find(t => t.name === 'claude')?.version || '已安装'}
                    </p>
                  ) : (
                    <a
                      href="https://claude.ai/code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-400 hover:underline"
                    >
                      安装指南 →
                    </a>
                  )}
                </div>

                {/* Sui CLI */}
                <div className={`rounded-2xl p-5 border transition-all duration-300 ${
                  health?.tools.find(t => t.name === 'sui')?.available
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                      health?.tools.find(t => t.name === 'sui')?.available
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {health?.tools.find(t => t.name === 'sui')?.available ? '✓' : '✗'}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">sui</h3>
                  <p className="text-xs text-muted-foreground mb-2">Sui CLI 区块链交互</p>
                  {health?.tools.find(t => t.name === 'sui')?.available ? (
                    <p className="text-xs text-green-400 truncate">
                      {health.tools.find(t => t.name === 'sui')?.version || '已安装'}
                    </p>
                  ) : (
                    <a
                      href="https://docs.sui.io/guides/developer/getting-started/sui-install"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline"
                    >
                      安装指南 →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <div className="glass-panel-hover rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-inner-glow">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-3">From Package ID</h3>
          <p className="text-muted-foreground leading-relaxed">
            Enter any Sui package ID to automatically fetch ABI and generate comprehensive skill documentation.
          </p>
        </div>

        <div className="glass-panel-hover rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-3">6 Scene Modes</h3>
          <p className="text-muted-foreground leading-relaxed">
            Generate specialized documentation for SDK integration, security audit, frontend dev, trading bots, and more.
          </p>
        </div>

        <div className="glass-panel-hover rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-3">Complete Package</h3>
          <p className="text-muted-foreground leading-relaxed">
            Download skill package with SKILL.md, TypeScript types, code examples, and ready-to-use scripts.
          </p>
        </div>
      </div>

      {/* Scene Preview */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-3 text-center">Choose Your Scene</h2>
        <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
          Different purposes require different documentation. Select the scene that fits your needs.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: '🔌', name: 'SDK', desc: 'Integration' },
            { icon: '📚', name: 'Learn', desc: 'Protocol' },
            { icon: '🔒', name: 'Audit', desc: 'Security' },
            { icon: '🖥️', name: 'Frontend', desc: 'UI/UX' },
            { icon: '🤖', name: 'Bot', desc: 'Trading' },
            { icon: '📝', name: 'Docs', desc: 'Reference' },
          ].map((scene) => (
            <Link
              key={scene.name}
              href={`/generate?scene=${scene.name.toLowerCase()}`}
              className="glass-panel rounded-xl p-4 text-center hover:border-primary/30 transition-all duration-300 cursor-pointer group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{scene.icon}</div>
              <div className="font-medium text-sm">{scene.name}</div>
              <div className="text-xs text-muted-foreground">{scene.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-16 pt-10 border-t border-white/5">
        <p className="text-sm text-muted-foreground">
          Built for the Sui ecosystem. Open source and free to use.
        </p>
      </div>
    </div>
  );
}
