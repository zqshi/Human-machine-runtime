import { create } from 'zustand';
import {
  fetchObjectives,
  createObjective,
  updateObjective,
  deleteObjective,
  decodeStrategy,
  type ObjectiveDTO,
  type DecodedStrategyDTO,
} from '../../infrastructure/api/cockpitObjectiveApiAdapter';
import { appEvents } from '../events/eventBus';

export type { ObjectiveDTO, DecodedStrategyDTO };

interface ObjectiveState {
  objectives: ObjectiveDTO[];
  loading: boolean;
  error: string | null;
  decodedStrategy: DecodedStrategyDTO | null;
  decoding: boolean;

  fetch(filter?: { level?: string }): Promise<void>;
  create(objective: Omit<ObjectiveDTO, 'id' | 'createdAt' | 'updatedAt'>): Promise<ObjectiveDTO>;
  update(
    id: string,
    patch: Partial<
      Pick<ObjectiveDTO, 'title' | 'description' | 'status' | 'confidence' | 'metrics'>
    >
  ): Promise<void>;
  remove(id: string): Promise<void>;
  decode(intent: string): Promise<DecodedStrategyDTO>;

  getByLevel(level: 'L0' | 'L1' | 'L2'): ObjectiveDTO[];
  getById(id: string): ObjectiveDTO | undefined;
  getChildren(parentId: string): ObjectiveDTO[];

  subscribeSSE(): void;
  reset(): void;
}

export const useObjectiveStore = create<ObjectiveState>((set, get) => ({
  objectives: [],
  loading: false,
  error: null,
  decodedStrategy: null,
  decoding: false,

  async fetch(filter) {
    set({ loading: true, error: null });
    try {
      const items = await fetchObjectives(filter);
      set({ objectives: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async create(objective) {
    const item = await createObjective(objective);
    set({ objectives: [...get().objectives, item] });
    return item;
  },

  async update(id, patch) {
    const updated = await updateObjective(id, patch);
    set({
      objectives: get().objectives.map((o) => (o.id === id ? updated : o)),
    });
  },

  async remove(id) {
    await deleteObjective(id);
    set({ objectives: get().objectives.filter((o) => o.id !== id) });
  },

  async decode(intent) {
    set({ decoding: true });
    try {
      const result = await decodeStrategy(intent);
      set({ decodedStrategy: result, decoding: false });
      return result;
    } catch (e) {
      set({ decoding: false });
      throw e;
    }
  },

  getByLevel(level) {
    return get().objectives.filter((o) => o.level === level);
  },

  getById(id) {
    return get().objectives.find((o) => o.id === id);
  },

  getChildren(parentId) {
    return get().objectives.filter((o) => o.parentId === parentId);
  },

  subscribeSSE() {
    appEvents.on('objective:updated', (data) => {
      const dto = data as unknown as ObjectiveDTO;
      if (!dto?.id) return;
      const existing = get().objectives;
      const idx = existing.findIndex((o) => o.id === dto.id);
      if (idx >= 0) {
        const next = [...existing];
        next[idx] = { ...next[idx], ...dto };
        set({ objectives: next });
      } else {
        set({ objectives: [...existing, dto] });
      }
    });

    appEvents.on('objective:decoded', (data) => {
      set({ decodedStrategy: data as unknown as DecodedStrategyDTO });
    });
  },

  reset() {
    set({ objectives: [], loading: false, error: null, decodedStrategy: null, decoding: false });
  },
}));
