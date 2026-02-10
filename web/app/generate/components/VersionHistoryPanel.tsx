'use client';

import { useState } from 'react';
import type { PackageVersionHistory, VersionCompareResult } from '../../../lib/local-server';

interface VersionHistoryPanelProps {
  history: PackageVersionHistory;
  selectedVersion: number | null;
  onSelectVersion: (version: number, packageId: string) => void;
  onCompare?: (fromVersion: number, toVersion: number) => Promise<VersionCompareResult>;
  isComparing?: boolean;
  comparison?: VersionCompareResult | null;
  isNotLatest?: boolean;
  onUseLatest?: () => void;
  onAnalyzeChanges?: (fromVersion: number, toVersion: number, changes: VersionCompareResult) => Promise<string>;
  isAnalyzing?: boolean;
  changeAnalysis?: string | null;
}

// Copy button component
function CopyButton({ text, className = '' }: { text: string; className?: string }) {
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
      className={`p-1 rounded hover:bg-[rgba(var(--neon-cyan-rgb),0.08)] transition-colors ${className}`}
      title="Copy address"
    >
      {copied ? (
        <svg className="w-3 h-3 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-muted-foreground hover:text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

function getExplorerUrl(network: string, type: 'txblock' | 'account', id: string): string {
  const base = 'https://suiscan.xyz';
  const net = network === 'mainnet' ? 'mainnet' : network;
  return `${base}/${net}/${type}/${id}`;
}

function formatTimestamp(timestampMs?: string): string {
  if (!timestampMs) return '';
  const date = new Date(Number(timestampMs));
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function VersionHistoryPanel({
  history,
  selectedVersion,
  onSelectVersion,
  onCompare,
  isComparing,
  comparison,
  isNotLatest,
  onAnalyzeChanges,
  isAnalyzing,
  changeAnalysis,
}: VersionHistoryPanelProps) {
  const [showCompare, setShowCompare] = useState(false);
  const [compareFrom, setCompareFrom] = useState<number>(1);
  const [compareTo, setCompareTo] = useState<number>(history.currentVersion);

  const handleCompare = async () => {
    if (onCompare && compareFrom !== compareTo) {
      await onCompare(compareFrom, compareTo);
    }
  };

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[rgba(var(--neon-cyan-rgb),0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.08)] flex items-center justify-center shadow-[0_0_10px_rgba(var(--neon-purple-rgb),0.15)]">
              <svg className="w-5 h-5 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-mono-cyber text-sm uppercase tracking-wider neon-text">Version History</h3>
              <p className="text-xs text-muted-foreground font-mono-cyber">{history.versions.length} version(s) available</p>
            </div>
          </div>
          {isNotLatest && (
            <div className="px-3 py-1.5 rounded bg-[rgba(var(--neon-amber-rgb),0.08)] border border-[rgba(var(--neon-amber-rgb),0.2)]">
              <span className="text-xs text-[var(--neon-amber)] font-mono-cyber">v{selectedVersion} selected (latest: v{history.currentVersion})</span>
            </div>
          )}
        </div>
      </div>

      {/* Version List */}
      <div className="p-4">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
          {history.versions.map((version) => {
            const isSelected = selectedVersion === version.version;
            const isLatest = version.version === history.currentVersion;

            return (
              <button
                key={version.version}
                onClick={() => onSelectVersion(version.version, version.packageId)}
                className={`w-full text-left p-3.5 rounded transition-all duration-200 ${
                  isSelected
                    ? 'bg-[rgba(var(--neon-cyan-rgb),0.08)] border border-[rgba(var(--neon-cyan-rgb),0.3)] shadow-[0_0_8px_rgba(var(--neon-cyan-rgb),0.1)]'
                    : 'bg-[rgba(var(--neon-cyan-rgb),0.02)] border border-transparent hover:border-[rgba(var(--neon-cyan-rgb),0.12)] hover:bg-[rgba(var(--neon-cyan-rgb),0.05)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono-cyber font-semibold ${isSelected ? 'text-[var(--neon-cyan)]' : ''}`}>
                      v{version.version}
                    </span>
                    {isLatest && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono-cyber font-medium rounded bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.25)]">
                        latest
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground font-mono-cyber truncate">
                    {version.packageId.slice(0, 16)}...{version.packageId.slice(-6)}
                  </span>
                  <CopyButton text={version.packageId} />
                </div>
                {/* Timestamp */}
                {version.timestampMs && (
                  <div className="mt-1.5 text-[11px] text-muted-foreground font-mono-cyber">
                    {formatTimestamp(version.timestampMs)}
                  </div>
                )}
                {/* Sender / Owner */}
                {version.sender && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <a
                      href={getExplorerUrl(history.network, 'account', version.sender)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-muted-foreground hover:text-[var(--neon-cyan)] font-mono-cyber truncate transition-colors"
                    >
                      {version.sender.slice(0, 8)}...{version.sender.slice(-4)}
                    </a>
                    <CopyButton text={version.sender} />
                  </div>
                )}
                {/* TX Link */}
                {version.digest && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <a
                      href={getExplorerUrl(history.network, 'txblock', version.digest)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-[var(--neon-purple)] hover:text-[var(--neon-cyan)] font-mono-cyber truncate transition-colors neon-link"
                    >
                      {version.digest.slice(0, 12)}...
                    </a>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compare Section */}
      {history.versions.length > 1 && (
        <div className="border-t border-[rgba(var(--neon-cyan-rgb),0.06)] p-3">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="flex items-center justify-between w-full text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground font-mono-cyber">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Compare Versions
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform text-[rgba(var(--neon-cyan-rgb),0.4)] ${showCompare ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCompare && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-1.5 items-center">
                <select
                  value={compareFrom}
                  onChange={(e) => setCompareFrom(parseInt(e.target.value))}
                  className="cyber-input flex-1 px-2 py-1.5 rounded text-xs font-mono-cyber"
                >
                  {history.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version}
                    </option>
                  ))}
                </select>
                <span className="text-[rgba(var(--neon-cyan-rgb),0.4)] text-xs font-mono-cyber">&rarr;</span>
                <select
                  value={compareTo}
                  onChange={(e) => setCompareTo(parseInt(e.target.value))}
                  className="cyber-input flex-1 px-2 py-1.5 rounded text-xs font-mono-cyber"
                >
                  {history.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCompare}
                disabled={isComparing || compareFrom === compareTo}
                className={`w-full py-1.5 rounded text-xs font-mono-cyber font-medium transition-all ${
                  isComparing || compareFrom === compareTo
                    ? 'bg-[rgba(var(--neon-cyan-rgb),0.03)] text-muted-foreground cursor-not-allowed border border-[rgba(var(--neon-cyan-rgb),0.06)]'
                    : 'bg-[rgba(var(--neon-cyan-rgb),0.08)] text-[var(--neon-cyan)] hover:bg-[rgba(var(--neon-cyan-rgb),0.15)] border border-[rgba(var(--neon-cyan-rgb),0.2)]'
                }`}
              >
                {isComparing ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Comparing...
                  </span>
                ) : (
                  'Compare'
                )}
              </button>
            </div>
          )}

          {/* Comparison Results */}
          {comparison && comparison.structural && (
            <div className="mt-3 p-2.5 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
              <h4 className="text-xs font-mono-cyber font-medium mb-1.5 text-[rgba(var(--neon-cyan-rgb),0.7)]">
                v{comparison.metadata.fromVersion} &rarr; v{comparison.metadata.toVersion}
              </h4>

              <div className="space-y-1.5">
                {/* Summary */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono-cyber">
                  {comparison.structural.summary.functionsAdded > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-green-rgb),0.12)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.2)]">
                      +{comparison.structural.summary.functionsAdded} fn
                    </span>
                  )}
                  {comparison.structural.summary.functionsRemoved > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-red-rgb),0.12)] text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.2)]">
                      -{comparison.structural.summary.functionsRemoved} fn
                    </span>
                  )}
                  {comparison.structural.summary.functionsModified > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-amber-rgb),0.12)] text-[var(--neon-amber)] border border-[rgba(var(--neon-amber-rgb),0.2)]">
                      ~{comparison.structural.summary.functionsModified} fn
                    </span>
                  )}
                  {comparison.structural.summary.structsAdded > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-green-rgb),0.12)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.2)]">
                      +{comparison.structural.summary.structsAdded} struct
                    </span>
                  )}
                  {comparison.structural.summary.structsRemoved > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-red-rgb),0.12)] text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.2)]">
                      -{comparison.structural.summary.structsRemoved} struct
                    </span>
                  )}
                </div>

                {/* Breaking changes warning */}
                {comparison.structural.summary.breakingChanges && (
                  <div className="flex items-center gap-1 text-[10px] text-[var(--neon-red)] font-mono-cyber">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Breaking changes
                  </div>
                )}

                {/* Change list */}
                {comparison.structural.changes.length > 0 && (
                  <div className="mt-1.5 max-h-24 overflow-y-auto space-y-0.5">
                    {comparison.structural.changes.slice(0, 6).map((change, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] font-mono-cyber">
                        <span className={`w-3 h-3 flex items-center justify-center rounded text-[8px] ${
                          change.type === 'added' ? 'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)]' :
                          change.type === 'removed' ? 'bg-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)]' :
                          'bg-[rgba(var(--neon-amber-rgb),0.15)] text-[var(--neon-amber)]'
                        }`}>
                          {change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~'}
                        </span>
                        <span className="font-mono-cyber truncate text-[rgba(var(--neon-cyan-rgb),0.7)]">{change.name}</span>
                        {change.risk === 'breaking' && (
                          <span className="px-1 py-0.5 rounded bg-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)] text-[8px]">!</span>
                        )}
                      </div>
                    ))}
                    {comparison.structural.changes.length > 6 && (
                      <span className="text-[10px] text-muted-foreground font-mono-cyber">
                        +{comparison.structural.changes.length - 6} more
                      </span>
                    )}
                  </div>
                )}

                {comparison.structural.summary.totalChanges === 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono-cyber">
                    No structural changes
                  </div>
                )}

                {/* AI Analysis Button */}
                {comparison.structural.summary.totalChanges > 0 && onAnalyzeChanges && (
                  <button
                    onClick={() => onAnalyzeChanges(comparison.metadata.fromVersion, comparison.metadata.toVersion, comparison)}
                    disabled={isAnalyzing}
                    className={`mt-2 w-full py-1.5 rounded text-xs font-mono-cyber font-medium transition-all flex items-center justify-center gap-1.5 ${
                      isAnalyzing
                        ? 'bg-[rgba(var(--neon-purple-rgb),0.06)] text-[rgba(var(--neon-purple-rgb),0.5)] cursor-wait border border-[rgba(var(--neon-purple-rgb),0.1)]'
                        : 'bg-[rgba(var(--neon-purple-rgb),0.12)] text-[var(--neon-purple)] hover:bg-[rgba(var(--neon-purple-rgb),0.2)] border border-[rgba(var(--neon-purple-rgb),0.25)]'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Deep Analysis
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* AI Analysis Result */}
              {changeAnalysis && (
                <div className="mt-3 p-3 rounded bg-[rgba(var(--neon-purple-rgb),0.06)] border border-[rgba(var(--neon-purple-rgb),0.2)]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg className="w-3.5 h-3.5 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-xs font-mono-cyber font-medium text-[var(--neon-purple)]">AI Analysis</span>
                  </div>
                  <div className="text-[11px] text-[rgba(var(--neon-cyan-rgb),0.7)] font-mono-cyber whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {changeAnalysis}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Package Info Footer */}
      <div className="border-t border-[rgba(var(--neon-cyan-rgb),0.06)] px-3 py-2 text-[10px] text-muted-foreground font-mono-cyber">
        <div className="flex items-center justify-between">
          <span className="font-mono-cyber">{history.originalPackageId.slice(0, 10)}...</span>
          <span className="uppercase tracking-wider">{history.network}</span>
        </div>
      </div>
    </div>
  );
}
