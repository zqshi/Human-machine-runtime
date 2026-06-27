import { create } from 'zustand';
import { JudgmentRecord } from '../../domain/agent/JudgmentRecord';
import type { DecisionSource } from '../../domain/agent/DecisionHub';
import {
  fetchJudgmentRecords,
  createJudgmentRecord,
} from '../../infrastructure/api/cockpitApiAdapter';

const STORAGE_KEY = 'hmr-judgment-records';

interface JudgmentState {
  records: JudgmentRecord[];
  addRecord: (record: JudgmentRecord) => void;
  getRecordsBySource: (source: DecisionSource) => JudgmentRecord[];
  getRecordsByDecisionId: (decisionId: string) => JudgmentRecord[];
  fetchFromBackend(): Promise<void>;
}

function loadFromStorage(): JudgmentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map((item) => JudgmentRecord.rehydrate(item));
  } catch {
    return [];
  }
}

function saveToStorage(records: JudgmentRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage quota exceeded — silently drop
  }
}

export const useJudgmentStore = create<JudgmentState>((set, get) => ({
  records: loadFromStorage(),

  addRecord(record) {
    const next = [record, ...get().records];
    set({ records: next });
    saveToStorage(next);
    createJudgmentRecord(JSON.parse(JSON.stringify(record))).catch(() => {});
  },

  getRecordsBySource(source) {
    return get().records.filter((r) => r.source === source);
  },

  getRecordsByDecisionId(decisionId) {
    return get().records.filter((r) => r.decisionId === decisionId);
  },

  async fetchFromBackend() {
    try {
      const items = await fetchJudgmentRecords();
      const backendRecords = items.map((item) => JudgmentRecord.rehydrate(item));
      const local = get().records;
      const existingIds = new Set(backendRecords.map((r) => r.id));
      const localOnly = local.filter((r) => !existingIds.has(r.id));
      const merged = [...backendRecords, ...localOnly];
      set({ records: merged });
      saveToStorage(merged);
    } catch {
      // keep localStorage data as fallback
    }
  },
}));
