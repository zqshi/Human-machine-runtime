import type { StorageStats, DeptStorage, LargeFile } from '../../domain/knowledge/StorageTypes';
import { knowledgeAuditApi, storageApi } from '../../infrastructure/api/dcfApiClient';
import type { KnowledgeState, AuditLogFilter } from './knowledgeStore';

type SetFn = (
  partial: Partial<KnowledgeState> | ((s: KnowledgeState) => Partial<KnowledgeState>)
) => void;
type GetFn = () => KnowledgeState;

const startLoading = (s: KnowledgeState) => ({
  _loadingCount: s._loadingCount + 1,
  loading: true,
  error: null,
});

const doneLoading = (s: KnowledgeState, extra: Partial<KnowledgeState> = {}) => {
  const c = s._loadingCount - 1;
  return { ...extra, _loadingCount: c, loading: c > 0 } as Partial<KnowledgeState>;
};

export function knowledgeAdminActions(set: SetFn, _get: GetFn) {
  return {
    async fetchAuditLog(filter?: AuditLogFilter) {
      set((s) => startLoading(s));
      try {
        const { entries } = await knowledgeAuditApi.list({
          operationType: filter?.operationType,
          operatorId: filter?.operatorId,
          search: filter?.search,
        });
        const { AuditEntry: AuditEntryClass } = await import('../../domain/knowledge/AuditEntry');
        const auditEntries = entries.map((e) =>
          AuditEntryClass.create(e as unknown as Parameters<typeof AuditEntryClass.create>[0])
        );
        set((s) => doneLoading(s, { auditEntries }));
      } catch {
        set((s) => doneLoading(s, { auditEntries: [] }));
      }
    },

    async fetchStorageStats() {
      set((s) => startLoading(s));
      try {
        const { stats } = await storageApi.getStats();
        set((s) => doneLoading(s, { storageStats: stats as unknown as StorageStats }));
      } catch {
        set((s) => doneLoading(s, { storageStats: null }));
      }
    },

    async fetchDeptStorage() {
      set((s) => startLoading(s));
      try {
        const { departments } = await storageApi.getDeptStorage();
        set((s) => doneLoading(s, { deptStorage: departments as unknown as DeptStorage[] }));
      } catch {
        set((s) => doneLoading(s, { deptStorage: [] }));
      }
    },

    async fetchLargeFiles() {
      set((s) => startLoading(s));
      try {
        const { files } = await storageApi.getLargeFiles();
        set((s) => doneLoading(s, { largeFiles: files as unknown as LargeFile[] }));
      } catch {
        set((s) => doneLoading(s, { largeFiles: [] }));
      }
    },
  };
}
