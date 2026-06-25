import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentDefinitionApi, defaultAgentDefinitionSpec } from '../agentDefinitionApi';

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

describe('agentDefinitionApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('list 拼接 tenantId/status/skip/limit 分页 query', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    await agentDefinitionApi.list({ tenantId: 't1', status: 'active', skip: 10, limit: 20 });
    expect(mockFetch.mock.calls[0][0]).toBe(
      '/api/admin/agent-definitions?tenantId=t1&status=active&skip=10&limit=20'
    );
  });

  it('list 无 query 时路径无 ? 前缀', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    await agentDefinitionApi.list();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/agent-definitions');
  });

  it('get 请求 :id 路径', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 'adef-1' }));
    await agentDefinitionApi.get('adef-1');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/agent-definitions/adef-1');
  });

  it('create POST body 含 tenantId/name/spec/description', async () => {
    const spec = defaultAgentDefinitionSpec();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'adef-1', generation: 1 }));
    await agentDefinitionApi.create({ tenantId: 't1', name: '客服', spec, description: 'd' });
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/agent-definitions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ tenantId: 't1', name: '客服', spec, description: 'd' });
  });

  it('create 不传 description 时 body 省略该字段', async () => {
    const spec = defaultAgentDefinitionSpec();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'adef-1' }));
    await agentDefinitionApi.create({ tenantId: 't1', name: 'A', spec });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.description).toBeUndefined();
  });

  it('update PUT body 为 {spec}', async () => {
    const spec = defaultAgentDefinitionSpec();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'adef-1', generation: 2 }));
    await agentDefinitionApi.update('adef-1', spec);
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/agent-definitions/adef-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ spec });
  });

  it('archive DELETE :id', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true }));
    await agentDefinitionApi.archive('adef-1');
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/agent-definitions/adef-1');
    expect(init.method).toBe('DELETE');
  });

  it('defaultAgentDefinitionSpec 含 v1.9 persona/boundKnowledge/runtime 字段', () => {
    const s = defaultAgentDefinitionSpec();
    expect(s.persona).toEqual({ systemPrompt: '', guardrails: [], refusalResponse: '' });
    expect(s.boundKnowledge).toEqual([]);
    expect(s.runtime).toEqual({ runtimeType: 'claude' });
    expect(s.sandboxTemplate).toBe('basic');
  });
});
