/**
 * pushConfigStore — 推送偏好持久化
 */
import { create } from 'zustand';
import {
  PushPolicy,
  type PushChannel,
  type PushMatrix,
  type QuietHours,
} from '../../domain/agent/PushPolicy';
import type { SignalUrgency } from '../../domain/agent/Signal';

interface PushConfigState {
  policy: PushPolicy;
  setChannels: (urgency: SignalUrgency, channels: PushChannel[]) => void;
  toggleChannel: (urgency: SignalUrgency, channel: PushChannel) => void;
  setQuietHours: (update: Partial<QuietHours>) => void;
  setBatchWindow: (ms: number) => void;
  reset: () => void;
}

export const usePushConfigStore = create<PushConfigState>((set) => ({
  policy: PushPolicy.createDefault(),

  setChannels: (urgency, channels) =>
    set((s) => ({
      policy: s.policy.withMatrix({ [urgency]: channels } as Partial<PushMatrix>),
    })),

  toggleChannel: (urgency, channel) =>
    set((s) => {
      const current = s.policy.getChannels(urgency);
      const has = current.includes(channel);
      const next = has ? current.filter((c) => c !== channel) : [...current, channel];
      return { policy: s.policy.withMatrix({ [urgency]: next } as Partial<PushMatrix>) };
    }),

  setQuietHours: (update) => set((s) => ({ policy: s.policy.withQuietHours(update) })),

  setBatchWindow: (ms) => set((s) => ({ policy: s.policy.withBatchWindow(ms) })),

  reset: () => set({ policy: PushPolicy.createDefault() }),
}));
