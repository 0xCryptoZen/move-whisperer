/**
 * Zustand store for Playground chat state.
 * Separate from the generate page's chat store.
 */

import { create } from 'zustand';

export interface PlaygroundMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface SkillInfo {
  name: string;
  path: string;
  preview: string;
}

interface PlaygroundState {
  // Skill
  skills: SkillInfo[];
  selectedSkill: SkillInfo | null;
  skillContent: string | null;
  isLoadingSkills: boolean;

  // Chat
  messages: PlaygroundMessage[];
  isStreaming: boolean;
  error: string | null;
}

interface PlaygroundActions {
  // Skill actions
  setSkills: (skills: SkillInfo[]) => void;
  setSelectedSkill: (skill: SkillInfo | null) => void;
  setSkillContent: (content: string | null) => void;
  setLoadingSkills: (loading: boolean) => void;

  // Chat actions
  addMessage: (role: 'user' | 'assistant', content: string) => string;
  appendToLastAssistant: (delta: string) => void;
  finalizeLastAssistant: () => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  reset: () => void;
}

let counter = 0;
function generateId(): string {
  return `pg_${Date.now()}_${++counter}`;
}

export const usePlaygroundStore = create<PlaygroundState & PlaygroundActions>((set) => ({
  // State
  skills: [],
  selectedSkill: null,
  skillContent: null,
  isLoadingSkills: false,
  messages: [],
  isStreaming: false,
  error: null,

  // Skill actions
  setSkills: (skills) => set({ skills }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),
  setSkillContent: (content) => set({ skillContent: content }),
  setLoadingSkills: (loading) => set({ isLoadingSkills: loading }),

  // Chat actions
  addMessage: (role, content) => {
    const id = generateId();
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role, content, timestamp: Date.now(), isStreaming: role === 'assistant' && content === '' },
      ],
    }));
    return id;
  },

  appendToLastAssistant: (delta) => {
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        messages[messages.length - 1] = { ...last, content: last.content + delta, isStreaming: true };
      }
      return { messages };
    });
  },

  finalizeLastAssistant: () => {
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        messages[messages.length - 1] = { ...last, isStreaming: false };
      }
      return { messages };
    });
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], error: null }),
  reset: () =>
    set({
      skills: [],
      selectedSkill: null,
      skillContent: null,
      isLoadingSkills: false,
      messages: [],
      isStreaming: false,
      error: null,
    }),
}));
