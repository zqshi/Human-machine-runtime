import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { judgmentRecords } from '../schema/cockpit-decisions.js';
import {
  JudgmentRecord,
  type DecisionSource,
} from '../../contexts/cockpit/domain/judgment/judgment-record.js';

/**
 * judgment_records 表的 DB 实现（v2.1 EAOS 判断子系统）。
 *
 * 返回 JudgmentRecord domain 实体（fromProps 重建，校验 source/action 不变式）。
 * 分页 + filter 下推 DB（§7.2.1#2）。createdAt/respondedAt 是 bigint(ms)。
 */
export interface JudgmentRecordListOptions {
  decisionId?: string;
  source?: DecisionSource;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type JudgmentRecordRow = InferSelectModel<typeof judgmentRecords>;

export class JudgmentRecordRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<JudgmentRecord | null> {
    const rows = await this.db
      .select()
      .from(judgmentRecords)
      .where(eq(judgmentRecords.id, id))
      .limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 createdAt 倒序）。 */
  async list(opts: JudgmentRecordListOptions = {}): Promise<JudgmentRecord[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.decisionId) conds.push(eq(judgmentRecords.decisionId, opts.decisionId));
    if (opts.source) conds.push(eq(judgmentRecords.source, opts.source));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(judgmentRecords).where(where)
      : this.db.select().from(judgmentRecords);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(judgmentRecords.createdAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: JudgmentRecordListOptions = {}
  ): Promise<{ items: JudgmentRecord[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ decisionId: opts.decisionId, source: opts.source }),
    ]);
    return { items, total, limit, offset };
  }

  async count(opts: { decisionId?: string; source?: string } = {}): Promise<number> {
    const conds = [];
    if (opts.decisionId) conds.push(eq(judgmentRecords.decisionId, opts.decisionId));
    if (opts.source) conds.push(eq(judgmentRecords.source, opts.source));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(judgmentRecords)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(judgmentRecords);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update，不存在则 insert。 */
  async save(record: JudgmentRecord): Promise<void> {
    const p = record.toProps();
    const existing = await this.db
      .select({ id: judgmentRecords.id })
      .from(judgmentRecords)
      .where(eq(judgmentRecords.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(judgmentRecords)
        .set({
          decisionId: p.decisionId,
          source: p.source,
          action: p.action,
          selectedOptionId: p.selectedOptionId,
          feedback: p.feedback,
          respondedAt: p.respondedAt,
          createdAt: p.createdAt,
          contextSnapshot: p.contextSnapshot,
        })
        .where(eq(judgmentRecords.id, p.id));
    } else {
      await this.db.insert(judgmentRecords).values({
        id: p.id,
        decisionId: p.decisionId,
        source: p.source,
        action: p.action,
        selectedOptionId: p.selectedOptionId,
        feedback: p.feedback,
        respondedAt: p.respondedAt,
        createdAt: p.createdAt,
        contextSnapshot: p.contextSnapshot,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(judgmentRecords).where(eq(judgmentRecords.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: JudgmentRecordRow): JudgmentRecord {
    // DB 脏数据（旧 EAV 迁入的非法枚举）用 rehydrate 容错，避免 list 整体抛错。
    return JudgmentRecord.rehydrate({
      id: row.id,
      decisionId: row.decisionId ?? '',
      source: row.source,
      action: row.action,
      selectedOptionId: row.selectedOptionId ?? undefined,
      feedback: row.feedback ?? undefined,
      respondedAt: row.respondedAt,
      createdAt: row.createdAt,
      contextSnapshot: row.contextSnapshot,
    });
  }
}
