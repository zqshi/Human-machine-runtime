/**
 * signalStore — 统一信号状态管理
 *
 * 聚合 cockpitStore 和 notificationStore 中的异构事件为 Signal[]，
 * 按 SignalPrioritizer 排序后供 UI 消费。
 */

import { create } from 'zustand';
import { Signal, type SignalProps } from '../../domain/agent/Signal';
import { SignalPrioritizer } from '../../domain/agent/SignalPrioritizer';
import { PushPolicy, type PushChannel, type PushPolicyProps } from '../../domain/agent/PushPolicy';
import { fetchSignals } from '../../infrastructure/api/cockpitApiAdapter';

interface SignalState {
  signals: Signal[];
  pushPolicy: PushPolicy;
  addSignal(props: SignalProps): void;
  addSignals(batch: SignalProps[]): void;
  acknowledgeSignal(id: string): void;
  resolveSignal(id: string): void;
  removeExpired(): void;
  getPrioritized(): Signal[];
  getChannelsForSignal(signal: Signal): PushChannel[];
  updatePushPolicy(props: Partial<PushPolicyProps>): void;
  fetchFromBackend(): Promise<void>;
  reset(): void;
}

export const useSignalStore = create<SignalState>((set, get) => ({
  signals: [],
  pushPolicy: PushPolicy.createDefault(),

  addSignal(props: SignalProps) {
    const signal = Signal.create(props);
    const existing = get().signals;
    if (existing.some((s) => s.id === signal.id)) return;
    set({ signals: [...existing, signal] });
  },

  addSignals(batch: SignalProps[]) {
    const existing = get().signals;
    const existingIds = new Set(existing.map((s) => s.id));
    const newSignals = batch.filter((p) => !existingIds.has(p.id)).map((p) => Signal.create(p));
    if (newSignals.length === 0) return;
    set({ signals: [...existing, ...newSignals] });
  },

  acknowledgeSignal(id: string) {
    set({
      signals: get().signals.map((s) => (s.id === id ? s.acknowledge() : s)),
    });
  },

  resolveSignal(id: string) {
    set({
      signals: get().signals.map((s) => (s.id === id ? s.resolve() : s)),
    });
  },

  removeExpired() {
    const now = Date.now();
    set({
      signals: get().signals.map((s) => {
        if (s.status === 'active' && now > s.deadline) return s.expire();
        return s;
      }),
    });
  },

  getPrioritized(): Signal[] {
    return SignalPrioritizer.prioritizeSignals(get().signals);
  },

  getChannelsForSignal(signal: Signal): PushChannel[] {
    return get().pushPolicy.getChannels(signal.urgency);
  },

  updatePushPolicy(props: Partial<PushPolicyProps>) {
    const current = get().pushPolicy;
    let updated = current;
    if (props.matrix) updated = updated.withMatrix(props.matrix);
    if (props.quietHours) updated = updated.withQuietHours(props.quietHours);
    if (props.batchWindowMs !== undefined) updated = updated.withBatchWindow(props.batchWindowMs);
    set({ pushPolicy: updated });
  },

  reset() {
    set({ signals: [], pushPolicy: PushPolicy.createDefault() });
  },

  async fetchFromBackend() {
    try {
      const items = await fetchSignals();
      const props: SignalProps[] = items.map((item) => ({
        id: String(item.id),
        source: (item.source as SignalProps['source']) || 'external-alarm',
        urgency: (item.urgency as SignalProps['urgency']) || 'normal',
        status: (item.status as SignalProps['status']) || 'active',
        deadline: Number(item.deadline || Date.now() + 86_400_000),
        impactScope: Number(item.impactScope || 0),
        payload: (item.payload as SignalProps['payload']) || {
          entityId: String(item.id),
          entityType: 'signal',
          title: String(item.title || ''),
        },
        agentId: item.agentId as string | undefined,
        createdAt: Number(item.createdAt || Date.now()),
      }));
      if (props.length > 0) get().addSignals(props);
    } catch {
      // backend unavailable — keep existing in-memory state
    }
  },
}));
