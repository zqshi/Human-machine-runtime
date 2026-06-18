import { McpClient, McpClientPool, mcpAuthHeaders } from './mcp-client.js';
import { GatewayError } from '../gateway/clients/base-client.js';

const jsonRes = (body: unknown, ct = 'application/json'): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': ct } });

const INIT_RESULT = {
  protocolVersion: '2025-03-26',
  capabilities: {},
  serverInfo: { name: 'test-mcp', version: '1.0.0' },
};

/** 模拟一次完整 MCP 会话：initialize → notify(202) → 期望的第 3 次 rpc 响应。 */
function mockSession(f: ReturnType<typeof vi.fn>, third: Response): void {
  f.mockResolvedValueOnce(jsonRes({ jsonrpc: '2.0', id: 1, result: INIT_RESULT }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(third);
}

describe('McpClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listTools：initialize + tools/list，解析单 JSON', async () => {
    const f = vi.mocked(fetch);
    mockSession(f, jsonRes({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 't1' }] } }));
    const client = new McpClient('http://mcp.local');
    const tools = await client.listTools();
    expect(tools).toEqual([{ name: 't1' }]);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('SSE 应答解析（text/event-stream）', async () => {
    const f = vi.mocked(fetch);
    const sse =
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"sse-tool"}]}}\n\n';
    mockSession(
      f,
      new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    );
    const client = new McpClient('http://mcp.local');
    expect(await client.listTools()).toEqual([{ name: 'sse-tool' }]);
  });

  it('initialize 复用（第二次 listTools 不再握手）', async () => {
    const f = vi.mocked(fetch);
    mockSession(f, jsonRes({ jsonrpc: '2.0', id: 2, result: { tools: [] } }));
    mockSession(f, jsonRes({ jsonrpc: '2.0', id: 3, result: { tools: [] } }));
    const client = new McpClient('http://mcp.local');
    await client.listTools();
    await client.listTools();
    // 第二次只发 tools/list（1 次），不重复 initialize（共 3 + 1 = 4 次）
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('JSON-RPC error → 抛 GatewayError', async () => {
    const f = vi.mocked(fetch);
    f.mockResolvedValueOnce(
      jsonRes({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'method not found' } })
    );
    const client = new McpClient('http://mcp.local');
    try {
      await client.listTools();
      expect.unreachable('listTools should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GatewayError);
      expect((e as Error).message).toMatch(/method not found/);
    }
  });

  it('callTool 透传 name + arguments，返回 content', async () => {
    const f = vi.mocked(fetch);
    mockSession(
      f,
      jsonRes({
        jsonrpc: '2.0',
        id: 2,
        result: { content: [{ type: 'text', text: 'ok' }] },
      })
    );
    const client = new McpClient('http://mcp.local');
    const r = await client.callTool('t1', { q: 'a' });
    expect(r.content[0].text).toBe('ok');
    const callBody = JSON.parse((f.mock.calls[2][1] as RequestInit).body as string);
    expect(callBody.method).toBe('tools/call');
    expect(callBody.params).toEqual({ name: 't1', arguments: { q: 'a' } });
  });

  it('initialize 握手发送 protocolVersion 与 notifications/initialized', async () => {
    const f = vi.mocked(fetch);
    mockSession(f, jsonRes({ jsonrpc: '2.0', id: 2, result: { tools: [] } }));
    const client = new McpClient('http://mcp.local');
    await client.listTools();
    const initBody = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(initBody.method).toBe('initialize');
    expect(initBody.params.protocolVersion).toBe('2025-03-26');
    const notifyBody = JSON.parse((f.mock.calls[1][1] as RequestInit).body as string);
    expect(notifyBody.method).toBe('notifications/initialized');
    expect(notifyBody.id).toBeUndefined();
  });
});

describe('McpClientPool', () => {
  it('相同 endpoint+headers 复用同一实例', () => {
    const pool = new McpClientPool();
    const a = pool.get('http://mcp.local', { Authorization: 'Bearer x' });
    const b = pool.get('http://mcp.local', { Authorization: 'Bearer x' });
    expect(a).toBe(b);
  });
  it('不同 endpoint 或 headers 返回不同实例', () => {
    const pool = new McpClientPool();
    const a = pool.get('http://mcp.local');
    const b = pool.get('http://mcp2.local');
    const c = pool.get('http://mcp.local', { Authorization: 'Bearer y' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('mcpAuthHeaders', () => {
  it('无凭证 → 空', () => {
    expect(mcpAuthHeaders(undefined)).toEqual({});
  });
  it('token → Bearer', () => {
    expect(mcpAuthHeaders({ type: 'bearer', token: 'abc' })).toEqual({
      Authorization: 'Bearer abc',
    });
  });
  it('apiKey → 自定义头', () => {
    expect(mcpAuthHeaders({ type: 'api_key', apiKey: 'k', headerName: 'X-Key' })).toEqual({
      'X-Key': 'k',
    });
  });
});
