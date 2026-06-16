import { describe, it, expect, vi } from 'vitest';
import { AuditService, type IAuditRepository, type AuditEvent } from './audit-service.js';

function makeRepo(): IAuditRepository & { events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  return {
    events,
    appendAudit: vi.fn(async (e: AuditEvent) => {
      events.push(e);
    }),
    listAudits: vi.fn(async () => [...events]),
    pruneAudits: vi.fn(async () => ({
      before: events.length,
      kept: events.length,
      archived: 0,
      deleted: 0,
    })),
  };
}

describe('AuditService', () => {
  describe('log', () => {
    it('creates an event with required fields', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      const event = await svc.log(
        'test.action',
        { key: 'val' },
        { actor: { username: 'u1', role: 'admin' } }
      );
      expect(event.id).toMatch(/^audit_/);
      expect(event.type).toBe('test.action');
      expect(event.payload).toEqual({ key: 'val' });
      expect(event.actor!.username).toBe('u1');
      expect(event.at).toBeTruthy();
      expect(repo.appendAudit).toHaveBeenCalledTimes(1);
    });

    it('defaults metadata fields', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      const event = await svc.log('x', {});
      expect(event.actor).toBeNull();
      expect(event.requestId).toBe('');
      expect(event.where.ip).toBe('');
      expect(event.action).toBe('x');
    });
  });

  describe('queryPage', () => {
    it('returns paginated results', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      for (let i = 0; i < 5; i++) await svc.log(`type.${i}`, { i });
      const page = await svc.queryPage(2, {}, 0);
      expect(page.rows).toHaveLength(2);
      expect(page.total).toBe(5);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe('2');
    });

    it('returns empty for offset past end', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      await svc.log('x', {});
      const page = await svc.queryPage(10, {}, 100);
      expect(page.rows).toHaveLength(0);
      expect(page.hasMore).toBe(false);
    });

    it('filters by type', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      await svc.log('auth.login', {});
      await svc.log('instance.created', {});
      await svc.log('auth.login', {});
      const page = await svc.queryPage(100, { type: 'auth.login' });
      expect(page.total).toBe(2);
      expect(page.rows.every((r) => r.type === 'auth.login')).toBe(true);
    });

    it('filters by actor', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      await svc.log('x', {}, { actor: { username: 'alice', role: 'admin' } });
      await svc.log('x', {}, { actor: { username: 'bob', role: 'ops' } });
      const page = await svc.queryPage(100, { actor: 'alice' });
      expect(page.total).toBe(1);
      expect(page.rows[0].actor!.username).toBe('alice');
    });
  });

  describe('list', () => {
    it('delegates to queryPage', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      await svc.log('a', {});
      await svc.log('b', {});
      const rows = await svc.list(100);
      expect(rows).toHaveLength(2);
    });
  });

  describe('export', () => {
    it('exports as JSON by default', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      await svc.log('x', {});
      const result = await svc.export(100, {}, 'json');
      expect(result.contentType).toContain('application/json');
      expect(result.total).toBe(1);
    });

    it('exports as NDJSON', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo);
      await svc.log('a', {});
      await svc.log('b', {});
      const result = await svc.export(100, {}, 'ndjson');
      expect(result.contentType).toContain('ndjson');
      const lines = result.body.split('\n');
      expect(lines).toHaveLength(2);
    });
  });

  describe('pruneRetention', () => {
    it('calls repo.pruneAudits and logs the event', async () => {
      const repo = makeRepo();
      const svc = new AuditService(repo, { retentionTtlDays: 30, retentionMaxRows: 1000 });
      const stats = await svc.pruneRetention('test');
      expect(repo.pruneAudits).toHaveBeenCalledTimes(1);
      expect(stats.before).toBeDefined();
      expect(repo.events.some((e) => e.type === 'audit.retention.pruned')).toBe(true);
    });
  });
});
