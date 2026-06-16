import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../schema/index.js';
import { knowledgeEntries } from '../schema/knowledge.js';
import type { IKnowledgeEntryRepository } from '../../contexts/knowledge/knowledge-service.js';
import type { KnowledgeEntry, SyncStatus } from '../../contexts/knowledge/domain/knowledge.js';

export class KnowledgeEntryRepository implements IKnowledgeEntryRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async findByKbId(knowledgeBaseId: string): Promise<KnowledgeEntry[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.knowledgeBaseId, knowledgeBaseId));
    return rows.map((r) => this.toModel(r));
  }

  async findById(id: string): Promise<KnowledgeEntry | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.id, id))
      .limit(1);
    return rows[0] ? this.toModel(rows[0]) : null;
  }

  async findByDcfDocumentId(dcfDocumentId: string): Promise<KnowledgeEntry | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.dcfDocumentId, dcfDocumentId))
      .limit(1);
    return rows[0] ? this.toModel(rows[0]) : null;
  }

  async save(entry: KnowledgeEntry): Promise<void> {
    await this.db
      .insert(knowledgeEntries)
      .values({
        id: entry.id,
        knowledgeBaseId: entry.knowledgeBaseId,
        tenantId: entry.tenantId,
        wkKnowledgeId: entry.wkKnowledgeId,
        dcfDocumentId: entry.dcfDocumentId,
        title: entry.title,
        sourceType: entry.sourceType,
        parseStatus: entry.parseStatus,
        chunkCount: entry.chunkCount,
        fileSize: entry.fileSize,
      })
      .onConflictDoUpdate({
        target: knowledgeEntries.id,
        set: {
          title: entry.title,
          parseStatus: entry.parseStatus,
          chunkCount: entry.chunkCount,
          fileSize: entry.fileSize,
          updatedAt: new Date(),
        },
      });
  }

  async updateSyncStatus(id: string, status: SyncStatus): Promise<void> {
    await this.db
      .update(knowledgeEntries)
      .set({ parseStatus: status, updatedAt: new Date() })
      .where(eq(knowledgeEntries.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id));
  }

  private toModel(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry {
    return {
      id: row.id,
      knowledgeBaseId: row.knowledgeBaseId,
      tenantId: row.tenantId,
      wkKnowledgeId: row.wkKnowledgeId,
      dcfDocumentId: row.dcfDocumentId,
      title: row.title,
      sourceType: row.sourceType as KnowledgeEntry['sourceType'],
      parseStatus: row.parseStatus as KnowledgeEntry['parseStatus'],
      chunkCount: row.chunkCount,
      fileSize: row.fileSize,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
