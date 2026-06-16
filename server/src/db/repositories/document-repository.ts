import { eq, desc, and } from 'drizzle-orm';
import type { Database } from '../client.js';
import { documents, documentVersions, knowledgeAudits } from '../schema/document.js';
import type {
  IDocumentRepository,
  Document,
  DocumentVersion,
} from '../../contexts/document/document-service.js';

export class DocumentRepository implements IDocumentRepository {
  constructor(private db: Database) {}

  async listDocuments(roomId?: string): Promise<Document[]> {
    if (roomId) {
      const rows = await this.db.select().from(documents).where(eq(documents.roomId, roomId));
      return rows.map(toDocDomain);
    }
    const rows = await this.db.select().from(documents);
    return rows.map(toDocDomain);
  }

  async getDocument(id: string): Promise<Document | null> {
    const [row] = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return row ? toDocDomain(row) : null;
  }

  async saveDocument(doc: Document): Promise<void> {
    const values = toDocRow(doc);
    await this.db
      .insert(documents)
      .values(values)
      .onConflictDoUpdate({ target: documents.id, set: values });
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.db.delete(documents).where(eq(documents.id, id));
    return (result as unknown as { rowCount?: number }).rowCount !== 0;
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    const rows = await this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber));
    return rows.map(toVersionDomain);
  }

  async getVersion(versionId: string): Promise<DocumentVersion | null> {
    const [row] = await this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, versionId))
      .limit(1);
    return row ? toVersionDomain(row) : null;
  }

  async saveVersion(version: DocumentVersion): Promise<void> {
    await this.db.insert(documentVersions).values({
      id: version.id,
      documentId: version.documentId,
      versionNumber: version.versionNumber,
      title: version.title,
      editedBy: version.editedBy,
      contentSnapshot: version.contentSnapshot as Record<string, unknown> | undefined,
      status: version.status,
      createdAt: new Date(version.createdAt),
    });
  }

  async listDocumentPermissions(documentId: string): Promise<unknown[]> {
    const doc = await this.getDocument(documentId);
    return doc?.permissions ?? [];
  }

  async saveDocumentPermissions(documentId: string, permissions: unknown[]): Promise<void> {
    await this.db
      .update(documents)
      .set({ permissions: permissions as unknown[], updatedAt: new Date() })
      .where(eq(documents.id, documentId));
  }

  async listKnowledgeAudits(
    filters: { operationType?: string; operatorId?: string; targetId?: string } = {}
  ) {
    const conditions = [];
    if (filters.operationType)
      conditions.push(eq(knowledgeAudits.operationType, filters.operationType));
    if (filters.operatorId) conditions.push(eq(knowledgeAudits.operatorId, filters.operatorId));
    if (filters.targetId) conditions.push(eq(knowledgeAudits.targetId, filters.targetId));
    const q = this.db.select().from(knowledgeAudits).orderBy(desc(knowledgeAudits.timestamp));
    if (conditions.length > 0) return q.where(and(...conditions));
    return q;
  }

  async appendKnowledgeAudit(entry: Record<string, unknown>): Promise<void> {
    await this.db.insert(knowledgeAudits).values({
      id: String(entry.id),
      operationType: String(entry.operationType),
      operatorId: String(entry.operatorId),
      operatorName: String(entry.operatorName),
      targetId: String(entry.targetId),
      targetName: String(entry.targetName ?? ''),
      timestamp: entry.timestamp ? new Date(String(entry.timestamp)) : new Date(),
    });
  }
}

function toDocDomain(row: typeof documents.$inferSelect): Document {
  return {
    id: row.id,
    roomId: row.roomId ?? null,
    type: row.type,
    title: row.title,
    content: (row.content ?? {}) as Record<string, unknown>,
    status: row.status,
    categoryId: row.categoryId ?? null,
    departmentId: row.departmentId ?? null,
    ownerId: row.ownerId,
    permissions: (row.permissions ?? []) as unknown[],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
    publishedAt: row.publishedAt?.toISOString(),
    submittedAt: row.submittedAt?.toISOString(),
    reviewedBy: row.reviewedBy ?? null,
    reviewComment: row.reviewComment ?? undefined,
  };
}

function toDocRow(doc: Document) {
  return {
    id: doc.id,
    roomId: doc.roomId,
    type: doc.type,
    title: doc.title,
    content: doc.content as Record<string, unknown>,
    status: doc.status,
    categoryId: doc.categoryId,
    departmentId: doc.departmentId,
    ownerId: doc.ownerId,
    permissions: doc.permissions as unknown[],
    createdBy: doc.createdBy,
    version: doc.version,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt) : null,
    submittedAt: doc.submittedAt ? new Date(doc.submittedAt) : null,
    reviewedBy: doc.reviewedBy ?? null,
    reviewComment: doc.reviewComment ?? null,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

function toVersionDomain(row: typeof documentVersions.$inferSelect): DocumentVersion {
  return {
    id: row.id,
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    title: row.title,
    editedBy: row.editedBy,
    createdAt: row.createdAt.toISOString(),
    contentSnapshot: row.contentSnapshot,
    status: row.status,
  };
}
