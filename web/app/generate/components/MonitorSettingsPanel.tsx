'use client';

import { useState } from 'react';
import { useMonitorStore } from '../../../lib/stores/monitor-store';

interface MonitorSettingsPanelProps {
  isChecking: boolean;
  onCheckNow: () => Promise<void>;
  isServerConnected: boolean;
}

function truncateId(id: string, chars = 10): string {
  if (id.length <= chars + 4) return id;
  return `${id.slice(0, chars)}...${id.slice(-4)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

const SCENE_LABELS: Record<string, string> = {
  sdk: 'SDK', learn: 'Learn', audit: 'Audit',
  frontend: 'Frontend', bot: 'Bot', docs: 'Docs', custom: 'Custom',
};

export default function MonitorSettingsPanel({
  isChecking,
  onCheckNow,
  isServerConnected,
}: MonitorSettingsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const records = useMonitorStore((s) => s.records);
  const settings = useMonitorStore((s) => s.settings);
  const lastCheckedAt = useMonitorStore((s) => s.lastCheckedAt);
  const updateSettings = useMonitorStore((s) => s.updateSettings);
  const removeRecord = useMonitorStore((s) => s.removeRecord);
  const clearAllRecords = useMonitorStore((s) => s.clearAllRecords);

  const recordList = Object.values(records);
  const recordCount = recordList.length;

  if (recordCount === 0) return null;

  return (
    <div className="glass-panel rounded mb-8 hud-corners overflow-hidden">
      {/* Collapsed header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-[rgba(var(--neon-cyan-rgb),0.02)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)] flex items-center justify-center">
            <svg
              className="w-5 h-5 text-[var(--neon-purple)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <div>
            <span className="text-sm font-mono-cyber font-semibold">Contract Monitor</span>
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-mono-cyber bg-[rgba(var(--neon-purple-rgb),0.2)] text-[var(--neon-purple)] border border-[rgba(var(--neon-purple-rgb),0.3)]">
              {recordCount}
            </span>
          </div>
          {lastCheckedAt && (
            <span className="text-xs text-muted-foreground font-mono-cyber ml-2">
              Checked {formatTime(lastCheckedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isServerConnected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCheckNow();
              }}
              disabled={isChecking}
              className="cyber-btn px-3 py-1.5 rounded text-xs font-mono-cyber disabled:opacity-50 flex items-center gap-1.5"
            >
              {isChecking ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Check Now
            </button>
          )}
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[rgba(var(--neon-cyan-rgb),0.08)]">
          {/* Settings toggles */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-mono-cyber">Auto-check on page load</span>
                <p className="text-xs text-muted-foreground font-mono-cyber mt-0.5">
                  Check for contract upgrades when you visit this page
                </p>
              </div>
              <button
                onClick={() => updateSettings({ autoCheckEnabled: !settings.autoCheckEnabled })}
                className={`relative w-10 h-5 rounded-full transition-all ${
                  settings.autoCheckEnabled
                    ? 'bg-[var(--neon-green)] shadow-[0_0_8px_rgba(var(--neon-green-rgb),0.4)]'
                    : 'bg-[rgba(var(--neon-cyan-rgb),0.15)]'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings.autoCheckEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-mono-cyber">Auto-analyze upgrades</span>
                <p className="text-xs text-muted-foreground font-mono-cyber mt-0.5">
                  Automatically run diff analysis when upgrades are detected
                </p>
              </div>
              <button
                onClick={() => updateSettings({ autoAnalyzeEnabled: !settings.autoAnalyzeEnabled })}
                className={`relative w-10 h-5 rounded-full transition-all ${
                  settings.autoAnalyzeEnabled
                    ? 'bg-[var(--neon-green)] shadow-[0_0_8px_rgba(var(--neon-green-rgb),0.4)]'
                    : 'bg-[rgba(var(--neon-cyan-rgb),0.15)]'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings.autoAnalyzeEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Records list */}
          <div className="border-t border-[rgba(var(--neon-cyan-rgb),0.08)]">
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-mono-cyber uppercase tracking-wider">
                  Monitored Contracts
                </span>
                <button
                  onClick={clearAllRecords}
                  className="text-xs text-muted-foreground hover:text-[var(--neon-red)] font-mono-cyber transition-colors"
                >
                  Clear All
                </button>
              </div>

              {recordList.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-2 px-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.02)] hover:bg-[rgba(var(--neon-cyan-rgb),0.05)] transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-xs font-mono-cyber text-[var(--neon-cyan)] truncate">
                      {truncateId(record.originalPackageId)}
                    </code>
                    {record.moduleName && (
                      <span className="text-xs text-muted-foreground font-mono-cyber truncate">
                        ::{record.moduleName}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.08)] text-muted-foreground">
                      {SCENE_LABELS[record.scene] || record.scene}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.05)] text-muted-foreground uppercase">
                      {record.network}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono-cyber">
                      v{record.versionAtGeneration}
                    </span>
                  </div>
                  <button
                    onClick={() => removeRecord(record.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-[var(--neon-red)] transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
