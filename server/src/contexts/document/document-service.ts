import { randomUUID } from 'crypto';
import { AppError } from '../../shared/utils.js';

const VALID_TYPES = ['doc', 'code', 'markdown', 'sheet', 'slide'] as const;

const TRANSITION_MAP: Record<string, string[]> = {
  draft: ['pending_review', 'published', 'archived'],
  pending_review: ['draft', 'published'],
  published: ['draft', 'archived'],
  archived: ['draft'],
};

function validateTransition(from: string, to: string): void {
  const allowed = TRANSITION_MAP[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(`invalid transition: ${from} → ${to}`, 400, 'DOC_INVALID_TRANSITION');
  }
}

export interface Document {
  id: string;
  roomId: string | null;
  type: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  categoryId: string | null;
  departmentId: string | null;
  ownerId: string;
  permissions: unknown[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  publishedAt?: string;
  submittedAt?: string;
  reviewedBy?: string | null;
  reviewComment?: string;
  tenantId?: string | null;
  wkKnowledgeId?: string | null;
  wkSyncStatus?: string | null;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  editedBy: string;
  createdAt: string;
  contentSnapshot: unknown;
  status: string;
}

export interface IDocumentRepository {
  listDocuments(roomId?: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | null>;
  saveDocument(doc: Document): Promise<void>;
  deleteDocument(id: string): Promise<boolean>;
  listVersions(documentId: string): Promise<DocumentVersion[]>;
  getVersion(versionId: string): Promise<DocumentVersion | null>;
  saveVersion(version: DocumentVersion): Promise<void>;
  listDocumentPermissions(documentId: string): Promise<unknown[]>;
  saveDocumentPermissions(documentId: string, permissions: unknown[]): Promise<void>;
  appendKnowledgeAudit(entry: Record<string, unknown>): Promise<void>;
  listKnowledgeAudits?(filters: {
    operationType?: string;
    operatorId?: string;
    targetId?: string;
  }): Promise<Record<string, unknown>[]>;
  /** 在数据库事务中执行（保证多表写入原子性，如 saveDocument + saveVersion） */
  withTransaction<T>(fn: (tx: IDocumentRepository) => Promise<T>): Promise<T>;
}

interface IAudit {
  log(type: string, payload: Record<string, unknown>): Promise<unknown>;
}

export interface IDocumentSyncHook {
  onPublished(doc: Document): Promise<void>;
}

export class DocumentService {
  private repo: IDocumentRepository;
  private auditService: IAudit | null;
  private syncHook: IDocumentSyncHook | null;

  constructor(repo: IDocumentRepository, auditService?: IAudit) {
    this.repo = repo;
    this.auditService = auditService || null;
    this.syncHook = null;
  }

  setSyncHook(hook: IDocumentSyncHook) {
    this.syncHook = hook;
  }

  private async audit(type: string, payload: Record<string, unknown> = {}) {
    if (!this.auditService) return;
    await this.auditService.log(type, payload);
  }

  private async knowledgeAudit(
    op: string,
    operatorId: string,
    operatorName: string,
    targetId: string,
    targetName: string
  ) {
    await this.repo.appendKnowledgeAudit({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      operationType: op,
      operatorId,
      operatorName,
      targetId,
      targetName,
    });
  }

  async list(
    roomId?: string,
    filters: {
      folderId?: string;
      status?: string;
      categoryId?: string;
      departmentId?: string;
      ownerId?: string;
      starred?: boolean;
      search?: string;
    } = {}
  ): Promise<Document[]> {
    let docs = await this.repo.listDocuments(roomId || undefined);
    if (filters.folderId)
      docs = docs.filter(
        (d) =>
          d.categoryId === filters.folderId ||
          ((d.content as Record<string, unknown>)?._meta as Record<string, unknown>)?.folderId ===
            filters.folderId
      );
    if (filters.status) docs = docs.filter((d) => d.status === filters.status);
    if (filters.categoryId) docs = docs.filter((d) => d.categoryId === filters.categoryId);
    if (filters.departmentId) docs = docs.filter((d) => d.departmentId === filters.departmentId);
    if (filters.ownerId)
      docs = docs.filter((d) => d.ownerId === filters.ownerId || d.createdBy === filters.ownerId);
    if (filters.starred !== undefined) {
      docs = docs.filter(
        (d) =>
          Boolean(
            ((d.content as Record<string, unknown>)?._meta as Record<string, unknown>)?.starred
          ) === filters.starred
      );
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q));
    }
    return docs;
  }

  async get(id: string): Promise<Document> {
    const doc = await this.repo.getDocument(id);
    if (!doc) throw new AppError(`document not found: ${id}`, 404, 'DOC_NOT_FOUND');
    return doc;
  }

