import { desc } from 'drizzle-orm';
import type { Database } from '../client.js';
import { auditLogs } from '../schema/audit.js';
import type { IAuditRepository } from '../../contexts/audit-observability/audit-service.js';
import type { AuditEvent } from '../../contexts/audit-observability/audit-service.js';

export class AuditRepository implements IAuditRepository {
  constructor(private db: Database) {}

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.db.insert(auditLogs).values({
      scope: event.context?.scope ? String(event.context.scope) : 'system',
      module: event.type.split('.')[0] ?? null,
      operation: event.action || event.type,
      status: 'ok',
      actorId: event.actor?.username ?? null,
      actorName: event.actor?.username ?? null,
      resourceId: event.target ? String((event.target as Record<string, unknown>).id ?? '') : null,
      resourceType: event.type,
      details: event as unknown as Record<string, unknown>,
      ipAddress: event.where?.ip ?? null,
      userAgent: event.where?.userAgent ?? null,
      createdAt: new Date(event.at),
    });
  }

  async listAudits(limit: number): Promise<AuditEvent[]> {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return rows.map(toAuditEvent);
  }

  async pruneAudits(opts: {
    ttlMs: number;
    maxRows: number;
    archiveEnabled: boolean;
    archiveMaxRows: number;
  }) {
    const allRows = await this.db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
    const before = allRows.length;
    let deleted = 0;

    if (opts.ttlMs > 0) {
      const cutoff = Date.now() - opts.ttlMs;
      for (const row of allRows) {
        if (row.createdAt.getTime() < cutoff) {
          const { eq } = await import('drizzle-orm');
          await this.db.delete(auditLogs).where(eq(auditLogs.id, row.id));
          deleted++;
        }
      }
    }

    if (opts.maxRows > 0 && before - deleted > opts.maxRows) {
      const excess = before - deleted - opts.maxRows;
      const toDelete = allRows.slice(allRows.length - excess);
      for (const row of toDelete) {
        const { eq } = await import('drizzle-orm');
        await this.db.delete(auditLogs).where(eq(auditLogs.id, row.id));
        deleted++;
      }
    }

    return { before, kept: before - deleted, archived: 0, deleted };
  }
}

function toAuditEvent(row: typeof auditLogs.$inferSelect): AuditEvent {
  const details = (row.details ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    type: row.resourceType ?? row.operation,
    payload: (details.payload as Record<string, unknown>) ?? details,
    at: row.createdAt.toISOString(),
    requestId: String(details.requestId ?? ''),
    traceId: String(details.traceId ?? ''),
    correlationId: String(details.correlationId ?? ''),
    actor: row.actorId ? { username: row.actorId, role: String(details.actorRole ?? '') } : null,
    context: (details.context ?? {}) as Record<string, unknown>,
    where: { ip: row.ipAddress ?? '', userAgent: row.userAgent ?? '' },
    target: (details.target ?? null) as Record<string, unknown> | null,
    action: row.operation,
    result: (details.result ?? null) as Record<string, unknown> | null,
  };
}
