import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../schema/index.js';
import { knowledgeBases } from '../schema/knowledge.js';
import type { IKnowledgeBaseRepository } from '../../contexts/knowledge/knowledge-service.js';
import type {
  KnowledgeBase,
  ChunkingConfig,
  RetrievalConfig,
} from '../../contexts/knowledge/domain/knowledge.js';

export class KnowledgeBaseRepository implements IKnowledgeBaseRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async findByTenantId(tenantId: string): Promise<KnowledgeBase[]> {
    const rows = await this.db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.tenantId, tenantId));
    return rows.map((r) => this.toModel(r));
  }

  async findById(id: string): Promise<KnowledgeBase | null> {
    const rows = await this.db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, id))
      .limit(1);
    return rows[0] ? this.toModel(rows[0]) : null;
  }

  async findByWkId(wkKnowledgeBaseId: string): Promise<KnowledgeBase | null> {
    const rows = await this.db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.wkKnowledgeBaseId, wkKnowledgeBaseId))
      .limit(1);
    return rows[0] ? this.toModel(rows[0]) : null;
  }

  async save(kb: KnowledgeBase): Promise<void> {
    await this.db
      .insert(knowledgeBases)
      .values({
        id: kb.id,
        tenantId: kb.tenantId,
        wkKnowledgeBaseId: kb.wkKnowledgeBaseId,
        name: kb.name,
        description: kb.description,
        type: kb.type,
        status: kb.status,
        embeddingModelId: kb.embeddingModelId,
        chunkingConfig: kb.chunkingConfig as unknown as Record<string, unknown>,
        retrievalConfig: kb.retrievalConfig as unknown as Record<string, unknown>,
        documentCount: kb.documentCount,
        boundInstanceIds: kb.boundInstanceIds,
      })
      .onConflictDoUpdate({
        target: knowledgeBases.id,
        set: {
          name: kb.name,
          description: kb.description,
          type: kb.type,
          status: kb.status,
          embeddingModelId: kb.embeddingModelId,
          chunkingConfig: kb.chunkingConfig as unknown as Record<string, unknown>,
          retrievalConfig: kb.retrievalConfig as unknown as Record<string, unknown>,
          documentCount: kb.documentCount,
          boundInstanceIds: kb.boundInstanceIds,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
  }

  private toModel(row: typeof knowledgeBases.$inferSelect): KnowledgeBase {
    return {
      id: row.id,
      tenantId: row.tenantId,
      wkKnowledgeBaseId: row.wkKnowledgeBaseId,
      name: row.name,
      description: row.description,
      type: row.type as KnowledgeBase['type'],
      status: row.status as KnowledgeBase['status'],
      embeddingModelId: row.embeddingModelId,
      chunkingConfig: (row.chunkingConfig || {}) as unknown as ChunkingConfig,
      retrievalConfig: (row.retrievalConfig || {}) as unknown as RetrievalConfig,
      documentCount: row.documentCount,
      boundInstanceIds: (row.boundInstanceIds || []) as string[],
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
