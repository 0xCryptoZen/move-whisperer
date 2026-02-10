'use client';

import { useMonitorStore, type UpgradeCheckResult } from '../../../lib/stores/monitor-store';

interface UpgradeNotificationModalProps {
  upgradedContracts: UpgradeCheckResult[];
  onRunDiffAnalysis: (result: UpgradeCheckResult) => void;
  onDismiss: (recordId: string) => void;
  onDismissAll: () => void;
  onClose: () => void;
}

const SCENE_LABELS: Record<string, string> = {
  sdk: 'SDK',
  learn: 'Learn',
  audit: 'Audit',
  frontend: 'Frontend',
  bot: 'Bot',
  docs: 'Docs',
  custom: 'Custom',
};

function truncateId(id: string, chars = 8): string {
  if (id.length <= chars + 4) return id;
  return `${id.slice(0, chars)}...${id.slice(-4)}`;
}

export default function UpgradeNotificationModal({
  upgradedContracts,
  onRunDiffAnalysis,
  onDismiss,
  onDismissAll,
  onClose,
}: UpgradeNotificationModalProps) {
  const settings = useMonitorStore((s) => s.settings);
  const updateSettings = useMonitorStore((s) => s.updateSettings);

  if (upgradedContracts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl glass-panel rounded hud-corners overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[rgba(var(--neon-amber-rgb),0.15)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded border border-[rgba(var(--neon-amber-rgb),0.4)] bg-[rgba(var(--neon-amber-rgb),0.1)] flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-[var(--neon-amber)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold font-mono-cyber neon-text-amber">
                Contract Upgrades Detected
              </h2>
              <p className="text-sm text-muted-foreground font-mono-cyber">
                {upgradedContracts.length} contract{upgradedContracts.length > 1 ? 's' : ''} upgraded since last generation
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contract list */}
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
          {upgradedContracts.map((item) => (
            <div
              key={item.record.id}
              className="p-4 rounded border border-[rgba(var(--neon-amber-rgb),0.12)] bg-[rgba(var(--neon-amber-rgb),0.03)] hover:bg-[rgba(var(--neon-amber-rgb),0.06)] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm font-mono-cyber text-[var(--neon-cyan)] truncate">
                      {truncateId(item.record.originalPackageId, 12)}
                    </code>
                    {item.record.moduleName && (
                      <>
                        <span className="text-muted-foreground">::</span>
                        <span className="text-sm font-mono-cyber">
                          {item.record.moduleName}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Version change badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono-cyber bg-[rgba(var(--neon-amber-rgb),0.15)] text-[var(--neon-amber)] border border-[rgba(var(--neon-amber-rgb),0.25)]">
                      v{item.record.versionAtGeneration}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      v{item.currentVersion}
                    </span>
                    {/* Scene badge */}
                    <span className="px-2 py-0.5 rounded text-xs font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.08)] text-[rgba(var(--neon-cyan-rgb),0.7)]">
                      {SCENE_LABELS[item.record.scene] || item.record.scene}
                    </span>
                    {/* Network badge */}
                    <span className="px-2 py-0.5 rounded text-xs font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.05)] text-muted-foreground uppercase">
                      {item.record.network}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => onRunDiffAnalysis(item)}
                    className="cyber-btn px-3 py-1.5 rounded text-xs font-mono-cyber"
                    style={{
                      borderColor: 'rgba(var(--neon-cyan-rgb), 0.4)',
                      color: 'var(--neon-cyan)',
                    }}
                  >
                    Run Diff
                  </button>
                  <button
                    onClick={() => onDismiss(item.record.id)}
                    className="px-3 py-1.5 rounded text-xs font-mono-cyber text-muted-foreground hover:text-foreground border border-[rgba(var(--neon-cyan-rgb),0.08)] hover:border-[rgba(var(--neon-cyan-rgb),0.2)] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(var(--neon-cyan-rgb),0.08)]">
          <div className="flex items-center justify-between">
            {/* Auto-analyze toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  updateSettings({
                    autoAnalyzeEnabled: !settings.autoAnalyzeEnabled,
                  })
                }
                className={`relative w-10 h-5 rounded-full transition-all ${
                  settings.autoAnalyzeEnabled
                    ? 'bg-[var(--neon-green)] shadow-[0_0_8px_rgba(var(--neon-green-rgb),0.4)]'
                    : 'bg-[rgba(var(--neon-cyan-rgb),0.15)]'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    settings.autoAnalyzeEnabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="text-xs text-muted-foreground font-mono-cyber">
                Auto-analyze future upgrades
              </span>
            </div>

            <button
              onClick={onDismissAll}
              className="px-4 py-2 rounded text-sm font-mono-cyber text-muted-foreground hover:text-foreground border border-[rgba(var(--neon-cyan-rgb),0.1)] hover:border-[rgba(var(--neon-cyan-rgb),0.25)] transition-colors"
            >
              Dismiss All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
