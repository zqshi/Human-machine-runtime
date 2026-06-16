import { eq, and, count } from 'drizzle-orm';
import type { Database } from '../client.js';
import { openclawEntities } from '../schema/operational.js';

export interface PageOptions {
  limit?: number;
  offset?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function clampLimit(raw?: number): number {
  if (!raw || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

export class OpenclawRepository {
  constructor(private db: Database) {}

  async list(entityType: string): Promise<Record<string, unknown>[]> {
    const rows = await this.db
      .select()
      .from(openclawEntities)
      .where(eq(openclawEntities.entityType, entityType));
    return rows.map((r) => ({ id: r.id, ...(r.data as Record<string, unknown>) }));
  }

  async listPaged(
    entityType: string,
    opts?: PageOptions
  ): Promise<PagedResult<Record<string, unknown>>> {
    const limit = clampLimit(opts?.limit);
    const offset = Math.max(0, opts?.offset ?? 0);

    const [totalRow] = await this.db
      .select({ value: count() })
      .from(openclawEntities)
      .where(eq(openclawEntities.entityType, entityType));

    const rows = await this.db
      .select()
      .from(openclawEntities)
      .where(eq(openclawEntities.entityType, entityType))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map((r) => ({ id: r.id, ...(r.data as Record<string, unknown>) })),
      total: totalRow?.value ?? 0,
      limit,
      offset,
    };
  }

  async get(entityType: string, id: string): Promise<Record<string, unknown> | null> {
    const [row] = await this.db
      .select()
      .from(openclawEntities)
      .where(and(eq(openclawEntities.id, id), eq(openclawEntities.entityType, entityType)));
    if (!row) return null;
    return { id: row.id, ...(row.data as Record<string, unknown>) };
  }

  async upsert(entityType: string, id: string, data: Record<string, unknown>): Promise<void> {
    const { id: _id, ...rest } = data;
    const existing = await this.db
      .select({ id: openclawEntities.id })
      .from(openclawEntities)
      .where(eq(openclawEntities.id, id));

    if (existing.length > 0) {
      await this.db
        .update(openclawEntities)
        .set({ data: rest, updatedAt: new Date() })
        .where(eq(openclawEntities.id, id));
    } else {
      await this.db.insert(openclawEntities).values({ id, entityType, data: rest });
    }
  }

  async remove(entityType: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(openclawEntities)
      .where(and(eq(openclawEntities.id, id), eq(openclawEntities.entityType, entityType)));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }
}
