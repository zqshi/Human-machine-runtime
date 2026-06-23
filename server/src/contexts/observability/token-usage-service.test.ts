import { describe, it, expect, vi } from 'vitest';
import { TokenUsageService } from './token-usage-service.js';

function mockProfileServiceClient(configured = true) {
  return {
    isConfigured: vi.fn().mockReturnValue(configured),
    getUsageSummary: vi.fn().mockResolvedValue({
      model: 'gpt-4',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      totalCost: 0.5,
      requestCount: 10,
    }),
  };
}

function mockLitellmClient(configured = true) {
  return {
    isConfigured: vi.fn().mockReturnValue(configured),
    getSpend: vi.fn().mockResolvedValue({ totalSpend: 12.5 }),
  };
}

function mockStore() {
  return {
    upsertSnapshot: vi.fn().mockResolvedValue(undefined),
    getSummary: vi.fn().mockResolvedValue({
      tenantId: 'tn-1',
      period: '30d',
      totalTokens: 5000,
      totalCost: 2.0,
      requestCount: 100,
      byModel: [],
    }),
  };
}

describe('TokenUsageService', () => {
  it('returns empty summary when no store', async () => {
    const svc = new TokenUsageService(
      mockProfileServiceClient() as never,
      mockLitellmClient() as never
    );
    const summary = await svc.getUsageSummary('tn-1');
    expect(summary.totalTokens).toBe(0);
    expect(summary.tenantId).toBe('tn-1');
  });

  it('queries store for summary when available', async () => {
    const store = mockStore();
    const svc = new TokenUsageService(
      mockProfileServiceClient() as never,
      mockLitellmClient() as never,
      store
    );
    const summary = await svc.getUsageSummary('tn-1', '7d');
    expect(summary.totalTokens).toBe(5000);
    expect(store.getSummary).toHaveBeenCalledWith('tn-1', expect.any(Date));
  });

  it('syncFromPortal skips when profileService not configured', async () => {
    const profileService = mockProfileServiceClient(false);
    const store = mockStore();
    const svc = new TokenUsageService(profileService as never, mockLitellmClient() as never, store);
    await svc.syncFromPortal('a-1', 'tn-1');
    expect(store.upsertSnapshot).not.toHaveBeenCalled();
  });

  it('syncFromPortal upserts snapshot from profile-service data', async () => {
    const profileService = mockProfileServiceClient();
    const store = mockStore();
    const svc = new TokenUsageService(profileService as never, mockLitellmClient() as never, store);
    await svc.syncFromPortal('a-1', 'tn-1');
    expect(store.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tn-1', model: 'gpt-4', totalTokens: 150 })
    );
  });

  it('getLiteLLMSpend returns null when not configured', async () => {
    const litellm = mockLitellmClient(false);
    const svc = new TokenUsageService(mockProfileServiceClient() as never, litellm as never);
    const result = await svc.getLiteLLMSpend();
    expect(result).toBeNull();
  });

  it('getLiteLLMSpend returns spend data', async () => {
    const litellm = mockLitellmClient();
    const svc = new TokenUsageService(mockProfileServiceClient() as never, litellm as never);
    const result = await svc.getLiteLLMSpend('2026-05-01', '2026-05-18');
    expect(result).toEqual({ totalSpend: 12.5 });
    expect(litellm.getSpend).toHaveBeenCalledWith({
      startDate: '2026-05-01',
      endDate: '2026-05-18',
    });
  });
});

describe('TokenUsageService.recordUsage', () => {
  it('store 未注入时 no-op', async () => {
    const svc = new TokenUsageService(
      mockProfileServiceClient() as never,
      mockLitellmClient() as never
    );
    await expect(
      svc.recordUsage({ tenantId: 'tn-1', inputTokens: 100, outputTokens: 50 })
    ).resolves.toBeUndefined();
  });

  it('正确字段映射到 store.upsertSnapshot', async () => {
    const store = mockStore();
    const svc = new TokenUsageService(
      mockProfileServiceClient() as never,
      mockLitellmClient() as never,
      store
    );
    await svc.recordUsage({
      tenantId: 'tn-1',
      model: 'claude-sonnet-4-6',
      inputTokens: 1200,
      outputTokens: 300,
      source: 'claude-agent-sdk',
    });
    expect(store.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tn-1',
        model: 'claude-sonnet-4-6',
        promptTokens: 1200,
        completionTokens: 300,
        totalTokens: 1500,
        requestCount: 1,
        userUid: 'claude-agent-sdk',
      })
    );
  });

  it('inputTokens/outputTokens 均为 0 时跳过', async () => {
    const store = mockStore();
    const svc = new TokenUsageService(
      mockProfileServiceClient() as never,
      mockLitellmClient() as never,
      store
    );
    await svc.recordUsage({ tenantId: 'tn-1', inputTokens: 0, outputTokens: 0 });
    expect(store.upsertSnapshot).not.toHaveBeenCalled();
  });

  it('store 抛错时不 re-throw(吞错,避免污染调用链)', async () => {
    const store = mockStore();
    store.upsertSnapshot.mockRejectedValue(new Error('db down'));
    const svc = new TokenUsageService(
      mockProfileServiceClient() as never,
      mockLitellmClient() as never,
      store
    );
    await expect(
      svc.recordUsage({ tenantId: 'tn-1', inputTokens: 10, outputTokens: 5 })
    ).resolves.toBeUndefined();
  });
});
