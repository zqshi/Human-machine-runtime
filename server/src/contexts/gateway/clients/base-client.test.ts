import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseGatewayClient, GatewayError, setGatewayAuditSink } from './base-client.js';

class TestClient extends BaseGatewayClient {
  constructor(baseUrl = 'http://test-service') {
    super('test-svc', baseUrl, { timeoutMs: 1000 });
  }
  doRequest<T>(path: string, opts = {}) {
    return this.request<T>(path, opts);
  }
  doRequestRaw(path: string, opts = {}) {
    return this.requestRaw(path, opts);
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('BaseGatewayClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setGatewayAuditSink(null as never);
  });

  describe('basic request', () => {
    it('sends GET with default headers', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
      const client = new TestClient();
      const result = await client.doRequest('/api/data');
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://test-service/api/data',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('sends POST with body', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ id: '1' }));
      const client = new TestClient();
      await client.doRequest('/api/data', { method: 'POST', body: { name: 'test' } });
      const call = fetchSpy.mock.calls[0];
      expect(call[1]?.method).toBe('POST');
      expect(call[1]?.body).toBe(JSON.stringify({ name: 'test' }));
    });

    it('injects auth token as Bearer header', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));
      const client = new TestClient();
      await client.doRequest('/api/data', { authToken: 'tok123' });
      expect(fetchSpy.mock.calls[0][1]?.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer tok123' })
      );
    });

    it('strips trailing slashes from base URL', () => {
      const client = new TestClient('http://example.com///');
      expect(client['baseUrl']).toBe('http://example.com');
    });
  });

  describe('error handling', () => {
    it('throws GatewayError on 4xx without retry', async () => {
      fetchSpy.mockResolvedValue(new Response('bad request', { status: 400 }));
      const client = new TestClient();
      await expect(client.doRequest('/fail')).rejects.toThrow('400');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx then succeeds', async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response('error', { status: 500 }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = new TestClient();
      client['retryCount'] = 2;
      client['backoff'] = () => Promise.resolve();
      const result = await client.doRequest('/flaky');
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('skips retry when skipRetry is true', async () => {
      fetchSpy.mockResolvedValue(new Response('error', { status: 500 }));
      const client = new TestClient();
      client['retryCount'] = 3;
      await expect(client.doRequest('/fail', { skipRetry: true })).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit breaker', () => {
    it('opens after threshold failures', async () => {
      fetchSpy.mockRejectedValue(new Error('network'));
      const client = new TestClient();
      client['retryCount'] = 1;
      client['cbThreshold'] = 2;

      await expect(client.doRequest('/a')).rejects.toThrow();
      await expect(client.doRequest('/b')).rejects.toThrow();
      await expect(client.doRequest('/c')).rejects.toThrow('Circuit breaker open');
    });

    it('resets on success', async () => {
      const client = new TestClient();
      client['retryCount'] = 1;
      client['cbThreshold'] = 3;
      client['circuit'] = { failures: 2, state: 'closed', nextRetryAt: 0 };

      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
      await client.doRequest('/ok');
      expect(client.getCircuitState()).toBe('closed');
    });
  });

  describe('health check', () => {
    it('returns true for healthy service', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ status: 'ok' }));
      const client = new TestClient();
      const ok = await client.checkHealth();
      expect(ok).toBe(true);
    });

    it('returns false on fetch failure', async () => {
      fetchSpy.mockRejectedValue(new Error('fail'));
      const client = new TestClient();
      const ok = await client.checkHealth();
      expect(ok).toBe(false);
    });

    it('returns false when not configured', async () => {
      const client = new TestClient('');
      expect(await client.checkHealth()).toBe(false);
    });

    it('caches result for 30s', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));
      const client = new TestClient();
      await client.checkHealth();
      await client.checkHealth();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('audit sink', () => {
    it('emits audit log on successful request', async () => {
      const sink = vi.fn();
      setGatewayAuditSink(sink);
      fetchSpy.mockResolvedValue(jsonResponse({ data: 1 }));

      const client = new TestClient();
      await client.doRequest('/api/audit-test');
      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'test-svc',
          method: 'GET',
          path: '/api/audit-test',
          status: 200,
        })
      );
    });
  });

  describe('isConfigured / isHealthy', () => {
    it('isConfigured returns true when baseUrl is set', () => {
      expect(new TestClient('http://x').isConfigured()).toBe(true);
    });
    it('isConfigured returns false when baseUrl is empty', () => {
      expect(new TestClient('').isConfigured()).toBe(false);
    });
  });

  describe('requestRaw', () => {
    it('returns raw Response', async () => {
      fetchSpy.mockResolvedValue(new Response('raw-body', { status: 200 }));
      const client = new TestClient();
      const res = await client.doRequestRaw('/raw');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('raw-body');
    });

    it('throws GatewayError on fetch failure', async () => {
      fetchSpy.mockRejectedValue(new Error('net'));
      const client = new TestClient();
      await expect(client.doRequestRaw('/fail')).rejects.toThrow('Gateway request failed');
    });
  });
});
