'use client';

import { useState } from 'react';
import Link from 'next/link';

interface TransactionAnalysis {
  digest: string;
  network: string;
  status: 'success' | 'failure';
  type: string;
  confidence: number;
  sender: string;
  timestamp?: string;
  gasUsed: string;
  summary: {
    moveCalls: number;
    packages: number;
    modules: number;
    objectsCreated: number;
    objectsDeleted: number;
    events: number;
  };
  involvedPackages: Array<{
    packageId: string;
    moduleName: string;
    functionsUsed: string[];
    callCount: number;
  }>;
  callSequence: Array<{
    index: number;
    target: string;
    purpose: string;
  }>;
  balanceChanges: Array<{
    coinType: string;
    amount: string;
  }>;
}

const TYPE_COLORS: Record<string, string> = {
  swap: 'bg-[rgba(var(--neon-cyan-rgb),0.1)] border border-[rgba(var(--neon-cyan-rgb),0.25)] text-[var(--neon-cyan)]',
  transfer: 'bg-[rgba(var(--neon-green-rgb),0.1)] border border-[rgba(var(--neon-green-rgb),0.25)] text-[var(--neon-green)]',
  mint: 'bg-[rgba(var(--neon-magenta-rgb),0.1)] border border-[rgba(var(--neon-magenta-rgb),0.25)] text-[var(--neon-magenta)]',
  burn: 'bg-[rgba(var(--neon-red-rgb),0.1)] border border-[rgba(var(--neon-red-rgb),0.25)] text-[var(--neon-red)]',
  stake: 'bg-[rgba(var(--neon-cyan-rgb),0.1)] border border-[rgba(var(--neon-cyan-rgb),0.25)] text-[var(--neon-cyan)]',
  unstake: 'bg-[rgba(var(--neon-amber-rgb),0.1)] border border-[rgba(var(--neon-amber-rgb),0.25)] text-[var(--neon-amber)]',
  liquidity_add: 'bg-[rgba(var(--neon-cyan-rgb),0.1)] border border-[rgba(var(--neon-cyan-rgb),0.25)] text-[var(--neon-cyan)]',
  liquidity_remove: 'bg-[rgba(var(--neon-amber-rgb),0.1)] border border-[rgba(var(--neon-amber-rgb),0.25)] text-[var(--neon-amber)]',
  borrow: 'bg-[rgba(var(--neon-purple-rgb),0.1)] border border-[rgba(var(--neon-purple-rgb),0.25)] text-[var(--neon-purple)]',
  repay: 'bg-[rgba(var(--neon-green-rgb),0.1)] border border-[rgba(var(--neon-green-rgb),0.25)] text-[var(--neon-green)]',
  claim: 'bg-[rgba(var(--neon-green-rgb),0.1)] border border-[rgba(var(--neon-green-rgb),0.25)] text-[var(--neon-green)]',
  complex: 'bg-[rgba(var(--neon-magenta-rgb),0.08)] border border-[rgba(var(--neon-magenta-rgb),0.2)] text-[var(--neon-magenta)]',
  unknown: 'bg-[rgba(var(--neon-cyan-rgb),0.05)] border border-[rgba(var(--neon-cyan-rgb),0.1)] text-[rgba(var(--neon-cyan-rgb),0.5)]',
};

