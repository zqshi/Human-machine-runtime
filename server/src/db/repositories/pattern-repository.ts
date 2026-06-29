import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { patterns } from '../schema/cockpit-signals.js';
import { Pattern, type PatternType } from '../../contexts/cockpit/domain/sensing/pattern.js';

export interface PatternListOptions {
  patternType?: PatternType;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type PatternRow = InferSelectModel<typeof patterns>;

export class PatternRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Pattern | null> {
    const rows = await this.db.select().from(patterns).where(eq(patterns.id, id)).limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async list(opts: PatternListOptions = {}): Promise<Pattern[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.patternType) conds.push(eq(patterns.patternType, opts.patternType));
    if (opts.tenantId) conds.push(eq(patterns.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(patterns).where(where)
      : this.db.select().from(patterns);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(patterns.createdAt));
    return rows.map((r) => this.mapRow(r));
  }

  async listPaged(
    opts: PatternListOptions = {}
  ): Promise<{ items: Pattern[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ patternType: opts.patternType, tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(opts: { patternType?: string; tenantId?: string } = {}): Promise<number> {
    const conds = [];
    if (opts.patternType) conds.push(eq(patterns.patternType, opts.patternType));
    if (opts.tenantId) conds.push(eq(patterns.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(patterns)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(patterns);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  async save(pattern: Pattern): Promise<void> {
    const p = pattern.toProps();
    const existing = await this.db
      .select({ id: patterns.id })
      .from(patterns)
      .where(eq(patterns.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(patterns)
        .set({
          patternType: p.patternType,
          pattern: p.pattern,
          data: p.data,
          tenantId: p.tenantId,
        })
        .where(eq(patterns.id, p.id));
    } else {
      await this.db.insert(patterns).values({
        id: p.id,
        patternType: p.patternType,
        pattern: p.pattern,
        data: p.data,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(patterns).where(eq(patterns.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: PatternRow): Pattern {
    return Pattern.fromProps({
      id: row.id,
      patternType: row.patternType as PatternType,
      pattern: row.pattern ?? undefined,
      data: (row.data as Record<string, unknown>) ?? {},
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
    });
  }
}
