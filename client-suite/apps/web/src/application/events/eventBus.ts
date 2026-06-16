/**
 * Lightweight typed event bus for cross-store coordination.
 *
 * Internally delegates to SignalBus for signal classification,
 * noise filtering, and aggregation. Public API unchanged.
 */

import { SignalBus, type SignalLevel } from '../../domain/sensing/SignalBus';

export interface AppEvents {
  'approval:resolved': {
    documentId: string;
    documentName: string;
    approved: boolean;
    reason?: string;
  };
  'navigate:chat': { roomId: string };
  'navigate:knowledge': { subView: string; documentId?: string };
  'im:reply-sent': { roomId: string; message: string };
  'im:cross-channel-reply': { channel: string; sender: string; message: string };
  'agent:task-updated': { taskId: string; progress: number; status: string };
  'decision:created': { decisionId: string; agentId: string; urgency: string };
  'decision:responded': { decisionId: string; response: string };
  'decision:correction-propagated': {
    decisionId: string;
    affectedTasks: number;
    affectedGoals: number;
  };
  'judgment:recorded': { recordId: string; decisionId: string; action: string };
  'inbox:message-received': { notificationId: string; channel: string };
  'inbox:reply-sent': { notificationId: string; channel: string; body: string };
  'signal:created': { id: string; source: string; urgency: string; payload: unknown };
  'correction:applied': { planId: string; affectedTasks: string[]; affectedGoals: string[] };
  'intent:dispatched': { intentId: string; fromAgent: string; toAgent: string; payload: unknown };
  'session:created': { sessionId: string; agents: string[]; purpose: string };
  'session:escalated': { sessionId: string; reason: string; confidence: number };
  'escalation:triggered': { taskId: string; stage: string; reason: string };
  'escalation:resolved': { taskId: string; resolution: string };
  'agent-profile:updated': { agentId: string; metric: string; newValue: number };
  'objective:updated': { objectiveId: string; level: string; confidence: number };
  'objective:decoded': { l0Id: string; questions: string[] };
  'emergent-signal:detected': { patternId: string; severity: string; correlatedSignals: string[] };
  'pattern:discovered': { patternId: string; context: string; suggestion: string };
  'runtime:message-scored': {
    messageId: string;
    intent: string;
    urgency: string;
    score: number;
    channelType: string;
  };
  'runtime:recommendation': {
    messageId: string;
    recommendations: Array<{ id: string; action: string; confidence: number; reasoning: string }>;
  };
  'orchestration:chain-created': { id: string; steps: unknown[]; status: string };
  'orchestration:step-advanced': { chainId: string; step: number };
  'orchestration:escalation-created': { id: string; reason: string; status: string };
  'receipt:sent': { receiptId: string; taskId: string; channel: string; success: boolean };
}

const EVENT_LEVEL_MAP: Partial<Record<keyof AppEvents, SignalLevel>> = {
  'decision:created': 'high',
  'decision:correction-propagated': 'high',
  'escalation:triggered': 'critical',
  'emergent-signal:detected': 'critical',
  'signal:created': 'normal',
  'agent:task-updated': 'normal',
  'judgment:recorded': 'normal',
  'agent-profile:updated': 'low',
  'pattern:discovered': 'normal',
  'objective:updated': 'normal',
  'navigate:chat': 'low',
  'navigate:knowledge': 'low',
  'im:reply-sent': 'low',
  'im:cross-channel-reply': 'low',
  'inbox:message-received': 'normal',
  'inbox:reply-sent': 'low',
  'approval:resolved': 'normal',
  'decision:responded': 'normal',
  'correction:applied': 'high',
  'intent:dispatched': 'normal',
  'session:created': 'normal',
  'session:escalated': 'high',
  'escalation:resolved': 'normal',
  'objective:decoded': 'normal',
  'runtime:message-scored': 'normal',
  'runtime:recommendation': 'high',
  'orchestration:chain-created': 'normal',
  'orchestration:step-advanced': 'low',
  'orchestration:escalation-created': 'high',
  'receipt:sent': 'low',
};

type EventHandler<T> = (payload: T) => void;
type Unsubscribe = () => void;

class EventBus {
  readonly signalBus = new SignalBus();
  private legacyHandlers = new Map<string, Set<EventHandler<unknown>>>();

  constructor() {
    this.signalBus.onAll((signal) => {
      const set = this.legacyHandlers.get(signal.type);
      if (set) {
        set.forEach((handler) => handler(signal.payload));
      }
    });
  }

  on<K extends keyof AppEvents>(event: K, handler: EventHandler<AppEvents[K]>): Unsubscribe {
    if (!this.legacyHandlers.has(event)) {
      this.legacyHandlers.set(event, new Set());
    }
    const set = this.legacyHandlers.get(event)!;
    set.add(handler as EventHandler<unknown>);
    return () => {
      set.delete(handler as EventHandler<unknown>);
    };
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const level = EVENT_LEVEL_MAP[event] ?? 'normal';
    const signal = SignalBus.createSignal(event, level, payload);
    const dispatched = this.signalBus.emit(signal);

    if (!dispatched) {
      const set = this.legacyHandlers.get(event);
      if (set) {
        set.forEach((handler) => handler(payload));
      }
    }
  }

  off<K extends keyof AppEvents>(event: K, handler: EventHandler<AppEvents[K]>): void {
    const set = this.legacyHandlers.get(event);
    if (set) {
      set.delete(handler as EventHandler<unknown>);
    }
  }
}

export const appEvents = new EventBus();
