import {
  computeHealthStatus,
  matchDiscoveryQuery,
  canInvoke,
  type ToolEndpoint,
} from './tool-registry.js';

const endpoint = (over: Partial<ToolEndpoint> = {}): ToolEndpoint => ({
  definitionId: 'd1',
  sourceId: 's1',
  tenantId: 't1',
  name: 'SQL 优化',
  description: '查询优化工具',
  executionType: 'http_proxy',
  inputSchema: null,
  tags: ['db', 'sql'],
  enabled: true,
  ...over,
});

describe('computeHealthStatus', () => {
  it('0 失败 → healthy', () => {
    expect(computeHealthStatus(0)).toBe('healthy');
  });
  it('达到 degraded 阈值（默认 1）→ degraded', () => {
    expect(computeHealthStatus(1)).toBe('degraded');
    expect(computeHealthStatus(2)).toBe('degraded');
  });
  it('达到 down 阈值（默认 3）→ down', () => {
    expect(computeHealthStatus(3)).toBe('down');
    expect(computeHealthStatus(10)).toBe('down');
  });
  it('自定义阈值', () => {
    expect(computeHealthStatus(1, { degraded: 2, down: 5 })).toBe('healthy');
    expect(computeHealthStatus(2, { degraded: 2, down: 5 })).toBe('degraded');
    expect(computeHealthStatus(5, { degraded: 2, down: 5 })).toBe('down');
  });
});

describe('matchDiscoveryQuery', () => {
  it('租户不匹配 → false', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 'other' })).toBe(false);
  });
  it('仅租户 → true', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1' })).toBe(true);
  });
  it('enabledOnly 过滤禁用端点', () => {
    expect(
      matchDiscoveryQuery(endpoint({ enabled: false }), { tenantId: 't1', enabledOnly: true })
    ).toBe(false);
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', enabledOnly: true })).toBe(true);
  });
  it('sourceId 过滤', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', sourceId: 's1' })).toBe(true);
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', sourceId: 'sx' })).toBe(false);
  });
  it('executionType 过滤', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', executionType: 'http_proxy' })).toBe(
      true
    );
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', executionType: 'db_query' })).toBe(
      false
    );
  });
  it('tags 需全部包含（AND）', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', tags: ['db'] })).toBe(true);
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', tags: ['db', 'sql'] })).toBe(true);
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', tags: ['db', 'missing'] })).toBe(
      false
    );
  });
  it('空 tags 数组不过滤', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', tags: [] })).toBe(true);
  });
  it('keyword 匹配名称或描述（大小写不敏感）', () => {
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', keyword: 'sql' })).toBe(true);
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', keyword: '查询' })).toBe(true);
    expect(matchDiscoveryQuery(endpoint(), { tenantId: 't1', keyword: '不存在' })).toBe(false);
  });
});

describe('canInvoke', () => {
  const ep = (enabled: boolean): ToolEndpoint => ({
    definitionId: 'd1',
    sourceId: 's1',
    tenantId: 't1',
    name: 'x',
    description: null,
    executionType: 'http_proxy',
    inputSchema: null,
    tags: [],
    enabled,
  });
  it('禁用 → false', () => {
    expect(canInvoke(ep(false), 'healthy')).toBe(false);
  });
  it('down → false', () => {
    expect(canInvoke(ep(true), 'down')).toBe(false);
  });
  it('healthy / degraded / unknown → true', () => {
    expect(canInvoke(ep(true), 'healthy')).toBe(true);
    expect(canInvoke(ep(true), 'degraded')).toBe(true);
    expect(canInvoke(ep(true), 'unknown')).toBe(true);
  });
});
