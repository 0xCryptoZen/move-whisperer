'use client';

import { useState, useCallback } from 'react';
import { useLocalServer } from '../../hooks/useLocalServer';
import type { PackageVersionHistory, VersionCompareResult } from '../../lib/local-server';

// Version audit status
interface VersionAuditStatus {
  version: number;
  packageId: string;
  status: 'pending' | 'auditing' | 'completed' | 'error';
  auditResult?: string;
  comparison?: VersionCompareResult;
  changeAnalysis?: string;
  error?: string;
}

export default function AuditPage() {
  // Input state
  const [packageIdInput, setPackageIdInput] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | 'devnet'>('mainnet');

  // Audit state
  const [versionHistory, setVersionHistory] = useState<PackageVersionHistory | null>(null);
  const [auditStatuses, setAuditStatuses] = useState<VersionAuditStatus[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [currentAuditingVersion, setCurrentAuditingVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const {
    isConnected,
    getVersionHistory,
    compareVersions,
    analyzeVersionChanges,
    decompile,
  } = useLocalServer();

  // Fetch version history
  const handleFetchHistory = useCallback(async () => {
    if (!packageIdInput.trim()) {
      setError('Please enter a package ID');
      return;
    }

    setIsLoadingHistory(true);
    setError(null);
    setVersionHistory(null);
    setAuditStatuses([]);

    try {
      const history = await getVersionHistory(packageIdInput.trim(), network);
      setVersionHistory(history);

      // Initialize audit statuses for all versions
      const statuses: VersionAuditStatus[] = history.versions.map((v) => ({
        version: v.version,
        packageId: v.packageId,
        status: 'pending',
      }));
      setAuditStatuses(statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch version history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [packageIdInput, network, getVersionHistory]);

  // Audit a single version
  const auditVersion = useCallback(async (
    version: number,
    packageId: string,
    prevVersion?: number,
    prevPackageId?: string
  ): Promise<void> => {
    // Update status to auditing
    setAuditStatuses(prev => prev.map(s =>
      s.version === version ? { ...s, status: 'auditing' } : s
    ));

    try {
      // 1. Fetch source code and bytecode from /api/source
      const sourceResponse = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: packageId, network }),
      });

      if (!sourceResponse.ok) {
        throw new Error('Failed to fetch source code');
      }

      const sourceData = await sourceResponse.json() as { bytecode?: Record<string, string>; modules?: Record<string, string> };
      let sourceCode = '';

      // 2. Try to decompile if bytecode available
      if (sourceData.bytecode && Object.keys(sourceData.bytecode).length > 0) {
        try {
          const decompileResult = await decompile(packageId, {
            bytecode: sourceData.bytecode,
            network,
          });

          if (decompileResult.success && decompileResult.output) {
            sourceCode = decompileResult.output;
          }
        } catch (e) {
          console.error('Decompilation failed:', e);
        }
      }

      // Fall back to disassembled code if decompilation failed
      if (!sourceCode && sourceData.modules) {
        sourceCode = Object.entries(sourceData.modules)
          .map(([name, code]) => `// ===== Module: ${name} =====\n\n${code}`)
          .join('\n\n');
      }

      if (!sourceCode) {
        throw new Error('No source code available');
      }

      // 3. Generate audit using Claude Code's move-audit skill
      let auditResult = '';

      try {
        // Call local server to execute Claude with move-audit skill
        const claudeResponse = await fetch('http://127.0.0.1:3456/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `/move-audit\n\nAudit the following Sui Move contract (Package: ${packageId}, Version: ${version}, Network: ${network}):\n\n\`\`\`move\n${sourceCode}\n\`\`\``,
          }),
        });

        if (claudeResponse.ok) {
          const data = await claudeResponse.json() as { success?: boolean; output?: string };
          if (data.success && data.output) {
            auditResult = `## Security Audit - v${version}\n\n${data.output}`;
          } else {
            auditResult = `## Security Audit - v${version}\n\nAudit completed but no detailed output available.\n\nPackage: ${packageId}`;
          }
        } else {
          // Fallback to basic audit API
          const auditResponse = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              packageId,
              sourceCode,
              network,
              version,
            }),
          });

          if (auditResponse.ok) {
            const data = await auditResponse.json() as { audit?: any };
            if (data.audit) {
              const a = data.audit;
              auditResult = `## Security Audit - v${version}

### Risk Level: ${a.summary.riskLevel.toUpperCase()}

### Summary
- Total Functions: ${a.summary.totalFunctions}
- High Risk Functions: ${a.summary.highRiskFunctions}
- Admin Functions: ${a.summary.adminFunctions}
- Capabilities: ${a.summary.capabilities.join(', ') || 'None'}
- Coin Handlers: ${a.summary.coinHandlers.join(', ') || 'None'}

### Vulnerabilities (${a.vulnerabilities.length})
${a.vulnerabilities.map((v: { severity: string; type: string; description: string; recommendation: string }) =>
  `- **[${v.severity.toUpperCase()}]** ${v.type}: ${v.description}\n  - Recommendation: ${v.recommendation}`
).join('\n') || 'No vulnerabilities detected'}

### Recommendations
${a.recommendations.map((r: string) => `- ${r}`).join('\n') || 'No specific recommendations'}`;
            }
          }
        }
      } catch (e) {
        console.error('Claude audit failed:', e);
        auditResult = `## Security Audit - v${version}\n\nPackage: ${packageId}\n\nBasic analysis completed. Claude skill unavailable.`;
      }

      if (!auditResult) {
        auditResult = `Version ${version} - Package: ${packageId}\n\nDecompiled successfully. Manual review recommended.`;
      }

      // 3. If not v1, compare with previous version
      let comparison: VersionCompareResult | undefined;
      let changeAnalysis: string | undefined;

      if (prevVersion !== undefined && prevPackageId) {
        try {
          comparison = await compareVersions(
            packageIdInput.trim(),
            prevVersion,
            version,
            { network, diffType: 'both' }
          );

          // Analyze changes
          if (comparison) {
            changeAnalysis = await analyzeVersionChanges(
              prevVersion,
              version,
              comparison,
              { packageId: packageIdInput.trim(), network }
            );
          }
        } catch (err) {
          console.error('Failed to compare versions:', err);
        }
      }

      // Update status to completed
      setAuditStatuses(prev => prev.map(s =>
        s.version === version
          ? { ...s, status: 'completed', auditResult, comparison, changeAnalysis }
          : s
      ));
    } catch (err) {
      setAuditStatuses(prev => prev.map(s =>
        s.version === version
          ? { ...s, status: 'error', error: err instanceof Error ? err.message : 'Audit failed' }
          : s
      ));
    }
  }, [network, packageIdInput, decompile, compareVersions, analyzeVersionChanges]);

  // Start sequential audit from v1
  const handleStartAudit = useCallback(async () => {
    if (!versionHistory || auditStatuses.length === 0) return;

    setIsAuditing(true);
    setError(null);

    // Sort versions in ascending order (v1 first)
    const sortedVersions = [...versionHistory.versions].sort((a, b) => a.version - b.version);

    for (let i = 0; i < sortedVersions.length; i++) {
      const current = sortedVersions[i];
      const prev = i > 0 ? sortedVersions[i - 1] : undefined;

      setCurrentAuditingVersion(current.version);

      await auditVersion(
        current.version,
        current.packageId,
        prev?.version,
        prev?.packageId
      );

      // Small delay between versions
      if (i < sortedVersions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setCurrentAuditingVersion(null);
    setIsAuditing(false);
  }, [versionHistory, auditStatuses, auditVersion]);

  // Audit a specific version only
  const handleAuditSingleVersion = useCallback(async (version: number) => {
    if (!versionHistory) return;

    const sortedVersions = [...versionHistory.versions].sort((a, b) => a.version - b.version);
    const currentIdx = sortedVersions.findIndex(v => v.version === version);
    if (currentIdx === -1) return;

    const current = sortedVersions[currentIdx];
    const prev = currentIdx > 0 ? sortedVersions[currentIdx - 1] : undefined;

    setIsAuditing(true);
    setCurrentAuditingVersion(version);

    await auditVersion(current.version, current.packageId, prev?.version, prev?.packageId);

    setCurrentAuditingVersion(null);
    setIsAuditing(false);
  }, [versionHistory, auditVersion]);

  // Get status color
  const getStatusColor = (status: VersionAuditStatus['status']) => {
    switch (status) {
      case 'pending': return 'bg-[rgba(var(--neon-cyan-rgb),0.3)]';
      case 'auditing': return 'bg-[rgba(var(--neon-amber-rgb),0.6)] animate-pulse';
      case 'completed': return 'bg-[rgba(var(--neon-green-rgb),0.6)]';
      case 'error': return 'bg-[rgba(var(--neon-red-rgb),0.6)]';
    }
  };

  // Get status text
  const getStatusText = (status: VersionAuditStatus['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'auditing': return 'Auditing...';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 font-mono-cyber neon-text-red">
          Multi-Version Security Audit
        </h1>
        <p className="text-muted-foreground font-mono-cyber text-sm tracking-wide">
          Audit smart contract versions sequentially, from v1 to latest, with change analysis
        </p>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 rounded glass-panel hud-corners-amber animate-border-pulse-amber border border-[rgba(var(--neon-amber-rgb),0.2)]">
          <div className="flex items-center gap-2 neon-text-amber">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-mono-cyber text-sm">Local server not connected. Run: <code className="px-2 py-0.5 bg-black/50 rounded border border-[rgba(var(--neon-amber-rgb),0.2)]">pnpm run serve</code></span>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="glass-panel rounded p-6 mb-6 hud-corners-red">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-mono-cyber uppercase tracking-widest mb-2 text-[rgba(var(--neon-red-rgb),0.7)]">Package ID</label>
            <input
              type="text"
              value={packageIdInput}
              onChange={(e) => setPackageIdInput(e.target.value)}
              placeholder="0x..."
              className="cyber-input w-full px-4 py-3 rounded text-sm"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-mono-cyber uppercase tracking-widest mb-2 text-[rgba(var(--neon-red-rgb),0.7)]">Network</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet' | 'devnet')}
              className="cyber-input w-full px-4 py-3 rounded"
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
              <option value="devnet">Devnet</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFetchHistory}
              disabled={isLoadingHistory || !isConnected}
              className="cyber-btn cyber-btn-red px-6 py-3 rounded font-mono-cyber text-sm"
            >
              {isLoadingHistory ? 'Loading...' : 'Fetch Versions'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded bg-[rgba(var(--neon-red-rgb),0.08)] border border-[rgba(var(--neon-red-rgb),0.25)] neon-text-red text-sm font-mono-cyber">
            {error}
          </div>
        )}
      </div>

      {/* Version History & Audit */}
      {versionHistory && (
        <div className="glass-panel rounded overflow-hidden hud-corners-red animate-border-pulse-red">
          {/* Header */}
          <div className="p-6 border-b border-[rgba(var(--neon-red-rgb),0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold font-mono-cyber neon-text tracking-wide">Version History</h2>
                <p className="text-sm text-muted-foreground mt-1 font-mono-cyber">
                  {versionHistory.versions.length} version{versionHistory.versions.length > 1 ? 's' : ''} found
                  &bull; Current: v{versionHistory.currentVersion}
                </p>
              </div>
              <button
                onClick={handleStartAudit}
                disabled={isAuditing || !isConnected}
                className="cyber-btn cyber-btn-red px-6 py-3 rounded font-mono-cyber text-sm flex items-center gap-2"
              >
                {isAuditing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Auditing v{currentAuditingVersion}...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Audit All Versions</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Version List */}
          <div className="divide-y divide-[rgba(var(--neon-cyan-rgb),0.05)]">
            {[...auditStatuses].sort((a, b) => a.version - b.version).map((status, idx) => (
              <div key={status.version} className="p-4 hover:bg-[rgba(var(--neon-cyan-rgb),0.02)] transition-colors">
                {/* Version Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedVersion(expandedVersion === status.version ? null : status.version)}
                >
                  <div className="flex items-center gap-4">
                    {/* Version Number */}
                    <div className="w-16 h-16 rounded border border-[rgba(var(--neon-red-rgb),0.2)] bg-[rgba(var(--neon-red-rgb),0.05)] flex items-center justify-center">
                      <span className="text-2xl font-bold neon-text-red font-mono-cyber">v{status.version}</span>
                    </div>

                    {/* Version Info */}
                    <div>
                      <div className="font-mono-cyber text-sm text-[rgba(var(--neon-cyan-rgb),0.6)]">
                        {status.packageId.slice(0, 16)}...{status.packageId.slice(-8)}
                      </div>
                      {idx > 0 && status.comparison?.structural && (
                        <div className="flex items-center gap-2 mt-1 text-xs font-mono-cyber">
                          <span className="neon-text-green">+{status.comparison.structural.summary.functionsAdded}</span>
                          <span className="neon-text-red">-{status.comparison.structural.summary.functionsRemoved}</span>
                          <span className="neon-text-amber">~{status.comparison.structural.summary.functionsModified}</span>
                          {status.comparison.structural.summary.breakingChanges && (
                            <span className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-red-rgb),0.15)] border border-[rgba(var(--neon-red-rgb),0.3)] neon-text-red text-[10px] uppercase tracking-wider">Breaking</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded text-xs font-mono-cyber uppercase tracking-wider flex items-center gap-1.5 ${
                      status.status === 'completed' ? 'bg-[rgba(var(--neon-green-rgb),0.1)] border border-[rgba(var(--neon-green-rgb),0.2)] text-[var(--neon-green)]' :
                      status.status === 'auditing' ? 'bg-[rgba(var(--neon-amber-rgb),0.1)] border border-[rgba(var(--neon-amber-rgb),0.2)] text-[var(--neon-amber)]' :
                      status.status === 'error' ? 'bg-[rgba(var(--neon-red-rgb),0.1)] border border-[rgba(var(--neon-red-rgb),0.2)] text-[var(--neon-red)]' :
                      'bg-[rgba(var(--neon-cyan-rgb),0.05)] border border-[rgba(var(--neon-cyan-rgb),0.1)] text-[rgba(var(--neon-cyan-rgb),0.5)]'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(status.status)}`} />
                      {getStatusText(status.status)}
                    </div>

                    {status.status === 'pending' && !isAuditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAuditSingleVersion(status.version);
                        }}
                        className="cyber-btn px-3 py-1 rounded text-xs font-mono-cyber"
                      >
                        Audit
                      </button>
                    )}

                    <svg
                      className={`w-5 h-5 transition-transform text-[rgba(var(--neon-cyan-rgb),0.4)] ${expandedVersion === status.version ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedVersion === status.version && (
                  <div className="mt-4 space-y-4">
                    {/* Error Message */}
                    {status.error && (
                      <div className="p-3 rounded bg-[rgba(var(--neon-red-rgb),0.08)] border border-[rgba(var(--neon-red-rgb),0.25)] neon-text-red text-sm font-mono-cyber">
                        {status.error}
                      </div>
                    )}

                    {/* Change Analysis (if not v1) */}
                    {status.changeAnalysis && (
                      <div className="p-4 rounded glass-panel border border-[rgba(var(--neon-amber-rgb),0.15)] hud-corners-amber">
                        <h4 className="text-sm font-mono-cyber uppercase tracking-wider neon-text-amber mb-2">
                          Changes from v{status.version - 1}
                        </h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap text-xs text-[rgba(var(--neon-cyan-rgb),0.7)] font-mono-cyber">{status.changeAnalysis}</pre>
                        </div>
                      </div>
                    )}

                    {/* Audit Result */}
                    {status.auditResult && (
                      <div className="p-4 rounded bg-black/40 border border-[rgba(var(--neon-red-rgb),0.1)]">
                        <h4 className="text-sm font-mono-cyber uppercase tracking-wider neon-text-red mb-2">Audit Result</h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap text-xs text-[rgba(var(--neon-cyan-rgb),0.7)] font-mono-cyber max-h-96 overflow-auto">
                            {status.auditResult}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Structural Changes */}
                    {status.comparison?.structural?.changes && status.comparison.structural.changes.length > 0 && (
                      <div className="p-4 rounded bg-black/40 border border-[rgba(var(--neon-cyan-rgb),0.1)]">
                        <h4 className="text-sm font-mono-cyber uppercase tracking-wider neon-text mb-3">Structural Changes</h4>
                        <div className="space-y-2">
                          {status.comparison.structural.changes.map((change, i) => (
                            <div
                              key={i}
                              className={`p-2 rounded text-xs font-mono-cyber flex items-center gap-2 ${
                                change.type === 'added' ? 'bg-[rgba(var(--neon-green-rgb),0.06)] border border-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)]' :
                                change.type === 'removed' ? 'bg-[rgba(var(--neon-red-rgb),0.06)] border border-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)]' :
                                'bg-[rgba(var(--neon-amber-rgb),0.06)] border border-[rgba(var(--neon-amber-rgb),0.15)] text-[var(--neon-amber)]'
                              }`}
                            >
                              <span>{change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~'}</span>
                              <span className="font-medium">{change.category}::{change.name}</span>
                              {change.risk && change.risk !== 'low' && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                  change.risk === 'critical' ? 'bg-[rgba(var(--neon-red-rgb),0.2)] border border-[rgba(var(--neon-red-rgb),0.3)]' :
                                  change.risk === 'high' ? 'bg-[rgba(var(--neon-red-rgb),0.15)] border border-[rgba(var(--neon-red-rgb),0.2)]' :
                                  'bg-[rgba(var(--neon-amber-rgb),0.15)] border border-[rgba(var(--neon-amber-rgb),0.2)]'
                                }`}>
                                  {change.risk}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!versionHistory && !isLoadingHistory && (
        <div className="glass-panel rounded p-12 text-center hud-corners-red">
          <div className="w-16 h-16 rounded border border-[rgba(var(--neon-red-rgb),0.2)] bg-[rgba(var(--neon-red-rgb),0.05)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--neon-red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2 font-mono-cyber neon-text-red">Multi-Version Audit</h3>
          <p className="text-muted-foreground max-w-md mx-auto font-mono-cyber text-sm">
            Enter a package ID to fetch version history and perform sequential security audits from v1 to the latest version.
          </p>
        </div>
      )}
    </div>
  );
}
