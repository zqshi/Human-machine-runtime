import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClusterInstanceClient } from './cluster-instance-client.js';

describe('ClusterInstanceClient', () => {
  let client: ClusterInstanceClient;

  beforeEach(() => {
    client = new ClusterInstanceClient('cluster-instance', 'http://localhost:18090');
  });

  it('isConfigured returns true when baseUrl set', () => {
    expect(client.isConfigured()).toBe(true);
  });

  it('isConfigured returns false when baseUrl empty', () => {
    const empty = new ClusterInstanceClient('cluster-instance', '');
    expect(empty.isConfigured()).toBe(false);
  });

  it('listInstances calls correct endpoint with pagination', async () => {
    const mockData = { items: [], total: 0, page: 1, pageSize: 100 };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 }));

    const result = await client.listInstances(2, 50);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/instances?page=2&pageSize=50'),
      expect.any(Object)
    );
    expect(result).toEqual(mockData);
    fetchSpy.mockRestore();
  });

  it('healthCheck returns true on successful response', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));

    const result = await client.healthCheck();
    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/healthz'), expect.any(Object));
    fetchSpy.mockRestore();
  });

  it('healthCheck returns false on network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await client.healthCheck();
    expect(result).toBe(false);
    fetchSpy.mockRestore();
  });

  it('healthCheck returns false when not configured', async () => {
    const empty = new ClusterInstanceClient('cluster-instance', '');
    const result = await empty.healthCheck();
    expect(result).toBe(false);
  });
});
