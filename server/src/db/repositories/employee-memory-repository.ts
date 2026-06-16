import { eq, and, ilike, sql, desc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../schema/index.js';
import { employeeMemoryStores, employeeMemoryFragments, employeeMemoryRules } from '../schema/employee-memory.js';
import type {
  MemoryStore,
  MemoryFragment,
  MemoryRule,
  RetrievalConfig,
  FragmentType,
  MemoryRuleType,
  FragmentScope,
} from '../../contexts/employee-memory/domain/memory.js';

export class EmployeeMemoryRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  /* ──── Store ──── */

  async listStores(tenantId?: string): Promise<MemoryStore[]> {
    const rows = tenantId
      ? await this.db.select().from(employeeMemoryStores).where(eq(employeeMemoryStores.tenantId, tenantId))
      : await this.db.select().from(employeeMemoryStores);
    return rows.map(toStoreModel);
  }

  async findStoreById(id: string): Promise<MemoryStore | null> {
    const [row] = await this.db.select().from(employeeMemoryStores).where(eq(employeeMemoryStores.id, id)).limit(1);
    return row ? toStoreModel(row) : null;
  }

  async findStoreByInstanceId(instanceId: string): Promise<MemoryStore | null> {
    const [row] = await this.db
      .select()
      .from(employeeMemoryStores)
      .where(eq(employeeMemoryStores.instanceId, instanceId))
      .limit(1);
    return row ? toStoreModel(row) : null;
  }

  async saveStore(store: MemoryStore): Promise<void> {
    const values = toStoreRow(store);
    await this.db
      .insert(employeeMemoryStores)
      .values(values)
      .onConflictDoUpdate({ target: employeeMemoryStores.id, set: values });
  }

  async deleteStore(id: string): Promise<void> {
    // Cascade delete handled by FK ON DELETE CASCADE
    await this.db.delete(employeeMemoryStores).where(eq(employeeMemoryStores.id, id));
  }

  /* ──── Fragment ──── */

  async listFragments(
    storeId: string,
    opts?: { userId?: string; type?: FragmentType; keyword?: string; limit?: number; offset?: number; scope?: FragmentScope; departmentId?: string }
  ): Promise<MemoryFragment[]> {
    const conditions = [eq(employeeMemoryFragments.memoryStoreId, storeId)];
    if (opts?.scope) {
      conditions.push(eq(employeeMemoryFragments.scope, opts.scope));
      if (opts.scope === 'dept_shared' && opts.departmentId) {
        conditions.push(eq(employeeMemoryFragments.departmentId, opts.departmentId));
      }
    } else if (opts?.userId) {
      conditions.push(eq(employeeMemoryFragments.userId, opts.userId));
    }
    if (opts?.type) conditions.push(eq(employeeMemoryFragments.type, opts.type));
    if (opts?.keyword) {
      conditions.push(ilike(employeeMemoryFragments.content, `%${opts.keyword}%`));
    }

    let query = this.db
      .select()
      .from(employeeMemoryFragments)
      .where(and(...conditions))
      .orderBy(desc(employeeMemoryFragments.createdAt));

    if (opts?.limit) query = query.limit(opts.limit) as any;
    if (opts?.offset) query = query.offset(opts.offset) as any;

    const rows = await query;
    return rows.map(toFragmentModel);
  }

  async findFragmentById(id: string): Promise<MemoryFragment | null> {
    const [row] = await this.db.select().from(employeeMemoryFragments).where(eq(employeeMemoryFragments.id, id)).limit(1);
    return row ? toFragmentModel(row) : null;
  }

  async saveFragment(fragment: MemoryFragment): Promise<void> {
    const values = toFragmentRow(fragment);
    await this.db
      .insert(employeeMemoryFragments)
      .values(values)
      .onConflictDoUpdate({ target: employeeMemoryFragments.id, set: values });
  }

  async deleteFragment(id: string): Promise<void> {
    await this.db.delete(employeeMemoryFragments).where(eq(employeeMemoryFragments.id, id));
  }

  async incrementFragmentAccess(id: string): Promise<void> {
    await this.db
      .update(employeeMemoryFragments)
      .set({
        accessCount: sql`${employeeMemoryFragments.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(employeeMemoryFragments.id, id));
  }

  async countFragmentsByStore(storeId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeMemoryFragments)
      .where(eq(employeeMemoryFragments.memoryStoreId, storeId));
    return row?.count ?? 0;
  }

  async countDistinctUsersByStore(storeId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(distinct ${employeeMemoryFragments.userId})::int` })
      .from(employeeMemoryFragments)
      .where(eq(employeeMemoryFragments.memoryStoreId, storeId));
    return row?.count ?? 0;
  }

  async countFragmentsByScope(storeId: string, scope: FragmentScope): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeMemoryFragments)
      .where(
        and(
          eq(employeeMemoryFragments.memoryStoreId, storeId),
          eq(employeeMemoryFragments.scope, scope)
        )
      );
    return row?.count ?? 0;
  }

  /* ──── Rule ──── */

  async listRules(storeId: string, opts?: { ruleType?: MemoryRuleType }): Promise<MemoryRule[]> {
    const conditions = [eq(employeeMemoryRules.memoryStoreId, storeId)];
    if (opts?.ruleType) conditions.push(eq(employeeMemoryRules.ruleType, opts.ruleType));

    const rows = await this.db
      .select()
      .from(employeeMemoryRules)
      .where(and(...conditions))
      .orderBy(desc(employeeMemoryRules.priority));
    return rows.map(toRuleModel);
  }

  async findRuleById(id: string): Promise<MemoryRule | null> {
    const [row] = await this.db.select().from(employeeMemoryRules).where(eq(employeeMemoryRules.id, id)).limit(1);
    return row ? toRuleModel(row) : null;
  }

  async saveRule(rule: MemoryRule): Promise<void> {
    const values = toRuleRow(rule);
    await this.db
      .insert(employeeMemoryRules)
      .values(values)
      .onConflictDoUpdate({ target: employeeMemoryRules.id, set: values });
  }

  async deleteRule(id: string): Promise<void> {
    await this.db.delete(employeeMemoryRules).where(eq(employeeMemoryRules.id, id));
  }

  /* ──── Keyword Search ──── */

  async keywordSearch(
    storeId: string,
    keyword: string,
    opts?: { userId?: string; topK?: number; memoryTypes?: FragmentType[]; scope?: FragmentScope; departmentId?: string }
  ): Promise<(MemoryFragment & { keywordScore: number })[]> {
    const conditions = [
      eq(employeeMemoryFragments.memoryStoreId, storeId),
      ilike(employeeMemoryFragments.content, `%${keyword}%`),
    ];
    if (opts?.scope) {
      conditions.push(eq(employeeMemoryFragments.scope, opts.scope));
      if (opts.scope === 'dept_shared' && opts.departmentId) {
        conditions.push(eq(employeeMemoryFragments.departmentId, opts.departmentId));
      }
    } else if (opts?.userId) {
      conditions.push(eq(employeeMemoryFragments.userId, opts.userId));
    }
    if (opts?.memoryTypes?.length) {
      conditions.push(sql`${employeeMemoryFragments.type} = ANY(${opts.memoryTypes})`);
    }

    const limit = opts?.topK ?? 20;
    const rows = await this.db
      .select()
      .from(employeeMemoryFragments)
      .where(and(...conditions))
      .orderBy(desc(employeeMemoryFragments.importance))
      .limit(limit);

    return rows.map((r) => {
      const frag = toFragmentModel(r);
      // Keyword score: importance-based base score with time decay
      const ageDays = (Date.now() - new Date(frag.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-ageDays / 90); // 90-day half-life
      const keywordScore = (frag.importance / 10) * timeDecay;
      return { ...frag, keywordScore };
    });
  }
}

