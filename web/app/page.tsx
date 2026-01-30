import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto px-6 py-20">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-sm text-muted-foreground mb-8">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Powered by Sui Move
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          <span className="gradient-text">auto-sui-skills</span>
        </h1>

        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Transform Sui Move contracts into intelligent Claude skills.
          Generate natural language interfaces for AI agents in seconds.
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

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-20">
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
      <div className="mb-20">
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
            <div key={scene.name} className="glass-panel rounded-xl p-4 text-center hover:border-primary/30 transition-all duration-300 cursor-pointer group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{scene.icon}</div>
              <div className="font-medium text-sm">{scene.name}</div>
              <div className="text-xs text-muted-foreground">{scene.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Quick Start</h2>

        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">Terminal</span>
          </div>

          <div className="p-6 font-mono text-sm">
            <div className="mb-4">
              <span className="text-muted-foreground"># Install and run</span>
            </div>
            <div className="mb-2">
              <span className="text-primary">$</span>{' '}
              <span className="text-foreground">npx auto-sui-skills generate 0xdee9::clob_v2 -n mainnet</span>
            </div>
            <div className="mb-6">
              <span className="text-primary">$</span>{' '}
              <span className="text-foreground">npx auto-sui-skills generate 0x2::coin -s audit</span>
            </div>

            <div className="mb-4">
              <span className="text-muted-foreground"># Or use the web interface</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-success">→</span>
              <Link href="/generate" className="text-primary hover:underline">
                Open Generator
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-20 pt-10 border-t border-white/5">
        <p className="text-sm text-muted-foreground">
          Built for the Sui ecosystem. Open source and free to use.
        </p>
      </div>
    </div>
  );
}
