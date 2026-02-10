/**
 * React hook for detecting contract upgrades on page load.
 * Checks all monitored generation records against current on-chain versions.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useMonitorStore,
  type UpgradeCheckResult,
} from '../lib/stores/monitor-store';
import { getLocalServerClient } from '../lib/local-server';
import type { PackageVersionHistory } from '../lib/local-server';

export interface UseUpgradeMonitorOptions {
  /** Whether the local server is connected (required for checking) */
  isServerConnected: boolean;
  /** Minimum interval between checks in ms (default: 5 minutes) */
  minCheckIntervalMs?: number;
  /** Called when auto-analyze is enabled and upgrades are found */
  onAutoAnalyze?: (upgrades: UpgradeCheckResult[]) => void;
}

export interface UseUpgradeMonitorReturn {
  upgradedContracts: UpgradeCheckResult[];
  isChecking: boolean;
  error: string | null;
  checkNow: () => Promise<void>;
  dismissUpgrade: (recordId: string) => void;
  dismissAll: () => void;
  hasUpgrades: boolean;
}

const BATCH_SIZE = 3;
const DEFAULT_MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useUpgradeMonitor(
  options: UseUpgradeMonitorOptions
): UseUpgradeMonitorReturn {
  const {
    isServerConnected,
    minCheckIntervalMs = DEFAULT_MIN_CHECK_INTERVAL,
    onAutoAnalyze,
  } = options;

  const records = useMonitorStore((s) => s.records);
  const settings = useMonitorStore((s) => s.settings);
  const lastCheckedAt = useMonitorStore((s) => s.lastCheckedAt);
  const setLastCheckedAt = useMonitorStore((s) => s.setLastCheckedAt);
  const dismissUpgradeAction = useMonitorStore((s) => s.dismissUpgrade);

  const [upgradedContracts, setUpgradedContracts] = useState<UpgradeCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  const checkNow = useCallback(async () => {
    const recordList = Object.values(records);
    if (recordList.length === 0 || !isServerConnected) return;

    setIsChecking(true);
    setError(null);

    try {
      const client = getLocalServerClient();

      // Deduplicate by originalPackageId+network
      const uniqueKeys = new Map<
        string,
        { originalPackageId: string; network: 'mainnet' | 'testnet' | 'devnet' }
      >();
      for (const record of recordList) {
        const key = `${record.originalPackageId}:${record.network}`;
        if (!uniqueKeys.has(key)) {
          uniqueKeys.set(key, {
            originalPackageId: record.originalPackageId,
            network: record.network,
          });
        }
      }

      // Fetch version history in parallel batches
      const historyMap = new Map<string, PackageVersionHistory>();
      const entries = Array.from(uniqueKeys.entries());

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async ([key, { originalPackageId, network }]) => {
            const history = await client.getVersionHistory(originalPackageId, network);
            return { key, history };
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            historyMap.set(result.value.key, result.value.history);
          }
        }
      }

      // Compare each record against fetched history
      const results: UpgradeCheckResult[] = [];

      for (const record of recordList) {
        const key = `${record.originalPackageId}:${record.network}`;
        const history = historyMap.get(key);
        if (!history) continue;

        const currentVersion = history.currentVersion;
        const isUpgraded = currentVersion > record.versionAtGeneration;

        // Skip if user dismissed this version
        if (
          record.dismissedUpgradeVersion &&
          record.dismissedUpgradeVersion >= currentVersion
        ) {
          continue;
        }

        if (isUpgraded) {
          const latestVersionInfo = history.versions.find(
            (v) => v.version === currentVersion
          );
          results.push({
            record,
            currentVersion,
            isUpgraded: true,
            latestPackageId: latestVersionInfo?.packageId,
          });
        }
      }

      setUpgradedContracts(results);
      setLastCheckedAt(new Date().toISOString());

      // Auto-analyze callback
      if (results.length > 0 && settings.autoAnalyzeEnabled && onAutoAnalyze) {
        onAutoAnalyze(results);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check for upgrades'
      );
    } finally {
      setIsChecking(false);
    }
  }, [records, isServerConnected, setLastCheckedAt, settings.autoAnalyzeEnabled, onAutoAnalyze]);

  // Auto-check on mount (respecting settings and throttle)
  useEffect(() => {
    if (!settings.autoCheckEnabled || !isServerConnected || hasRun.current) return;

    const recordList = Object.values(records);
    if (recordList.length === 0) return;

    // Respect minimum check interval
    if (lastCheckedAt) {
      const elapsed = Date.now() - new Date(lastCheckedAt).getTime();
      if (elapsed < minCheckIntervalMs) return;
    }

    hasRun.current = true;
    checkNow();
  }, [settings.autoCheckEnabled, isServerConnected, records, checkNow, lastCheckedAt, minCheckIntervalMs]);

  const dismissUpgrade = useCallback(
    (recordId: string) => {
      const match = upgradedContracts.find((u) => u.record.id === recordId);
      if (match) {
        dismissUpgradeAction(recordId, match.currentVersion);
        setUpgradedContracts((prev) =>
          prev.filter((u) => u.record.id !== recordId)
        );
      }
    },
    [upgradedContracts, dismissUpgradeAction]
  );

  const dismissAll = useCallback(() => {
    for (const u of upgradedContracts) {
      dismissUpgradeAction(u.record.id, u.currentVersion);
    }
    setUpgradedContracts([]);
  }, [upgradedContracts, dismissUpgradeAction]);

  return {
    upgradedContracts,
    isChecking,
    error,
    checkNow,
    dismissUpgrade,
    dismissAll,
    hasUpgrades: upgradedContracts.length > 0,
  };
}
