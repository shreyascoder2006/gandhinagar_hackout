import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ChatMessage = { role: "assistant" | "user"; text: string; verifiedData?: Record<string, unknown> | null; source?: string };

const WELCOME: ChatMessage = {
  role: "assistant",
  text: "Ask me anything about these 120 factories — “which factory needs the most help”, “what's wrong with this one”, or “best strategy under a 10 lakh budget”. I call the real database and optimizer for every answer, not a script.",
};

interface ChatState {
  messages: ChatMessage[];
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  clearMessages: () => void;
}

// Persisted to localStorage so a page refresh mid-demo doesn't lose the
// conversation — plain JSON-serializable messages, no custom merge needed
// (unlike useFactoryStore's Set field).
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [WELCOME],
      setMessages: (updater) => set((state) => ({
        messages: typeof updater === "function" ? updater(state.messages) : updater,
      })),
      clearMessages: () => set({ messages: [WELCOME] }),
    }),
    {
      name: "induscope-chat-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
