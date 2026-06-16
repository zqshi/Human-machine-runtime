import { describe, it, expect, vi, afterEach } from 'vitest';
import { PushChannelService } from './push-channel-service.js';
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

describe('PushChannelService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('list delegates to repo', async () => {
    const repo = mockRepo([{ id: 'ch1', name: 'Slack' }]);
    const svc = new PushChannelService(repo);
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(repo.list).toHaveBeenCalledWith('push_channel');
  });

  it('create generates id and stores', async () => {
    const repo = mockRepo();
    const svc = new PushChannelService(repo);
    const ch = await svc.create({ name: 'Feishu' });
    expect(ch.id).toMatch(/^ch_/);
    expect(ch.name).toBe('Feishu');
    expect(repo.upsert).toHaveBeenCalled();
  });

  it('create respects explicit id', async () => {
    const repo = mockRepo();
    const svc = new PushChannelService(repo);
    const ch = await svc.create({ id: 'custom-id', name: 'X' });
    expect(ch.id).toBe('custom-id');
  });

  it('delete removes from repo', async () => {
    const repo = mockRepo([{ id: 'ch1' }]);
    const svc = new PushChannelService(repo);
    await svc.delete('ch1');
    expect(repo.remove).toHaveBeenCalledWith('push_channel', 'ch1');
  });

  it('testWebhook returns not found for missing channel', async () => {
    const repo = mockRepo();
    const svc = new PushChannelService(repo);
    const result = await svc.testWebhook('missing');
    expect(result.success).toBe(false);
    expect(result.message).toBe('not found');
  });

  it('testWebhook returns error when no webhook configured', async () => {
    const repo = mockRepo([{ id: 'ch1' }]);
    const svc = new PushChannelService(repo);
    const result = await svc.testWebhook('ch1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('webhook');
  });

  it('testWebhook calls webhook and returns success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const repo = mockRepo([{ id: 'ch1', webhookUrl: 'http://hook.test/x' }]);
    const svc = new PushChannelService(repo);
    const result = await svc.testWebhook('ch1');
    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it('testWebhook handles fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const repo = mockRepo([{ id: 'ch1', webhookUrl: 'http://hook.test/x' }]);
    const svc = new PushChannelService(repo);
    const result = await svc.testWebhook('ch1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('timeout');
  });
});
