import { create } from 'zustand';
import {
  fetchIntents,
  createIntent,
  dispatchIntent,
  fetchSessions,
  createSession,
  updateSession,
  fetchAgentProfiles,
  escalateTask,
  resolveEscalation,
  type IntentDTO,
  type CollaborationSessionDTO,
  type AgentProfileDTO,
} from '../../infrastructure/api/openclawCollaborationApiAdapter';
import { appEvents } from '../events/eventBus';

export interface EscalationEvent {
  id: string;
  taskId: string;
  taskName: string;
  stage: string;
  status: 'active' | 'resolved' | 'escalated';
  timestamp: number;
  reason?: string;
}

interface CollaborationState {
  intents: IntentDTO[];
  sessions: CollaborationSessionDTO[];
  agentProfiles: AgentProfileDTO[];
  escalationEvents: EscalationEvent[];
  loading: boolean;
  error: string | null;

  fetchIntents(): Promise<void>;
  registerIntent(intent: IntentDTO & { agentId: string }): Promise<void>;
  dispatch(
    intentType: string,
    payload: Record<string, unknown>,
    fromAgentId: string
  ): Promise<{ dispatched: boolean; targetAgentId?: string }>;

  fetchSessions(): Promise<void>;
  createSession(purpose: string, participantIds: string[]): Promise<CollaborationSessionDTO>;
  updateSessionStatus(id: string, status: CollaborationSessionDTO['status']): Promise<void>;

  fetchProfiles(): Promise<void>;
  escalate(taskId: string, reason: string): Promise<{ stage: string; action: string }>;
  resolveEscalation(taskId: string, resolution: string): Promise<void>;

  getActiveSessionCount(): number;

  subscribeSSE(): void;
  reset(): void;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  intents: [],
  sessions: [],
  agentProfiles: [],
  escalationEvents: [],
  loading: false,
  error: null,

  async fetchIntents() {
    set({ loading: true, error: null });
    try {
      const items = await fetchIntents();
      set({ intents: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async registerIntent(intent) {
    const created = await createIntent(intent);
    set({ intents: [...get().intents, created] });
  },

  async dispatch(intentType, payload, fromAgentId) {
    return dispatchIntent(intentType, payload, fromAgentId);
  },

  async fetchSessions() {
    set({ loading: true, error: null });
    try {
      const items = await fetchSessions();
      set({ sessions: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async createSession(purpose, participantIds) {
    const session = await createSession({ purpose, participantIds });
    set({ sessions: [...get().sessions, session] });
    return session;
  },

  async updateSessionStatus(id, status) {
    const updated = await updateSession(id, { status });
    set({
      sessions: get().sessions.map((s) => (s.id === id ? updated : s)),
    });
  },

  async fetchProfiles() {
    set({ loading: true, error: null });
    try {
      const items = await fetchAgentProfiles();
      set({ agentProfiles: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async escalate(taskId, reason) {
    return escalateTask(taskId, reason);
  },

  async resolveEscalation(taskId, resolution) {
    await resolveEscalation(taskId, resolution);
  },

  getActiveSessionCount() {
    return get().sessions.filter((s) => s.status === 'active').length;
  },

  subscribeSSE() {
    appEvents.on('intent:dispatched', (data) => {
      const d = data as unknown as Record<string, unknown>;
      if (d?.intentId) {
        get().fetchIntents();
      }
    });

    appEvents.on('session:created', (data) => {
      const dto = data as unknown as CollaborationSessionDTO;
      if (dto?.id) {
        const existing = get().sessions;
        if (!existing.some((s) => s.id === dto.id)) {
          set({ sessions: [...existing, dto] });
        }
      }
    });

    appEvents.on('session:escalated', (data) => {
      const d = data as unknown as { sessionId: string };
      if (d?.sessionId) {
        set({
          sessions: get().sessions.map((s) =>
            s.id === d.sessionId ? { ...s, status: 'escalated' as const } : s
          ),
        });
      }
    });

    appEvents.on('escalation:triggered', (data) => {
      const d = data as unknown as {
        taskId: string;
        stage: string;
        reason?: string;
        taskName?: string;
      };
      if (d?.taskId) {
        const event: EscalationEvent = {
          id: `esc-${Date.now()}`,
          taskId: d.taskId,
          taskName: d.taskName ?? d.taskId,
          stage: d.stage ?? 'retry',
          status: 'active',
          timestamp: Date.now(),
          reason: d.reason,
        };
        set({ escalationEvents: [...get().escalationEvents, event] });
      }
      get().fetchProfiles();
    });

    appEvents.on('escalation:resolved', (data) => {
      const d = data as unknown as { taskId: string; resolution?: string };
      if (d?.taskId) {
        set({
          escalationEvents: get().escalationEvents.map((e) =>
            e.taskId === d.taskId && e.status === 'active'
              ? { ...e, status: 'resolved' as const }
              : e
          ),
        });
      }
      get().fetchProfiles();
    });

    appEvents.on('agent-profile:updated', (data) => {
      const dto = data as unknown as AgentProfileDTO;
      if (dto?.agentId) {
        set({
          agentProfiles: get().agentProfiles.map((p) =>
            p.agentId === dto.agentId ? { ...p, ...dto } : p
          ),
        });
      }
    });
  },

  reset() {
    set({
      intents: [],
      sessions: [],
      agentProfiles: [],
      escalationEvents: [],
      loading: false,
      error: null,
    });
  },
}));
