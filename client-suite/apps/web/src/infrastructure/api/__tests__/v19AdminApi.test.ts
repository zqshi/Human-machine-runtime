import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toolApprovalsApi,
  runtimeTemplatesApi,
  featureFlagApi,
  type FeatureFlagConfig,
} from '../v19AdminApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  };
}

describe('v19AdminApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('toolApprovals: listPending/approve/reject URL 与 method', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    await toolApprovalsApi.listPending();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/tool-approvals/pending');

    await toolApprovalsApi.approve('ap-1');
    expect(mockFetch.mock.calls[1][0]).toBe('/api/admin/tool-approvals/ap-1/approve');
    expect(mockFetch.mock.calls[1][1].method).toBe('POST');

    await toolApprovalsApi.reject('ap-1');
    expect(mockFetch.mock.calls[2][0]).toBe('/api/admin/tool-approvals/ap-1/reject');
    expect(mockFetch.mock.calls[2][1].method).toBe('POST');
  });

  it('runtimeTemplates: sandbox-templates / runtime-types / summary', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [] }));
    await runtimeTemplatesApi.listSandboxTemplates();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/runtime-templates/sandbox-templates');
    await runtimeTemplatesApi.listRuntimeTypes();
    expect(mockFetch.mock.calls[1][0]).toBe('/api/admin/runtime-templates/runtime-types');
    await runtimeTemplatesApi.getSummary();
    expect(mockFetch.mock.calls[2][0]).toBe(
      '/api/admin/runtime-templates/sandbox-templates-summary'
    );
  });

  it('featureFlag: list / set URL + body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ flags: {} }));
    await featureFlagApi.list();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/feature-flags');

    const config: FeatureFlagConfig = { enabled: true, rolloutPct: 50, killSwitch: undefined };
    mockFetch.mockResolvedValue(jsonResponse({ key: 'k', flag: config }));
    await featureFlagApi.set('agent.guardrails.enforce', config);
    const [path, init] = mockFetch.mock.calls[1];
    expect(path).toBe('/api/admin/feature-flags/agent.guardrails.enforce');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ enabled: true, rolloutPct: 50, killSwitch: undefined });
  });
});
