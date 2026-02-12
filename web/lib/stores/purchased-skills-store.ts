/**
 * In-memory cache for purchased skill content.
 * After a user decrypts a paid skill on the detail page,
 * the content is cached here so it can be used in the playground.
 */

import { create } from 'zustand';

export interface CachedSkillContent {
  /** D1 database skill ID */
  skillId: string;
  /** On-chain SkillRecord object ID */
  onChainId: string;
  title: string;
  description: string;
  content: string;
  scene: string;
  network: string;
  packageId: string | null;
  cachedAt: number;
}

interface PurchasedSkillsState {
  cache: Record<string, CachedSkillContent>;
  cacheSkill: (skill: CachedSkillContent) => void;
  getCached: (skillId: string) => CachedSkillContent | undefined;
  getAll: () => CachedSkillContent[];
  clearCache: () => void;
}

export const usePurchasedSkillsStore = create<PurchasedSkillsState>((set, get) => ({
  cache: {},

  cacheSkill: (skill) =>
    set((state) => ({
      cache: { ...state.cache, [skill.skillId]: skill },
    })),

  getCached: (skillId) => get().cache[skillId],

  getAll: () => Object.values(get().cache),

  clearCache: () => set({ cache: {} }),
}));
