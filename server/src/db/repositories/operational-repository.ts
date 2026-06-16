import { eq, count } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  notifications,
  pushChannels,
  toolConfigs,
  aiBudgets,
  aiFailoverChains,
  workspaces,
} from '../schema/operational.js';

type AnyTable =
  | typeof notifications
  | typeof pushChannels
  | typeof toolConfigs
  | typeof aiBudgets
  | typeof aiFailoverChains
  | typeof workspaces;

const tableMap = {
  notification: notifications,
  push_channel: pushChannels,
  tool_config: toolConfigs,
  ai_budget: aiBudgets,
  ai_failover_chain: aiFailoverChains,
  workspace: workspaces,
} as const;

type EntityType = keyof typeof tableMap;

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

export class OperationalRepository {
  constructor(private db: Database) {}

  async list(type: EntityType): Promise<Record<string, unknown>[]> {
    const table = tableMap[type] as AnyTable;
    const rows = await this.db.select().from(table);
    return rows.map((r) => {
      const { data, ...rest } = r as Record<string, unknown>;
      return { ...rest, ...(data as Record<string, unknown>) };
    });
  }

  async listPaged(
    type: EntityType,
    opts?: PageOptions
  ): Promise<PagedResult<Record<string, unknown>>> {
    const table = tableMap[type] as AnyTable;
    const limit = clampLimit(opts?.limit);
    const offset = Math.max(0, opts?.offset ?? 0);

    const [totalRow] = await this.db.select({ value: count() }).from(table);

    const rows = await this.db.select().from(table).limit(limit).offset(offset);

    return {
      items: rows.map((r) => {
        const { data, ...rest } = r as Record<string, unknown>;
        return { ...rest, ...(data as Record<string, unknown>) };
      }),
      total: totalRow?.value ?? 0,
      limit,
      offset,
    };
  }

  async get(type: EntityType, id: string): Promise<Record<string, unknown> | null> {
    const table = tableMap[type] as AnyTable;
    const [row] = await this.db
      .select()
      .from(table)
      .where(eq((table as typeof notifications).id, id));
    if (!row) return null;
    const { data, ...rest } = row as Record<string, unknown>;
    return { ...rest, ...(data as Record<string, unknown>) };
  }

  async upsert(type: EntityType, id: string, record: Record<string, unknown>): Promise<void> {
    const table = tableMap[type] as AnyTable;
    const { id: _id, createdAt: _ca, ...data } = record;
    const existing = await this.db
      .select({ id: (table as typeof notifications).id })
      .from(table)
      .where(eq((table as typeof notifications).id, id));

    if (existing.length > 0) {
      await this.db
        .update(table)
        .set({ data } as never)
        .where(eq((table as typeof notifications).id, id));
    } else {
      await this.db.insert(table).values({ id, data } as never);
    }
  }

  async remove(type: EntityType, id: string): Promise<boolean> {
    const table = tableMap[type] as AnyTable;
    const result = await this.db.delete(table).where(eq((table as typeof notifications).id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }
}
