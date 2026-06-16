import { describe, it, expect, vi } from 'vitest';
import { GatewayHealth } from './gateway-health.js';
import type { BaseGatewayClient } from './clients/base-client.js';

function mockClient(
  name: string,
  opts: { configured?: boolean; healthy?: boolean; circuit?: string } = {}
): BaseGatewayClient {
  return {
    serviceName: name,
    isConfigured: vi.fn(() => opts.configured ?? true),
    isHealthy: vi.fn(() => opts.healthy ?? true),
    getCircuitState: vi.fn(() => opts.circuit ?? 'closed'),
    checkHealth: vi.fn(async () => opts.healthy ?? true),
  } as unknown as BaseGatewayClient;
}

describe('GatewayHealth', () => {
  it('getStatus returns all clients', () => {
    const clients = [
      mockClient('svc-a', { configured: true, healthy: true }),
      mockClient('svc-b', { configured: false, healthy: false }),
    ];
    const gh = new GatewayHealth(clients);
    const status = gh.getStatus();
    expect(status).toHaveLength(2);
    expect(status[0]).toEqual({
      name: 'svc-a',
      configured: true,
      healthy: true,
      circuit: 'closed',
    });
    expect(status[1]).toEqual({
      name: 'svc-b',
      configured: false,
      healthy: false,
      circuit: 'closed',
    });
  });

  it('hasAnyHealthy returns true when at least one configured client is healthy', () => {
    const gh = new GatewayHealth([
      mockClient('a', { configured: true, healthy: false }),
      mockClient('b', { configured: true, healthy: true }),
    ]);
    expect(gh.hasAnyHealthy()).toBe(true);
  });

  it('hasAnyHealthy returns false when no configured client is healthy', () => {
    const gh = new GatewayHealth([
      mockClient('a', { configured: true, healthy: false }),
      mockClient('b', { configured: false, healthy: true }),
    ]);
    expect(gh.hasAnyHealthy()).toBe(false);
  });

  it('hasAllConfiguredHealthy returns true when all configured are healthy', () => {
    const gh = new GatewayHealth([
      mockClient('a', { configured: true, healthy: true }),
      mockClient('b', { configured: false, healthy: false }),
    ]);
    expect(gh.hasAllConfiguredHealthy()).toBe(true);
  });

  it('hasAllConfiguredHealthy returns true when no clients configured', () => {
    const gh = new GatewayHealth([mockClient('a', { configured: false })]);
    expect(gh.hasAllConfiguredHealthy()).toBe(true);
  });

  it('hasAllConfiguredHealthy returns false when a configured client is unhealthy', () => {
    const gh = new GatewayHealth([
      mockClient('a', { configured: true, healthy: true }),
      mockClient('b', { configured: true, healthy: false }),
    ]);
    expect(gh.hasAllConfiguredHealthy()).toBe(false);
  });

  it('start triggers checkAll and sets interval', async () => {
    vi.useFakeTimers();
    const c = mockClient('x');
    const gh = new GatewayHealth([c], 1000);
    gh.start();
    expect(c.checkHealth).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(c.checkHealth).toHaveBeenCalledTimes(2);
    gh.stop();
    vi.useRealTimers();
  });

  it('start is idempotent', () => {
    vi.useFakeTimers();
    const c = mockClient('x');
    const gh = new GatewayHealth([c], 5000);
    gh.start();
    gh.start();
    expect(c.checkHealth).toHaveBeenCalledTimes(1);
    gh.stop();
    vi.useRealTimers();
  });

  it('stop clears the interval', () => {
    vi.useFakeTimers();
    const c = mockClient('x');
    const gh = new GatewayHealth([c], 1000);
    gh.start();
    gh.stop();
    vi.advanceTimersByTime(5000);
    expect(c.checkHealth).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