  async create(input: {
    type?: string;
    roomId?: string;
    title?: string;
    content?: Record<string, unknown>;
    status?: string;
    categoryId?: string;
    departmentId?: string;
    ownerId?: string;
    createdBy?: string;
    permissions?: unknown[];
    folderId?: string;
    tags?: string[];
    starred?: boolean;
  }): Promise<Document> {
    const type = String(input.type || 'doc').trim();
    if (!(VALID_TYPES as readonly string[]).includes(type))
      throw new AppError(`invalid document type: ${type}`, 400, 'DOC_INVALID_TYPE');
    const now = new Date().toISOString();
    const rawContent = input.content || {};
    const meta = { ...((rawContent._meta as Record<string, unknown>) || {}) };
    if (input.folderId !== undefined) meta.folderId = input.folderId || null;
    if (input.tags !== undefined) meta.tags = input.tags;
    if (input.starred !== undefined) meta.starred = input.starred;
    const content = { ...rawContent, _meta: meta };
    const doc: Document = {
      id: randomUUID(),
      roomId: input.roomId || null,
      type,
      title: String(input.title || '').trim() || '未命名文档',
      content,
      status: input.status || 'draft',
      categoryId: input.categoryId || null,
      departmentId: input.departmentId || null,
      ownerId: input.ownerId || input.createdBy || 'system',
      permissions: input.permissions || [],
      createdBy: input.createdBy || 'system',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.repo.withTransaction(async (tx) => {
      await tx.saveDocument(doc);
      await this.saveVersionSnapshot(doc, 'auto', tx);
    });
    await this.audit('document.created', { documentId: doc.id, type });
    await this.knowledgeAudit('create', doc.ownerId, doc.createdBy, doc.id, doc.title);
    return doc;
  }

  async update(
    id: string,
    input: {
      title?: string;
      content?: Record<string, unknown>;
      categoryId?: string;
      departmentId?: string;
      permissions?: unknown[];
      version?: number;
      folderId?: string;
      tags?: string[];
      starred?: boolean;
    }
  ): Promise<Document> {
    const existing = await this.get(id);
    if (input.version !== undefined && Number(input.version) !== existing.version) {
      throw new AppError(
        `version conflict: expected ${existing.version}, got ${input.version}`,
        409,
        'DOC_VERSION_CONFLICT'
      );
    }
    let content: Record<string, unknown> =
      input.content !== undefined ? input.content || {} : existing.content || {};
    const existingMeta = (existing.content?._meta as Record<string, unknown>) || {};
    const newMeta = (content._meta as Record<string, unknown>) || existingMeta;
    const mergedMeta: Record<string, unknown> = { ...existingMeta, ...newMeta };
    if (input.folderId !== undefined) mergedMeta.folderId = input.folderId || null;
    if (input.tags !== undefined) mergedMeta.tags = input.tags;
    if (input.starred !== undefined) mergedMeta.starred = input.starred;
    content = { ...content, _meta: mergedMeta };
    const updated: Document = {
      ...existing,
      title: input.title !== undefined ? String(input.title).trim() : existing.title,
      content,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      departmentId: input.departmentId !== undefined ? input.departmentId : existing.departmentId,
      permissions: input.permissions !== undefined ? input.permissions : existing.permissions,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    await this.repo.withTransaction(async (tx) => {
      await tx.saveDocument(updated);
      await this.saveVersionSnapshot(updated, 'auto', tx);
    });
    await this.audit('document.updated', { documentId: id, version: updated.version });
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const doc = await this.get(id);
    const deleted = await this.repo.deleteDocument(id);
    if (deleted) {
      await this.audit('document.deleted', { documentId: id });
      await this.knowledgeAudit('delete', doc.ownerId, doc.createdBy, id, doc.title);
    }
    return deleted;
  }

  async transitionStatus(
    id: string,
    targetStatus: string,
    actor: { id?: string; name?: string } = {}
  ): Promise<Document> {
    const existing = await this.get(id);
    validateTransition(existing.status || 'draft', targetStatus);
    const updated: Document = {
      ...existing,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    if (targetStatus === 'published') {
      updated.publishedAt = new Date().toISOString();
      updated.reviewedBy = actor.name || null;
    }
    if (targetStatus === 'pending_review') {
      updated.submittedAt = new Date().toISOString();
    }
    await this.repo.withTransaction(async (tx) => {
      await tx.saveDocument(updated);
      if (targetStatus === 'published') {
        await this.saveVersionSnapshot(updated, 'published', tx);
      }
    });
    if (targetStatus === 'published' && this.syncHook) {
      try {
        await this.syncHook.onPublished(updated);
      } catch {
        /* non-blocking */
      }
    }
    await this.audit(`document.${targetStatus}`, { documentId: id });
    await this.knowledgeAudit(
      targetStatus === 'published'
        ? 'publish'
        : targetStatus === 'archived'
          ? 'archive'
          : targetStatus,
      actor.id || 'system',
      actor.name || 'System',
      id,
      updated.title
    );
    return updated;
  }

  async listVersions(documentId: string) {
    return this.repo.listVersions(documentId);
  }

  async restoreVersion(versionId: string): Promise<Document> {
    const version = await this.repo.getVersion(versionId);
    if (!version)
      throw new AppError(`version not found: ${versionId}`, 404, 'DOC_VERSION_NOT_FOUND');
    if (!version.contentSnapshot)
      throw new AppError('version has no content snapshot', 400, 'DOC_NO_SNAPSHOT');
    const doc = await this.get(version.documentId);
    const restored: Document = {
      ...doc,
      content:
        typeof version.contentSnapshot === 'string'
          ? { html: version.contentSnapshot }
          : (version.contentSnapshot as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
      version: doc.version + 1,
    };
    await this.repo.withTransaction(async (tx) => {
      await tx.saveDocument(restored);
      await this.saveVersionSnapshot(restored, 'manual', tx);
    });
    return restored;
  }

  private async saveVersionSnapshot(
    doc: Document,
    status: string,
    repo: IDocumentRepository = this.repo
  ) {
    const htmlContent = (doc.content as Record<string, unknown>)?.html || '';
    await repo.saveVersion({
      id: randomUUID(),
      documentId: doc.id,
      versionNumber: doc.version,
      title: doc.title,
      editedBy: doc.ownerId || doc.createdBy || 'system',
      createdAt: new Date().toISOString(),
      contentSnapshot: htmlContent,
      status,
    });
  }

  async listKnowledgeAudits(
    filters: { operationType?: string; operatorId?: string; targetId?: string } = {}
  ) {
    if (this.repo.listKnowledgeAudits) {
      return this.repo.listKnowledgeAudits(filters);
    }
    return [];
  }
}
