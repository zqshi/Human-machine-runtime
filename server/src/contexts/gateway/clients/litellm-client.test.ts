import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiteLLMClient } from './litellm-client.js';

describe('LiteLLMClient', () => {
  let client: LiteLLMClient;

  beforeEach(() => {
    client = new LiteLLMClient('litellm', 'http://localhost:14000', {
      headers: { 'x-api-key': 'sk-test' },
    });
  });

  it('isConfigured returns true when baseUrl set', () => {
    expect(client.isConfigured()).toBe(true);
  });

  it('isConfigured returns false when baseUrl empty', () => {
    const empty = new LiteLLMClient('litellm', '');
    expect(empty.isConfigured()).toBe(false);
  });

  it('getSpendLogs builds correct query string', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }));

    await client.getSpendLogs({
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      page: 2,
      pageSize: 50,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/spend/logs/v2?'),
      expect.any(Object)
    );
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('start_date=2026-01-01');
    expect(url).toContain('end_date=2026-01-02');
    expect(url).toContain('page=2');
    expect(url).toContain('page_size=50');

    fetchSpy.mockRestore();
  });

  it('getSpendLogs returns empty array on null data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: null, total: 0 }), { status: 200 })
    );

    const result = await client.getSpendLogs({ startDate: '2026-01-01', endDate: '2026-01-02' });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);

    vi.restoreAllMocks();
  });
});
