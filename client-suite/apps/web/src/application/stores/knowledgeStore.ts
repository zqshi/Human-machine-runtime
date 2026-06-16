import { create } from 'zustand';
import type { Folder, FolderType } from '../../domain/knowledge/Folder';
import { Folder as FolderClass } from '../../domain/knowledge/Folder';
import type { Document } from '../../domain/knowledge/Document';
import type { DocumentStatus } from '../../domain/knowledge/Document';
import type { Version } from '../../domain/knowledge/Version';
import type { AuditEntry, AuditOperationType } from '../../domain/knowledge/AuditEntry';
import type { DocumentPermission } from '../../domain/knowledge/Permission';
import type { StorageStats, DeptStorage, LargeFile } from '../../domain/knowledge/StorageTypes';
import { documentApi, categoryApi, uploadApi } from '../../infrastructure/api/hmrApiClient';
import { fromDTO, toCreateDTO, toUpdateDTO } from '../../infrastructure/api/documentAdapter';
import { knowledgeAdminActions } from './knowledgeAdminActions';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/* ── Filter Types ── */

export interface DocumentFilter {
  status?: DocumentStatus;
  categoryId?: string;
  departmentId?: string;
  ownerId?: string;
  starred?: boolean;
  search?: string;
}

export interface AuditLogFilter {
  operationType?: AuditOperationType;
  operatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

type ViewMode = 'grid' | 'list';

/* ── State Shape ── */

export interface KnowledgeState {
  /* ── Core Data ── */
  folders: Folder[];
  documents: Document[];
  versions: Version[];
  auditEntries: AuditEntry[];
  storageStats: StorageStats | null;
  deptStorage: DeptStorage[];
  largeFiles: LargeFile[];

  /* ── UI State ── */
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  searchQuery: string;
  viewMode: ViewMode;
  selectedDocIds: Set<string>;
  isAdminView: boolean;
  documentFilter: DocumentFilter;

  /** true when any async operation is in-flight */
  loading: boolean;
  /** Internal counter — use `loading` instead */
  _loadingCount: number;
  error: string | null;

  /* ── Basic Actions ── */
  reset(): void;
  selectFolder(folderId: string | null): void;
  selectDocument(documentId: string | null): void;
  setViewMode(mode: ViewMode): void;
  setSearchQuery(query: string): void;
  toggleStar(documentId: string): void;
  toggleDocSelection(docId: string): void;
  selectAllDocs(docIds: string[]): void;
  clearDocSelection(): void;
  setAdminView(enabled: boolean): void;
  setDocumentFilter(filter: DocumentFilter): void;

  /* ── Document CRUD ── */
  fetchDocuments(): Promise<void>;
  createDocument(
    title: string,
    type?: 'doc' | 'markdown' | 'sheet' | 'slide',
    content?: string
  ): Promise<string | null>;
  updateDocument(
    id: string,
    data: { title?: string; content?: string; version?: number }
  ): Promise<boolean>;
  deleteDocument(id: string): Promise<boolean>;
  uploadFile(file: File): Promise<boolean>;

  /* ── Category / Folder ── */
  fetchCategories(): Promise<void>;
  createFolder(name: string, parentId: string | null, icon?: string): Promise<string | null>;
  updateFolder(
    id: string,
    data: { name?: string; icon?: string; description?: string }
  ): Promise<boolean>;
  deleteFolder(id: string): Promise<boolean>;

  /* ── Versions ── */
  fetchVersions(docId: string): Promise<void>;
  restoreVersion(versionId: string): Promise<boolean>;

  /* ── Document Lifecycle ── */
  submitForReview(id: string): Promise<boolean>;
  approveDocument(id: string): Promise<boolean>;
  rejectDocument(id: string, comment: string): Promise<boolean>;
  publishDocument(id: string): Promise<boolean>;
  publishToTarget(
    docId: string,
    target: 'org' | 'department' | 'shared',
    departmentId?: string
  ): Promise<boolean>;
  archiveDocument(id: string): Promise<boolean>;

