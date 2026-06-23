import { describe, it, expect, vi } from 'vitest';
import { BillingService, type IBillingRepository } from './billing-service.js';
import type { BillingEvent, RecordEventInput, ListEventsFilter } from './domain/billing-event.js';

/** In-memory IBillingRepository 模拟,便于测试 BillingService 的业务逻辑。 */
function makeRepo(opts?: {
  events?: BillingEvent[];
  account?: { tenantId: string; balance: number; currency: string; updatedAt: string } | null;
}): IBillingRepository & {
  events: BillingEvent[];
  deltas: Array<{ tenantId: string; delta: number; currency?: string }>;
} {
  const events = [...(opts?.events ?? [])];
  const account = opts?.account ?? null;
  const deltas: Array<{ tenantId: string; delta: number; currency?: string }> = [];
  return {
    events,
    deltas,
    async recordEvent(input: RecordEventInput): Promise<BillingEvent> {
      const evt: BillingEvent = {
        id: events.length + 1,
        tenantId: input.tenantId,
        type: input.type,
        amount: input.amount,
        currency: 'USD',
        metadata: input.metadata ?? {},
        createdAt: new Date().toISOString(),
      };
      events.push(evt);
      return evt;
    },
    async listEvents(tenantId: string, filter?: ListEventsFilter): Promise<BillingEvent[]> {
      let result = events.filter((e) => e.tenantId === tenantId);
      if (filter?.type) result = result.filter((e) => e.type === filter.type);
      return result;
    },
    async getAccount() {
      return account;
    },
    async upsertAccountDelta(tenantId, delta, currency) {
      deltas.push({ tenantId, delta, currency });
    },
  };
}

describe('BillingService', () => {
  it('recordEvent 落事件 + 调 upsertAccountDelta', async () => {
    const repo = makeRepo();
    const service = new BillingService(repo);
    const evt = await service.recordEvent({
      tenantId: 't-1',
      type: 'token_usage',
      amount: 0.0123,
      metadata: { model: 'claude-sonnet-4-6', tokens: 1200 },
    });
    expect(evt.id).toBe(1);
    expect(evt.type).toBe('token_usage');
    expect(evt.amount).toBeCloseTo(0.0123);
    expect(repo.events).toHaveLength(1);
    expect(repo.deltas).toEqual([{ tenantId: 't-1', delta: 0.0123, currency: undefined }]);
  });

  it('upsertAccountDelta 抛错时 recordEvent 不抛(事件已落库)', async () => {
    const repo = makeRepo();
    repo.upsertAccountDelta = vi.fn(async () => {
      throw new Error('db connection lost');
    });
    const service = new BillingService(repo);

    // 不应抛错 —— 账户 upsert 失败被吞掉,仅 log warn
    const evt = await service.recordEvent({
      tenantId: 't-1',
      type: 'decision_closed',
      amount: 1,
    });
    expect(evt.id).toBe(1);
    expect(repo.events).toHaveLength(1);
    expect(repo.upsertAccountDelta).toHaveBeenCalledTimes(1);
  });

  it('recordEvent 抛错向上传播(repo 故障不可静默)', async () => {
    const repo = makeRepo();
    const upsertSpy = vi.fn(async () => {
      throw new Error('should not be called');
    });
    repo.recordEvent = vi.fn(async () => {
      throw new Error('primary key violation');
    });
    repo.upsertAccountDelta = upsertSpy;
    const service = new BillingService(repo);
    await expect(
      service.recordEvent({ tenantId: 't-1', type: 'token_usage', amount: 0.5 })
    ).rejects.toThrow(/primary key violation/);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('getAccount 返回 repo 结果', async () => {
    const repo = makeRepo({
      account: {
        tenantId: 't-1',
        balance: 12.34,
        currency: 'USD',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    });
    const service = new BillingService(repo);
    const account = await service.getAccount('t-1');
    expect(account?.balance).toBeCloseTo(12.34);
    expect(account?.currency).toBe('USD');
  });

  it('getAccount 未写入时返回 null', async () => {
    const repo = makeRepo({ account: null });
    const service = new BillingService(repo);
    const account = await service.getAccount('missing');
    expect(account).toBeNull();
  });

  it('listEvents 透传过滤参数', async () => {
    const repo = makeRepo({
      events: [
        {
          id: 1,
          tenantId: 't-1',
          type: 'token_usage',
          amount: 0.1,
          currency: 'USD',
          metadata: {},
          createdAt: '2026-06-22T00:00:00.000Z',
        },
        {
          id: 2,
          tenantId: 't-1',
          type: 'decision_closed',
          amount: 1,
          currency: 'USD',
          metadata: {},
          createdAt: '2026-06-22T01:00:00.000Z',
        },
      ],
    });
    const service = new BillingService(repo);
    const tokenEvents = await service.listEvents('t-1', { type: 'token_usage' });
    expect(tokenEvents).toHaveLength(1);
    expect(tokenEvents[0]!.type).toBe('token_usage');

    const all = await service.listEvents('t-1');
    expect(all).toHaveLength(2);
  });

  it('多租户隔离:t-1 事件不出现在 t-2 查询中', async () => {
    const repo = makeRepo({
      events: [
        {
          id: 1,
          tenantId: 't-1',
          type: 'token_usage',
          amount: 0.1,
          currency: 'USD',
          metadata: {},
          createdAt: '2026-06-22T00:00:00.000Z',
        },
      ],
    });
    const service = new BillingService(repo);
    const events = await service.listEvents('t-2');
    expect(events).toEqual([]);
  });
});
