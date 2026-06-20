import { describe, it, expect, vi } from 'vitest';
import { McpService } from './mcp-service.js';

function mockMarketplaceClient(configured = true) {
  return {
    isConfigured: vi.fn().mockReturnValue(configured),
    listMcpGroups: vi.fn().mockResolvedValue({
      groups: [{ id: 'g-1', name: 'default', toolCount: 3 }],
    }),
    listMcpTools: vi.fn().mockResolvedValue({
      tools: [{ id: 't-1', name: 'search' }],
    }),
  };
}

function mockPolicyStore() {
  return {
    findByTenant: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

describe('McpService', () => {
  it('returns empty groups when client not configured', async () => {
    const client = mockMarketplaceClient(false);
    const svc = new McpService(client as never);
    const groups = await svc.listMcpGroups('tn-1');
    expect(groups).toEqual([]);
    expect(client.listMcpGroups).not.toHaveBeenCalled();
  });

  it('lists groups from marketplace', async () => {
    const client = mockMarketplaceClient();
    const svc = new McpService(client as never);
    const groups = await svc.listMcpGroups('tn-1');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('default');
  });

  it('merges policy enabled state into groups', async () => {
    const client = mockMarketplaceClient();
    const store = mockPolicyStore();
    store.findByTenant.mockResolvedValue([
      { tenantId: 'tn-1', mcpGroupId: 'g-1', enabled: false, requiresApproval: false },
    ]);
    const svc = new McpService(client as never, store);
    const groups = await svc.listMcpGroups('tn-1');
    expect(groups[0].enabled).toBe(false);
  });

  it('enableGroup upserts policy', async () => {
    const client = mockMarketplaceClient();
    const store = mockPolicyStore();
    const svc = new McpService(client as never, store);
    await svc.enableGroup('tn-1', 'g-1');
    expect(store.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tn-1', mcpGroupId: 'g-1', enabled: true })
    );
  });

  it('disableGroup upserts policy with enabled=false', async () => {
    const client = mockMarketplaceClient();
    const store = mockPolicyStore();
    const svc = new McpService(client as never, store);
    await svc.disableGroup('tn-1', 'g-1');
    expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('returns empty tools when client not configured', async () => {
    const client = mockMarketplaceClient(false);
    const svc = new McpService(client as never);
    const tools = await svc.listTools('g-1');
    expect(tools).toEqual([]);
  });

  it('lists tools from marketplace', async () => {
    const client = mockMarketplaceClient();
    const svc = new McpService(client as never);
    const tools = await svc.listTools('g-1');
    expect(tools).toHaveLength(1);
  });
});