  /* ── Filtered Fetch ── */
  fetchDocumentsByFilter(filter: DocumentFilter): Promise<void>;
  fetchDrafts(): Promise<void>;
  fetchFavorites(): Promise<void>;

  /* ── Admin ── */
  fetchAuditLog(filter?: AuditLogFilter): Promise<void>;
  fetchStorageStats(): Promise<void>;
  fetchDeptStorage(): Promise<void>;
  fetchLargeFiles(): Promise<void>;

  /* ── Permissions ── */
  updateDocumentPermissions(docId: string, perms: DocumentPermission[]): Promise<boolean>;
}

/* ── Helpers ── */

/** Increment loading counter */
const startLoading = (s: KnowledgeState) => ({
  _loadingCount: s._loadingCount + 1,
  loading: true,
  error: null,
});

/** Decrement loading counter */
const doneLoading = (s: KnowledgeState, extra: Partial<KnowledgeState> = {}) => {
  const c = s._loadingCount - 1;
  return { ...extra, _loadingCount: c, loading: c > 0 } as Partial<KnowledgeState>;
};

const errorLoading = (s: KnowledgeState, msg: string) => {
  const c = s._loadingCount - 1;
  return { error: msg, _loadingCount: c, loading: c > 0 };
};

/* ══════════════════════════════════════════════
   Store Implementation
   ══════════════════════════════════════════════ */

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  /* ── Initial State ── */
  folders: [],
  documents: [],
  versions: [],
  auditEntries: [],
  storageStats: null,
  deptStorage: [],
  largeFiles: [],
  selectedFolderId: null,
  selectedDocumentId: null,
  searchQuery: '',
  viewMode: 'grid',
  selectedDocIds: new Set<string>(),
  isAdminView: false,
  documentFilter: {},
  loading: false,
  _loadingCount: 0,
  error: null,

  /* ── Basic Actions ── */

  reset() {
    set({
      folders: [],
      documents: [],
      versions: [],
      auditEntries: [],
      storageStats: null,
      deptStorage: [],
      largeFiles: [],
      selectedFolderId: null,
      selectedDocumentId: null,
      searchQuery: '',
      viewMode: 'grid',
      selectedDocIds: new Set<string>(),
      isAdminView: false,
      documentFilter: {},
      loading: false,
      _loadingCount: 0,
      error: null,
    });
  },

  selectFolder(folderId) {
    set({ selectedFolderId: folderId, selectedDocumentId: null });
  },

  selectDocument(documentId) {
    set({ selectedDocumentId: documentId });
  },

