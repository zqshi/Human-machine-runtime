import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../schema/index.js';
import { weknoTenantMappings } from '../schema/knowledge.js';
import { newId, nowIso } from '../../shared/utils.js';

export interface WkTenantMapping {
  id: string;
  hmrTenantId: string;
  wkTenantId: string;
  wkUserId: string;
  wkApiKey: string;
  wkBaseUrl: string | null;
  status: string;
  defaultKbId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IWkMappingRepository {
  getByHmrTenantId(hmrTenantId: string): Promise<WkTenantMapping | null>;
  save(mapping: WkTenantMapping): Promise<void>;
  updateApiKey(hmrTenantId: string, apiKey: string): Promise<void>;
  updateDefaultKbId(hmrTenantId: string, kbId: string): Promise<void>;
  updateStatus(hmrTenantId: string, status: string): Promise<void>;
  delete(hmrTenantId: string): Promise<void>;
  listAll(): Promise<WkTenantMapping[]>;
}

export class WkMappingRepository implements IWkMappingRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async getByHmrTenantId(hmrTenantId: string): Promise<WkTenantMapping | null> {
    const rows = await this.db
      .select()
      .from(weknoTenantMappings)
      .where(eq(weknoTenantMappings.hmrTenantId, hmrTenantId))
      .limit(1);
    return rows[0] ? this.toModel(rows[0]) : null;
  }

  async save(mapping: WkTenantMapping): Promise<void> {
    await this.db
      .insert(weknoTenantMappings)
      .values({
        id: mapping.id || newId('wkm'),
        hmrTenantId: mapping.hmrTenantId,
        wkTenantId: mapping.wkTenantId,
        wkUserId: mapping.wkUserId,
        wkApiKey: mapping.wkApiKey,
        wkBaseUrl: mapping.wkBaseUrl,
        status: mapping.status || 'active',
        defaultKbId: mapping.defaultKbId,
      })
      .onConflictDoUpdate({
        target: weknoTenantMappings.hmrTenantId,
        set: {
          wkTenantId: mapping.wkTenantId,
          wkUserId: mapping.wkUserId,
          wkApiKey: mapping.wkApiKey,
          wkBaseUrl: mapping.wkBaseUrl,
          status: mapping.status,
          defaultKbId: mapping.defaultKbId,
          updatedAt: new Date(),
        },
      });
  }

  async updateApiKey(hmrTenantId: string, apiKey: string): Promise<void> {
    await this.db
      .update(weknoTenantMappings)
      .set({ wkApiKey: apiKey, updatedAt: new Date() })
      .where(eq(weknoTenantMappings.hmrTenantId, hmrTenantId));
  }

  async updateDefaultKbId(hmrTenantId: string, kbId: string): Promise<void> {
    await this.db
      .update(weknoTenantMappings)
      .set({ defaultKbId: kbId, updatedAt: new Date() })
      .where(eq(weknoTenantMappings.hmrTenantId, hmrTenantId));
  }

  async updateStatus(hmrTenantId: string, status: string): Promise<void> {
    await this.db
      .update(weknoTenantMappings)
      .set({ status, updatedAt: new Date() })
      .where(eq(weknoTenantMappings.hmrTenantId, hmrTenantId));
  }

  async delete(hmrTenantId: string): Promise<void> {
    await this.db
      .delete(weknoTenantMappings)
      .where(eq(weknoTenantMappings.hmrTenantId, hmrTenantId));
  }

  async listAll(): Promise<WkTenantMapping[]> {
    const rows = await this.db.select().from(weknoTenantMappings);
    return rows.map((r) => this.toModel(r));
  }

  private toModel(row: typeof weknoTenantMappings.$inferSelect): WkTenantMapping {
    return {
      id: row.id,
      hmrTenantId: row.hmrTenantId,
      wkTenantId: row.wkTenantId,
      wkUserId: row.wkUserId,
      wkApiKey: row.wkApiKey,
      wkBaseUrl: row.wkBaseUrl,
      status: row.status,
      defaultKbId: row.defaultKbId,
      createdAt: row.createdAt?.toISOString() || nowIso(),
      updatedAt: row.updatedAt?.toISOString() || nowIso(),
    };
  }
}
