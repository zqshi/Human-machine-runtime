import { newId, nowIso } from '../../shared/utils.js';

export interface AuditEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  at: string;
  requestId: string;
  traceId: string;
  correlationId: string;
  actor: { username: string; role: string } | null;
  context: Record<string, unknown>;
  where: { ip: string; userAgent: string };
  target: Record<string, unknown> | null;
  action: string;
  result: Record<string, unknown> | null;
}

export interface AuditFilters {
  type?: string;
  actor?: string;
  tenantId?: string;
  instanceId?: string;
  from?: string;
  to?: string;
  sinceId?: string;
  sinceAt?: string;
  untilAt?: string;
}

export interface IAuditRepository {
  appendAudit(event: AuditEvent): Promise<void>;
  listAudits(limit: number): Promise<AuditEvent[]>;
  pruneAudits(opts: PruneOptions): Promise<PruneStats>;
}

interface PruneOptions {
  ttlMs: number;
  maxRows: number;
  archiveEnabled: boolean;
  archiveMaxRows: number;
}

interface PruneStats {
  before: number;
  kept: number;
  archived: number;
  deleted: number;
}

interface PageResult {
  rows: AuditEvent[];
  total: number;
  cursor: string;
  nextCursor: string | null;
  hasMore: boolean;
}

export class AuditService {
  private repo: IAuditRepository;
  private retention: {
    ttlDays: number;
    maxRows: number;
    archiveEnabled: boolean;
    archiveMaxRows: number;
  };

  constructor(
    repo: IAuditRepository,
    options: {
      retentionTtlDays?: number;
      retentionMaxRows?: number;
      archiveEnabled?: boolean;
      archiveMaxRows?: number;
    } = {}
  ) {
    this.repo = repo;
    this.retention = {
      ttlDays: Math.max(0, Number(options.retentionTtlDays || 0)),
      maxRows: Math.max(0, Number(options.retentionMaxRows || 0)),
      archiveEnabled: options.archiveEnabled !== false,
      archiveMaxRows: Math.max(0, Number(options.archiveMaxRows || 0)),
    };
  }

  private normalizeTime(input: unknown): number | null {
    if (!input) return null;
    const ts = Date.parse(String(input));
    return Number.isFinite(ts) ? ts : null;
  }

  private normalizeCursor(input: unknown): number {
    const raw = String(input || '').trim();
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  private encodeCursor(offset: number): string {
    return String(Math.max(0, Math.floor(offset)));
  }

  private matchesFilters(event: AuditEvent, filters: AuditFilters): boolean {
    if (filters.type && event.type !== filters.type) return false;
    if (filters.actor) {
      const eventActor = event.actor?.username || '';
      if (eventActor !== filters.actor) return false;
    }
    if (filters.tenantId) {
      const p = event.payload || {};
      if (String((p as Record<string, unknown>).tenantId || '') !== filters.tenantId) return false;
    }
    if (filters.instanceId) {
      const p = (event.payload || {}) as Record<string, unknown>;
      const eid = String(p.instanceId || p.sourceInstanceId || '');
      if (eid !== filters.instanceId) return false;
    }
    const atTs = this.normalizeTime(event.at);
    const fromTs = this.normalizeTime(filters.from);
    const toTs = this.normalizeTime(filters.to);
    if (fromTs && atTs && atTs < fromTs) return false;
    if (toTs && atTs && atTs > toTs) return false;
    return true;
  }

  async log(
    type: string,
    payload: Record<string, unknown>,
    metadata: {
      actor?: { username: string; role: string };
      requestId?: string;
      traceId?: string;
      correlationId?: string;
      ip?: string;
      userAgent?: string;
      context?: Record<string, unknown>;
      target?: Record<string, unknown>;
      action?: string;
      result?: Record<string, unknown>;
    } = {}
  ): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: newId('audit'),
      type,
      payload: payload || {},
      at: nowIso(),
      requestId: String(metadata.requestId || ''),
      traceId: String(metadata.traceId || ''),
      correlationId: String(metadata.correlationId || ''),
      actor: metadata.actor || null,
      context: metadata.context || {},
      where: { ip: String(metadata.ip || ''), userAgent: String(metadata.userAgent || '') },
      target: metadata.target || null,
      action: String(metadata.action || type),
      result: metadata.result || null,
    };
    await this.repo.appendAudit(event);
    return event;
  }

  async queryPage(
    limit = 100,
    filters: AuditFilters = {},
    cursor: unknown = 0
  ): Promise<PageResult> {
    const effectiveLimit = Math.max(1, Math.min(5000, Number(limit || 100)));
    const offset = this.normalizeCursor(cursor);
    const rows = await this.repo.listAudits(5000);

    let filtered = rows;
    const sinceAtTs = this.normalizeTime(filters.sinceAt);
    const untilAtTs = this.normalizeTime(filters.untilAt);
    if (sinceAtTs)
      filtered = filtered.filter((x) => {
        const t = this.normalizeTime(x.at);
        return !t || t >= sinceAtTs;
      });
    if (untilAtTs)
      filtered = filtered.filter((x) => {
        const t = this.normalizeTime(x.at);
        return !t || t <= untilAtTs;
      });
    filtered = filtered.filter((event) => this.matchesFilters(event, filters));

    const page = filtered.slice(offset, offset + effectiveLimit);
    const nextOffset = offset + page.length;
    const hasMore = nextOffset < filtered.length;
    return {
      rows: page,
      total: filtered.length,
      cursor: this.encodeCursor(offset),
      nextCursor: hasMore ? this.encodeCursor(nextOffset) : null,
      hasMore,
    };
  }

  async list(limit = 100, filters: AuditFilters = {}): Promise<AuditEvent[]> {
    const page = await this.queryPage(limit, filters, 0);
    return page.rows;
  }

  async export(limit = 1000, filters: AuditFilters = {}, format = 'json', cursor: unknown = 0) {
    const page = await this.queryPage(limit, filters, cursor);
    if (format === 'ndjson') {
      return {
        contentType: 'application/x-ndjson; charset=utf-8',
        body: page.rows.map((e) => JSON.stringify(e)).join('\n'),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        total: page.total,
      };
    }
    return {
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(
        {
          success: true,
          data: page.rows,
          total: page.total,
          cursor: page.cursor,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        },
        null,
        2
      ),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
    };
  }

  async pruneRetention(trigger = 'manual') {
    const ttlMs = this.retention.ttlDays > 0 ? this.retention.ttlDays * 86400000 : 0;
    const stats = await this.repo.pruneAudits({
      ttlMs,
      maxRows: this.retention.maxRows,
      archiveEnabled: this.retention.archiveEnabled,
      archiveMaxRows: this.retention.archiveMaxRows,
    });
    await this.log('audit.retention.pruned', { trigger, ...this.retention, ...stats });
    return stats;
  }
}
