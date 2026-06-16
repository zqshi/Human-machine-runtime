import { create } from 'zustand';
import { request } from '../../infrastructure/api/adminApiClient';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const LS_KEY = 'hmr_admin_assistant_history';

function loadMessages(): AssistantMessage[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistMessages(msgs: AssistantMessage[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(msgs.slice(-200)));
  } catch {
    /* quota exceeded */
  }
}

interface AdminAssistantState {
  open: boolean;
  messages: AssistantMessage[];
  loading: boolean;
  toggle(): void;
  send(content: string): Promise<void>;
  clearHistory(): void;
}

export const useAdminAssistantStore = create<AdminAssistantState>((set, get) => ({
  open: false,
  messages: loadMessages(),
  loading: false,

  toggle() {
    set((s) => ({ open: !s.open }));
  },

  async send(content: string) {
    const userMsg: AssistantMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((s) => {
      const msgs = [...s.messages, userMsg];
      persistMessages(msgs);
      return { messages: msgs, loading: true };
    });

    const history = get()
      .messages.slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await request<{ reply: string }>('/api/admin/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: history }),
      });

      const assistantMsg: AssistantMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: res.reply,
        timestamp: Date.now(),
      };

      set((s) => {
        const msgs = [...s.messages, assistantMsg];
        persistMessages(msgs);
        return { messages: msgs, loading: false };
      });
    } catch {
      const errorMsg: AssistantMessage = {
        id: `msg-${Date.now()}-e`,
        role: 'assistant',
        content: '抱歉，请求失败，请稍后重试。',
        timestamp: Date.now(),
      };

      set((s) => {
        const msgs = [...s.messages, errorMsg];
        persistMessages(msgs);
        return { messages: msgs, loading: false };
      });
    }
  },

  clearHistory() {
    localStorage.removeItem(LS_KEY);
    set({ messages: [] });
  },
}));