/* ──── Row → Model Mappers ──── */

function toStoreModel(row: typeof employeeMemoryStores.$inferSelect): MemoryStore {
  return {
    id: row.id,
    instanceId: row.instanceId,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description ?? '',
    retrievalConfig: (row.retrievalConfig ?? {}) as unknown as RetrievalConfig,
    status: row.status as MemoryStore['status'],
    totalFragments: row.totalFragments,
    totalProfiles: row.totalProfiles,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStoreRow(store: MemoryStore) {
  return {
    id: store.id,
    instanceId: store.instanceId,
    tenantId: store.tenantId,
    name: store.name,
    description: store.description,
    retrievalConfig: store.retrievalConfig as unknown as Record<string, unknown>,
    status: store.status,
    totalFragments: store.totalFragments,
    totalProfiles: store.totalProfiles,
    updatedAt: new Date(),
  };
}

function toFragmentModel(row: typeof employeeMemoryFragments.$inferSelect): MemoryFragment {
  return {
    id: row.id,
    memoryStoreId: row.memoryStoreId,
    tenantId: row.tenantId,
    userId: row.userId,
    scope: (row.scope ?? 'personal') as MemoryFragment['scope'],
    departmentId: row.departmentId ?? null,
    type: row.type as MemoryFragment['type'],
    content: row.content,
    source: row.source as MemoryFragment['source'],
    importance: row.importance,
    accessCount: row.accessCount,
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFragmentRow(frag: MemoryFragment) {
  return {
    id: frag.id,
    memoryStoreId: frag.memoryStoreId,
    tenantId: frag.tenantId,
    userId: frag.userId,
    scope: frag.scope,
    departmentId: frag.departmentId,
    type: frag.type,
    content: frag.content,
    source: frag.source,
    importance: frag.importance,
    accessCount: frag.accessCount,
    lastAccessedAt: frag.lastAccessedAt ? new Date(frag.lastAccessedAt) : null,
    expiresAt: frag.expiresAt ? new Date(frag.expiresAt) : null,
    metadata: frag.metadata,
    updatedAt: new Date(),
  };
}

function toRuleModel(row: typeof employeeMemoryRules.$inferSelect): MemoryRule {
  return {
    id: row.id,
    memoryStoreId: row.memoryStoreId,
    tenantId: row.tenantId,
    ruleType: row.ruleType as MemoryRule['ruleType'],
    name: row.name,
    description: row.description ?? '',
    trigger: (row.trigger ?? {}) as MemoryRule['trigger'],
    action: (row.action ?? {}) as MemoryRule['action'],
    priority: row.priority,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRuleRow(rule: MemoryRule) {
  return {
    id: rule.id,
    memoryStoreId: rule.memoryStoreId,
    tenantId: rule.tenantId,
    ruleType: rule.ruleType,
    name: rule.name,
    description: rule.description,
    trigger: rule.trigger as Record<string, unknown>,
    action: rule.action as Record<string, unknown>,
    priority: rule.priority,
    enabled: rule.enabled,
    updatedAt: new Date(),
  };
}