  setViewMode(mode) {
    set({ viewMode: mode });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setDocumentFilter(filter) {
    set({ documentFilter: filter });
  },

  toggleStar(documentId) {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === documentId ? d.withStarred(!d.starred) : d)),
    }));
    documentApi.toggleStar(documentId).catch(() => {
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? d.withStarred(!d.starred) : d
        ),
      }));
    });
  },

  toggleDocSelection(docId) {
    set((state) => {
      const next = new Set(state.selectedDocIds);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return { selectedDocIds: next };
    });
  },

  selectAllDocs(docIds) {
    set({ selectedDocIds: new Set(docIds) });
  },

  clearDocSelection() {
    set({ selectedDocIds: new Set<string>() });
  },

  setAdminView(enabled) {
    set({ isAdminView: enabled });
  },

  /* ── Document CRUD ── */

  async fetchDocuments() {
    set((s) => startLoading(s));
    try {
      const { documents: dtos } = await documentApi.list();
      const documents = dtos.map(fromDTO);
      set((s) => doneLoading(s, { documents }));
    } catch {
      set((s) => doneLoading(s, { documents: [] }));
    }
  },

  async createDocument(title, type = 'doc', content = '') {
    set((s) => startLoading(s));
    try {
      const dto = toCreateDTO({ title, type, content });
      const { document: created } = await documentApi.create(dto);
      const doc = fromDTO(created);
      set((s) => doneLoading(s, { documents: [doc, ...s.documents] }));
      return created.id;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '创建文档失败')));
      return null;
    }
  },

  async updateDocument(id, data) {
    set((s) => startLoading(s));
    try {
      const dto = toUpdateDTO(data);
      const { document: updated } = await documentApi.update(id, dto);
      const doc = fromDTO(updated);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === id ? doc : d)),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '更新文档失败')));
      return false;
    }
  },

  async deleteDocument(id) {
    set((s) => startLoading(s));
    try {
      await documentApi.delete(id);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.filter((d) => d.id !== id),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '删除文档失败')));
      return false;
    }
  },

  async uploadFile(file) {
    set((s) => startLoading(s));
    try {
      await uploadApi.upload(file);
      set((s) => doneLoading(s));
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '上传文件失败')));
      return false;
    }
  },

  /* ── Category / Folder ── */

  async fetchCategories() {
    set((s) => startLoading(s));
    try {
      const { categories } = await categoryApi.list();
      const folders = categories.map((c) => {
        const cat = c as {
          id: string;
          name: string;
          parentId?: string;
          icon?: string;
          type?: string;
          departmentId?: string;
        };
        return FolderClass.create({
          id: cat.id,
          name: cat.name,
          parentId: cat.parentId || null,
          icon: cat.icon || 'folder',
          type: cat.type as FolderType | undefined,
          departmentId: cat.departmentId,
        });
      });
      set((s) => doneLoading(s, { folders }));
    } catch {
      set((s) => doneLoading(s, { folders: [] }));
    }
  },

  async createFolder(name, parentId, icon = 'folder') {
    set((s) => startLoading(s));
    try {
      const res = await categoryApi.create({ name, parentId: parentId ?? undefined, icon });
      const category = res.category as {
        id: string;
        name: string;
        parentId?: string;
        icon?: string;
      };
      const folder = FolderClass.create({
        id: category.id,
        name: category.name,
        parentId: category.parentId ?? null,
        icon: category.icon || 'folder',
      });
      set((s) => doneLoading(s, { folders: [...s.folders, folder] }));
      return category.id;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '创建文件夹失败')));
      return null;
    }
  },

  async updateFolder(id, data) {
    set((s) => startLoading(s));
    try {
      await categoryApi.update(id, data);
      set((s) =>
        doneLoading(s, {
          folders: s.folders.map((f) => {
            if (f.id !== id) return f;
            return data.name ? f.withName(data.name) : f;
          }),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '更新文件夹失败')));
      return false;
    }
  },

  async deleteFolder(id) {
    set((s) => startLoading(s));
    try {
      await categoryApi.delete(id);
      set((s) =>
        doneLoading(s, {
          folders: s.folders.filter((f) => f.id !== id),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '删除文件夹失败')));
      return false;
    }
  },

  /* ── Versions ── */

  async fetchVersions(docId) {
    set((s) => startLoading(s));
    try {
      const { versions: vDtos } = await documentApi.listVersions(docId);
      const { Version: VersionClass } = await import('../../domain/knowledge/Version');
      const versions = vDtos.map((v) => {
        const dto = v as Record<string, string | number>;
        return VersionClass.create({
          id: dto.id as string,
          documentId: dto.documentId as string,
          version: (dto.versionNumber || dto.version || 1) as number,
          author: { name: (dto.editedBy || dto.title || 'unknown') as string },
          createdAt: dto.createdAt as string,
          changeDescription: (dto.title || '') as string,
          diffStats: { added: 0, removed: 0 },
          contentSnapshot: (dto.contentSnapshot || '') as string,
          status: (dto.status || 'auto') as 'auto' | 'manual' | 'published',
        });
      });
      set((s) => doneLoading(s, { versions }));
    } catch {
      set((s) => doneLoading(s, { versions: [] }));
    }
  },

  async restoreVersion(versionId) {
    const version = get().versions.find((v) => v.id === versionId);
    if (!version || !version.hasSnapshot) return false;

    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.restoreVersion(versionId);
      const doc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === doc.id ? doc : d)),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '恢复版本失败')));
      return false;
    }
  },

  /* ── Document Lifecycle ── */

  async submitForReview(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('pending_review')) return false;

    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.submitForReview(id);
      const apiDoc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === id ? apiDoc : d)),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '提交审核失败')));
      return false;
    }
  },

  async approveDocument(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('published')) return false;

    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.approve(id);
      const apiDoc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === id ? apiDoc : d)),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '审批失败')));
      return false;
    }
  },

  async rejectDocument(id, comment) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) return false;

    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.reject(id, comment);
      const apiDoc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === id ? apiDoc : d)),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '驳回失败')));
      return false;
    }
  },

  async publishDocument(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('published')) return false;

    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.publish(id);
      const apiDoc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === id ? apiDoc : d)),
        })
      );
      // Sync to WeKnora RAG (non-blocking)
      try {
        const { weKnoraApi } = await import('../../infrastructure/api/weKnoraClient');
        const plainText = (apiDoc.content || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        await weKnoraApi.syncDocument({ id, title: apiDoc.title, content: plainText, type: 'doc' });
      } catch {
        /* WeKnora sync failure should not block publish */
      }
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '发布失败')));
      return false;
    }
  },

  async publishToTarget(docId, target, departmentId?) {
    const TARGET_CATEGORY: Record<string, string> = {
      org: 'cat-official',
      department: 'cat-department',
      shared: 'cat-shared',
    };
    const needsReview = target === 'org' || target === 'department';
    const categoryId = TARGET_CATEGORY[target] || 'cat-shared';

    const doc = get().documents.find((d) => d.id === docId);
    if (!doc) return false;

    set((s) => startLoading(s));
    try {
      // Update category first
      await documentApi.update(docId, { categoryId, departmentId });
      // Then transition status
      const apiCall = needsReview ? documentApi.submitForReview(docId) : documentApi.publish(docId);
      const { document: dto } = await apiCall;
      const apiDoc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === docId ? apiDoc : d)),
        })
      );
      if (!needsReview) {
        // Sync to WeKnora RAG (non-blocking)
        try {
          const { weKnoraApi } = await import('../../infrastructure/api/weKnoraClient');
          const plainText = (apiDoc.content || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          await weKnoraApi.syncDocument({
            id: docId,
            title: apiDoc.title,
            content: plainText,
            type: 'doc',
          });
        } catch {
          /* WeKnora sync failure should not block publish */
        }
      }
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '发布失败')));
      return false;
    }
  },

  async archiveDocument(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('archived')) return false;

    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.archive(id);
      const apiDoc = fromDTO(dto);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === id ? apiDoc : d)),
        })
      );
      // Remove from WeKnora RAG index (non-blocking)
      try {
        const { weKnoraApi } = await import('../../infrastructure/api/weKnoraClient');
        await weKnoraApi.syncDocument({ id, title: '', content: '', type: 'doc' });
      } catch {
        /* WeKnora sync failure should not block archive */
      }
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '归档失败')));
      return false;
    }
  },

  /* ── Filtered Fetch ── */

  async fetchDocumentsByFilter(filter) {
    set({ documentFilter: filter });
    // Ensure documents are loaded first
    if (get().documents.length === 0) {
      await get().fetchDocuments();
    }
    // Filtering is done at render time via selector; this just sets the filter.
  },

  async fetchDrafts() {
    await get().fetchDocumentsByFilter({ status: 'draft', ownerId: 'current-user' });
  },

  async fetchFavorites() {
    await get().fetchDocumentsByFilter({ starred: true });
  },

  /* ── Admin (delegated to knowledgeAdminActions.ts) ── */
  ...knowledgeAdminActions(set, get),

  /* ── Permissions ── */

  async updateDocumentPermissions(docId, perms) {
    set((s) => startLoading(s));
    try {
      await documentApi.updatePermissions(docId, perms);
      set((s) =>
        doneLoading(s, {
          documents: s.documents.map((d) => (d.id === docId ? d.withPermissions(perms) : d)),
        })
      );
      return true;
    } catch (err) {
      set((s) => errorLoading(s, errMsg(err, '更新权限失败')));
      return false;
    }
  },
}));
