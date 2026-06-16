import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from './notification-service.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';

function mockRepo(items: Record<string, unknown>[] = []): OperationalRepository {
  const store = new Map(items.map((i) => [i.id as string, { ...i }]));
  return {
    list: vi.fn(async () => Array.from(store.values())),
    get: vi.fn(async (_ns: string, id: string) => store.get(id) ?? null),
    upsert: vi.fn(async (_ns: string, id: string, data: Record<string, unknown>) => {
      store.set(id, data);
    }),
    remove: vi.fn(async (_ns: string, id: string) => {
      store.delete(id);
    }),
  } as unknown as OperationalRepository;
}

describe('NotificationService', () => {
  it('list returns items with unread count', async () => {
    const repo = mockRepo([
      { id: 'n1', read: false },
      { id: 'n2', read: true },
    ]);
    const svc = new NotificationService(repo);
    const result = await svc.list();
    expect(result.items).toHaveLength(2);
    expect(result.summary).toEqual({ unread: 1, total: 2 });
  });

  it('getUnreadCount returns counts', async () => {
    const repo = mockRepo([
      { id: 'n1', read: false },
      { id: 'n2', read: false },
    ]);
    const svc = new NotificationService(repo);
    expect(await svc.getUnreadCount()).toEqual({ unread: 2, total: 2 });
  });

  it('markRead sets read=true', async () => {
    const repo = mockRepo([{ id: 'n1', read: false }]);
    const svc = new NotificationService(repo);
    await svc.markRead('n1');
    expect(repo.upsert).toHaveBeenCalledWith(
      'notification',
      'n1',
      expect.objectContaining({ read: true })
    );
  });

  it('dismiss removes the notification', async () => {
    const repo = mockRepo([{ id: 'n1' }]);
    const svc = new NotificationService(repo);
    await svc.dismiss('n1');
    expect(repo.remove).toHaveBeenCalledWith('notification', 'n1');
  });

  it('snooze sets snoozedUntil', async () => {
    const repo = mockRepo([{ id: 'n1' }]);
    const svc = new NotificationService(repo);
    await svc.snooze('n1', 2);
    expect(repo.upsert).toHaveBeenCalledWith(
      'notification',
      'n1',
      expect.objectContaining({ snoozedUntil: expect.any(String) })
    );
  });

  it('escalate sets escalated=true', async () => {
    const repo = mockRepo([{ id: 'n1' }]);
    const svc = new NotificationService(repo);
    await svc.escalate('n1');
    expect(repo.upsert).toHaveBeenCalledWith(
      'notification',
      'n1',
      expect.objectContaining({ escalated: true })
    );
  });

  it('markRead is no-op for missing id', async () => {
    const repo = mockRepo([]);
    const svc = new NotificationService(repo);
    await svc.markRead('missing');
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
