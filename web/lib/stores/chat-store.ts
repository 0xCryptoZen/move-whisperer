/**
 * Zustand store for chat state management.
 * Ephemeral per session — not persisted to storage.
 */

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export type BackendMode = 'anthropic-api' | 'local-claude' | 'none';

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isStreaming: boolean;
  error: string | null;
  backendMode: BackendMode;
}

interface ChatActions {
  addMessage: (role: 'user' | 'assistant', content: string) => string;
  appendToLastAssistant: (delta: string) => void;
  finalizeLastAssistant: () => void;
  setStreaming: (streaming: boolean) => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setError: (error: string | null) => void;
  setBackendMode: (mode: BackendMode) => void;
  removeLastMessage: () => void;
  clearMessages: () => void;
  reset: () => void;
}

let messageCounter = 0;
function generateId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  // State
  messages: [],
  isOpen: false,
  isStreaming: false,
  error: null,
  backendMode: 'none',

  // Actions
  addMessage: (role, content) => {
    const id = generateId();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role,
          content,
          timestamp: Date.now(),
          isStreaming: role === 'assistant' && content === '',
        },
      ],
    }));
    return id;
  },

  appendToLastAssistant: (delta) => {
    set((state) => {
      const messages = [...state.messages];
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + delta,
          isStreaming: true,
        };
      }
      return { messages };
    });
  },

  finalizeLastAssistant: () => {
    set((state) => {
      const messages = [...state.messages];
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMsg,
          isStreaming: false,
        };
      }
      return { messages };
    });
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setOpen: (open) => set({ isOpen: open }),

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setError: (error) => set({ error }),

  setBackendMode: (mode) => set({ backendMode: mode }),

  removeLastMessage: () => {
    set((state) => ({
      messages: state.messages.slice(0, -1),
    }));
  },

  clearMessages: () => set({ messages: [], error: null }),

  reset: () =>
    set({
      messages: [],
      isOpen: false,
      isStreaming: false,
      error: null,
      backendMode: 'none',
    }),
}));
