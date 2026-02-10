/**
 * Zustand store for contract monitoring and upgrade detection.
 * Persisted to localStorage via zustand/middleware.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Network = 'mainnet' | 'testnet' | 'devnet';
type SkillScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs' | 'custom';

/** A record of a generated skill, keyed by composite ID */
export interface GenerationRecord {
  /** Unique ID: `${originalPackageId}:${network}:${scene}` */
  id: string;
  /** Original package ID (v1, used for UpgradeCap tracing) */
  originalPackageId: string;
  /** The specific packageId used at generation time */
  versionPackageId: string;
  /** Module name that was generated */
  moduleName: string;
  /** Network the contract lives on */
  network: Network;
  /** Scene mode used for generation */
  scene: SkillScene;
  /** Version number at generation time */
  versionAtGeneration: number;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** If set, upgrade notifications are suppressed up to this version */
  dismissedUpgradeVersion?: number;
}

/** Result of checking a single record for upgrades */
export interface UpgradeCheckResult {
  record: GenerationRecord;
  currentVersion: number;
  isUpgraded: boolean;
  latestPackageId?: string;
}

/** User preferences for monitoring behavior */
export interface MonitorSettings {
  /** Whether to auto-check on page load (default: true) */
  autoCheckEnabled: boolean;
  /** Whether to automatically run diff analysis (default: false) */
  autoAnalyzeEnabled: boolean;
}

interface MonitorState {
  records: Record<string, GenerationRecord>;
  settings: MonitorSettings;
  lastCheckedAt: string | null;
}

interface MonitorActions {
  addRecord: (record: Omit<GenerationRecord, 'id'>) => void;
  removeRecord: (id: string) => void;
  updateRecordVersion: (id: string, newVersion: number, newPackageId: string) => void;
  dismissUpgrade: (id: string, version: number) => void;
  updateSettings: (partial: Partial<MonitorSettings>) => void;
  setLastCheckedAt: (timestamp: string) => void;
  clearAllRecords: () => void;
}

export const useMonitorStore = create<MonitorState & MonitorActions>()(
  persist(
    (set) => ({
      records: {},
      settings: {
        autoCheckEnabled: true,
        autoAnalyzeEnabled: false,
      },
      lastCheckedAt: null,

      addRecord: (recordData) => {
        const id = `${recordData.originalPackageId}:${recordData.network}:${recordData.scene}`;
        set((state) => ({
          records: {
            ...state.records,
            [id]: { ...recordData, id },
          },
        }));
      },

      removeRecord: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.records;
          return { records: rest };
        });
      },

      updateRecordVersion: (id, newVersion, newPackageId) => {
        set((state) => {
          const existing = state.records[id];
          if (!existing) return state;
          return {
            records: {
              ...state.records,
              [id]: {
                ...existing,
                versionAtGeneration: newVersion,
                versionPackageId: newPackageId,
                generatedAt: new Date().toISOString(),
                dismissedUpgradeVersion: undefined,
              },
            },
          };
        });
      },

      dismissUpgrade: (id, version) => {
        set((state) => {
          const existing = state.records[id];
          if (!existing) return state;
          return {
            records: {
              ...state.records,
              [id]: { ...existing, dismissedUpgradeVersion: version },
            },
          };
        });
      },

      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial },
        }));
      },

      setLastCheckedAt: (timestamp) => set({ lastCheckedAt: timestamp }),

      clearAllRecords: () => set({ records: {}, lastCheckedAt: null }),
    }),
    {
      name: 'movewhisperer-monitor',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
