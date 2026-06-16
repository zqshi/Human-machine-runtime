import { create } from 'zustand';
import {
  fetchScorecards,
  fetchKnowledgePatterns,
  type ScorecardDTO,
  type KnowledgePatternDTO,
} from '../../infrastructure/api/openclawSensingApiAdapter';

export type { ScorecardDTO, KnowledgePatternDTO };

interface EvaluationState {
  scorecards: ScorecardDTO[];
  knowledgePatterns: KnowledgePatternDTO[];
  loading: boolean;
  error: string | null;

  fetchScorecards(filter?: { type?: 'agent' | 'human' }): Promise<void>;
  fetchKnowledgePatterns(filter?: { keyword?: string }): Promise<void>;

  getAgentScorecards(): ScorecardDTO[];
  getHumanScorecards(): ScorecardDTO[];
  getTopPerformers(limit?: number): ScorecardDTO[];
  getUnderperformers(): ScorecardDTO[];

  reset(): void;
}

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  scorecards: [],
  knowledgePatterns: [],
  loading: false,
  error: null,

  async fetchScorecards(filter) {
    set({ loading: true, error: null });
    try {
      const items = await fetchScorecards(filter);
      set({ scorecards: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async fetchKnowledgePatterns(filter) {
    set({ loading: true, error: null });
    try {
      const items = await fetchKnowledgePatterns(filter);
      set({ knowledgePatterns: items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  getAgentScorecards() {
    return get().scorecards.filter((s) => s.type === 'agent');
  },

  getHumanScorecards() {
    return get().scorecards.filter((s) => s.type === 'human');
  },

  getTopPerformers(limit = 5) {
    return [...get().scorecards].sort((a, b) => b.score - a.score).slice(0, limit);
  },

  getUnderperformers() {
    return get().scorecards.filter((s) => s.adjustment === 'demote');
  },

  reset() {
    set({ scorecards: [], knowledgePatterns: [], loading: false, error: null });
  },
}));
