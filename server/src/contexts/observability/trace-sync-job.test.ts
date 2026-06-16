import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceSyncJob } from './trace-sync-job.js';

function mockLitellmClient(configured = true) {
  return {
    isConfigured: vi.fn().mockReturnValue(configured),
    getSpendLogs: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  };
}

function mockAiRepo() {
  return {
    traceExistsByRequestId: vi.fn().mockResolvedValue(false),
    insertTrace: vi.fn().mockResolvedValue(undefined),
    insertCostRecord: vi.fn().mockResolvedValue(undefined),
  };
}

describe('TraceSyncJob', () => {
  let litellm: ReturnType<typeof mockLitellmClient>;
  let aiRepo: ReturnType<typeof mockAiRepo>;

  beforeEach(() => {
    litellm = mockLitellmClient();
    aiRepo = mockAiRepo();
    vi.useFakeTimers();
  });

  it('start does nothing when LiteLLM not configured', () => {
    litellm.isConfigured.mockReturnValue(false);
    const job = new TraceSyncJob(litellm as never, aiRepo as never, 60_000);
    job.start();
    expect(litellm.getSpendLogs).not.toHaveBeenCalled();
    job.stop();
  });

  it('sync returns 0 when no logs returned', async () => {
    vi.useRealTimers();
    const job = new TraceSyncJob(litellm as never, aiRepo as never, 60_000);
    const synced = await job.sync();
    expect(synced).toBe(0);
    expect(litellm.getSpendLogs).toHaveBeenCalled();
  });

  it('sync writes trace and cost record for new logs', async () => {
    vi.useRealTimers();
    const now = new Date();
    litellm.getSpendLogs.mockResolvedValue({
      data: [
        {
          request_id: 'req-1',
          startTime: now.toISOString(),
          endTime: new Date(now.getTime() + 500).toISOString(),
          model: 'claude-3-sonnet',
          prompt_tokens: 100,
          completion_tokens: 50,
          spend: 0.002,
          user: 'user1',
          api_key: 'sk-hash',
          call_type: 'sync',
          custom_llm_provider: null,
          metadata: { instance_id: 'inst-1' },
        },
      ],
      total: 1,
    });

    const job = new TraceSyncJob(litellm as never, aiRepo as never, 60_000);
    const synced = await job.sync();

    expect(synced).toBe(1);
    expect(aiRepo.insertTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'req-1',
        requestedModel: 'claude-3-sonnet',
        promptTokens: 100,
        completionTokens: 50,
        status: 'success',
      })
    );
    expect(aiRepo.insertCostRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'req-1',
        model: 'claude-3-sonnet',
        providerType: 'anthropic',
        costOriginal: 0.002,
      })
    );
  });

  it('sync skips duplicate traces', async () => {
    vi.useRealTimers();
    const now = new Date();
    litellm.getSpendLogs.mockResolvedValue({
      data: [
        {
          request_id: 'req-dup',
          startTime: now.toISOString(),
          model: 'gpt-4',
          prompt_tokens: 10,
          completion_tokens: 5,
          spend: 0.001,
          metadata: {},
        },
      ],
      total: 1,
    });
    aiRepo.traceExistsByRequestId.mockResolvedValue(true);

    const job = new TraceSyncJob(litellm as never, aiRepo as never, 60_000);
    const synced = await job.sync();

    expect(synced).toBe(0);
    expect(aiRepo.insertTrace).not.toHaveBeenCalled();
  });

  it('sync is reentrant-safe (skips if already syncing)', async () => {
    vi.useRealTimers();
    let resolveGetLogs: (v: { data: []; total: 0 }) => void;
    litellm.getSpendLogs.mockImplementation(
      () =>
        new Promise((r) => {
          resolveGetLogs = r;
        })
    );

    const job = new TraceSyncJob(litellm as never, aiRepo as never, 60_000);
    const first = job.sync();
    const second = await job.sync();

    expect(second).toBe(0);
    resolveGetLogs!({ data: [], total: 0 });
    await first;
  });

  it('stop clears the interval', () => {
    const job = new TraceSyncJob(litellm as never, aiRepo as never, 60_000);
    job.start();
    job.stop();
    vi.advanceTimersByTime(120_000);
    expect(litellm.getSpendLogs).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