export default function TransactionAnalyzerPage() {
  const [digest, setDigest] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | 'devnet'>('mainnet');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TransactionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!digest.trim()) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest: digest.trim(), network }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Failed to analyze transaction');
      }

      const data = await response.json() as { analysis: TransactionAnalysis };
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-[rgba(var(--neon-cyan-rgb),0.1)]">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
          <div className="flex items-center gap-4">
            <Link
              href="/generate"
              className="p-2 rounded hover:bg-[rgba(var(--neon-cyan-rgb),0.05)] transition-colors border border-transparent hover:border-[rgba(var(--neon-cyan-rgb),0.15)]"
            >
              <svg className="w-5 h-5 text-[rgba(var(--neon-cyan-rgb),0.6)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-mono-cyber neon-text tracking-wide">Transaction Analyzer</h1>
              <p className="text-muted-foreground text-sm font-mono-cyber">
                Analyze transactions and discover contracts to generate skills
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
        {/* Input Section */}
        <div className="glass-panel rounded p-6 mb-6 hud-corners">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-mono-cyber uppercase tracking-widest mb-2 text-[rgba(var(--neon-cyan-rgb),0.6)]">Transaction Digest</label>
              <input
                type="text"
                placeholder="Enter transaction digest (0x...)"
                value={digest}
                onChange={(e) => setDigest(e.target.value)}
                className="cyber-input w-full px-4 py-3 rounded text-sm"
              />
            </div>
            <div className="w-full md:w-40">
              <label className="block text-xs font-mono-cyber uppercase tracking-widest mb-2 text-[rgba(var(--neon-cyan-rgb),0.6)]">Network</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as typeof network)}
                className="cyber-input w-full px-4 py-3 rounded"
              >
                <option value="mainnet">Mainnet</option>
                <option value="testnet">Testnet</option>
                <option value="devnet">Devnet</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={!digest.trim() || loading}
                className="cyber-btn px-6 py-3 rounded font-mono-cyber text-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="glass-panel rounded p-4 mb-6 border-[rgba(var(--neon-red-rgb),0.3)] bg-[rgba(var(--neon-red-rgb),0.05)]">
            <div className="flex items-center gap-2 neon-text-red font-mono-cyber text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Analysis Result */}
        {analysis && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="glass-panel rounded p-6 hud-corners scan-line">
              <h2 className="font-mono-cyber text-lg mb-4 neon-text uppercase tracking-wider">Transaction Overview</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded bg-black/30 border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                  <div className="text-xs text-muted-foreground mb-1 font-mono-cyber uppercase tracking-wider">Type</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-mono-cyber uppercase ${TYPE_COLORS[analysis.type] || TYPE_COLORS.unknown}`}>
                      {analysis.type}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono-cyber">
                      {Math.round(analysis.confidence * 100)}%
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded bg-black/30 border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                  <div className="text-xs text-muted-foreground mb-1 font-mono-cyber uppercase tracking-wider">Status</div>
                  <div className={`font-mono-cyber ${analysis.status === 'success' ? 'neon-text-green' : 'neon-text-red'}`}>
                    {analysis.status === 'success' ? '[ OK ] Success' : '[ ERR ] Failed'}
                  </div>
                </div>

                <div className="p-4 rounded bg-black/30 border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                  <div className="text-xs text-muted-foreground mb-1 font-mono-cyber uppercase tracking-wider">Gas Used</div>
                  <div className="font-mono-cyber neon-text-amber">{formatGas(analysis.gasUsed)}</div>
                </div>

                <div className="p-4 rounded bg-black/30 border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                  <div className="text-xs text-muted-foreground mb-1 font-mono-cyber uppercase tracking-wider">Move Calls</div>
                  <div className="font-mono-cyber neon-text">{analysis.summary.moveCalls}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm font-mono-cyber">
                <div className="p-2 rounded bg-black/20">
                  <span className="text-[rgba(var(--neon-cyan-rgb),0.4)] uppercase text-xs tracking-wider">Digest: </span>
                  <span className="text-[rgba(var(--neon-cyan-rgb),0.8)]">{analysis.digest.slice(0, 20)}...</span>
                </div>
                <div className="p-2 rounded bg-black/20">
                  <span className="text-[rgba(var(--neon-cyan-rgb),0.4)] uppercase text-xs tracking-wider">Sender: </span>
                  <span className="text-[rgba(var(--neon-cyan-rgb),0.8)]">{analysis.sender.slice(0, 10)}...{analysis.sender.slice(-6)}</span>
                </div>
              </div>
            </div>

            {/* Packages - Contract Discovery */}
            <div className="glass-panel rounded p-6 hud-corners">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono-cyber text-lg neon-text uppercase tracking-wider">Contracts Discovered</h2>
                <span className="text-xs text-muted-foreground font-mono-cyber">
                  {analysis.involvedPackages.length} package{analysis.involvedPackages.length > 1 ? 's' : ''} found
                </span>
              </div>
              <div className="space-y-3">
                {analysis.involvedPackages.map((pkg, i) => (
                  <div key={i} className="p-4 rounded bg-black/30 border border-[rgba(var(--neon-cyan-rgb),0.08)] hover:border-[rgba(var(--neon-cyan-rgb),0.25)] hover:bg-[rgba(var(--neon-cyan-rgb),0.02)] transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-mono-cyber text-lg neon-text">{pkg.moduleName}</span>
                        <span className="text-xs text-[rgba(var(--neon-cyan-rgb),0.4)] font-mono-cyber ml-2">
                          {pkg.packageId.slice(0, 10)}...{pkg.packageId.slice(-4)}
                        </span>
                      </div>
                      <Link
                        href={`/generate?input=${pkg.packageId}::${pkg.moduleName}&network=${network}`}
                        className="cyber-btn px-4 py-2 rounded text-xs font-mono-cyber flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Skill
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pkg.functionsUsed.map((fn, j) => (
                        <span key={j} className="px-2 py-1 rounded bg-[rgba(var(--neon-cyan-rgb),0.06)] border border-[rgba(var(--neon-cyan-rgb),0.12)] text-[rgba(var(--neon-cyan-rgb),0.8)] text-xs font-mono-cyber">
                          {fn}
                        </span>
                      ))}
                      {pkg.callCount > pkg.functionsUsed.length && (
                        <span className="text-xs text-muted-foreground font-mono-cyber">
                          +{pkg.callCount - pkg.functionsUsed.length} more calls
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Call Sequence */}
            <div className="glass-panel rounded p-6 hud-corners matrix-rain-bg">
              <h2 className="font-mono-cyber text-lg mb-4 neon-text-green uppercase tracking-wider relative z-10">Call Sequence</h2>
              <div className="space-y-2 relative z-10">
                {analysis.callSequence.map((call, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded bg-black/40 border border-[rgba(var(--neon-green-rgb),0.08)] hover:border-[rgba(var(--neon-green-rgb),0.2)] transition-colors">
                    <div className="w-6 h-6 rounded border border-[rgba(var(--neon-green-rgb),0.3)] bg-[rgba(var(--neon-green-rgb),0.08)] text-[var(--neon-green)] text-xs font-mono-cyber flex items-center justify-center flex-shrink-0">
                      {call.index + 1}
                    </div>
                    <div>
                      <div className="font-mono-cyber text-sm text-[rgba(var(--neon-green-rgb),0.8)]">{call.target}</div>
                      <div className="text-xs text-muted-foreground font-mono-cyber">{call.purpose}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Empty State */}
        {!analysis && !loading && !error && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto rounded border border-[rgba(var(--neon-cyan-rgb),0.15)] bg-[rgba(var(--neon-cyan-rgb),0.03)] flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-[rgba(var(--neon-cyan-rgb),0.3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-mono-cyber neon-text mb-2">Analyze a Transaction</h3>
            <p className="text-muted-foreground max-w-md mx-auto font-mono-cyber text-sm">
              Enter a Sui transaction digest to understand what it does,
              discover the contracts involved, and generate skills for them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatGas(gas: string): string {
  const value = BigInt(gas);
  const ONE_SUI = BigInt(1_000_000_000);
  const ONE_MILLION = BigInt(1_000_000);
  if (value >= ONE_SUI) {
    return `${(Number(value) / 1_000_000_000).toFixed(4)} SUI`;
  }
  if (value >= ONE_MILLION) {
    return `${(Number(value) / 1_000_000).toFixed(2)}M MIST`;
  }
  return `${value} MIST`;
}
