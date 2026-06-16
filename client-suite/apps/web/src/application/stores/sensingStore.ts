import { create } from 'zustand';
import {
  fetchEmergentSignals,
  updateEmergentSignal,
  fetchDetectedPatterns,
  type EmergentSignalDTO,
  type DetectedPatternDTO,
} from '../../infrastructure/api/openclawSensingApiAdapter';
import { appEvents } from '../events/eventBus';

interface SensingState {
  emergentSignals: EmergentSignalDTO[];
  detectedPatterns: DetectedPatternDTO[];
  loading: boolean;
  error: string | null;

  fetchEmergentSignals(): Promise<void>;
  acknowledgeSignal(id: string): Promise<void>;
  resolveSignal(id: string): Promise<void>;
  fetchPatterns(): Promise<void>;

  getActiveSignals(): EmergentSignalDTO[];
  getCriticalSignals(): EmergentSignalDTO[];

  subscribeSSE(): void;
  reset(): void;
}

export const useSensingStore = create<SensingState>((set, get) => ({
  emergentSignals: [],
  detectedPatterns: [],
  loading: false,
  error: null,

  async fetchEmergentSignals() {
    set({ loading: true, error: null });
    try {
      const items = await fetchEmergentSignals();
      set({ emergentSignals: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async acknowledgeSignal(id) {
    const updated = await updateEmergentSignal(id, { status: 'acknowledged' });
    set({
      emergentSignals: get().emergentSignals.map((s) => (s.id === id ? updated : s)),
    });
  },

  async resolveSignal(id) {
    const updated = await updateEmergentSignal(id, { status: 'resolved' });
    set({
      emergentSignals: get().emergentSignals.map((s) => (s.id === id ? updated : s)),
    });
  },

  async fetchPatterns() {
    set({ loading: true, error: null });
    try {
      const items = await fetchDetectedPatterns();
      set({ detectedPatterns: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  getActiveSignals() {
    return get().emergentSignals.filter((s) => s.status === 'active');
  },

  getCriticalSignals() {
    return get().emergentSignals.filter(
      (s) => s.severity === 'critical' && s.status !== 'resolved'
    );
  },

  subscribeSSE() {
    appEvents.on('emergent-signal:detected', (data) => {
      const dto = data as unknown as EmergentSignalDTO;
      if (dto?.id) {
        const existing = get().emergentSignals;
        if (!existing.some((s) => s.id === dto.id)) {
          set({ emergentSignals: [...existing, dto] });
        }
      }
    });

    appEvents.on('pattern:discovered', (data) => {
      const dto = data as unknown as DetectedPatternDTO;
      if (dto?.id) {
        const existing = get().detectedPatterns;
        if (!existing.some((p) => p.id === dto.id)) {
          set({ detectedPatterns: [...existing, dto] });
        }
      }
    });
  },

  reset() {
    set({ emergentSignals: [], detectedPatterns: [], loading: false, error: null });
  },
}));
