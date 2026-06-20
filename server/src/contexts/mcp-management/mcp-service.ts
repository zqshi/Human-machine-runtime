import type { MarketplaceClient } from '../gateway/clients/marketplace-client.js';

export interface McpGroupInfo {
  id: string;
  name: string;
  toolCount: number;
  enabled?: boolean;
  requiresApproval?: boolean;
}

export interface McpPolicy {
  tenantId: string;
  mcpGroupId: string;
  enabled: boolean;
  maxCallsPerDay?: number;
  requiresApproval: boolean;
}

export interface McpUsageRecord {
  tenantId: string;
  groupId: string;
  toolName: string;
  calledAt: string;
  actor: string;
}

export interface IMcpPolicyStore {
  findByTenant(tenantId: string): Promise<McpPolicy[]>;
  upsert(policy: McpPolicy): Promise<void>;
}

export interface IMcpUsageStore {
  record(usage: McpUsageRecord): Promise<void>;
  countToday(tenantId: string, groupId: string): Promise<number>;
}

export class McpService {
  private marketplaceClient: MarketplaceClient;
  private policyStore: IMcpPolicyStore | null;
  private usageStore: IMcpUsageStore | null;

  constructor(
    marketplaceClient: MarketplaceClient,
    policyStore?: IMcpPolicyStore,
    usageStore?: IMcpUsageStore
  ) {
    this.marketplaceClient = marketplaceClient;
    this.policyStore = policyStore ?? null;
    this.usageStore = usageStore ?? null;
  }

  async listMcpGroups(tenantId: string, authToken?: string): Promise<McpGroupInfo[]> {
    if (!this.marketplaceClient.isConfigured()) return [];
    const result = await this.marketplaceClient.listMcpGroups(authToken);
    const groups = (result?.groups ?? []) as McpGroupInfo[];
    if (!this.policyStore) return groups;

    const policies = await this.policyStore.findByTenant(tenantId);
    const policyMap = new Map(policies.map((p) => [p.mcpGroupId, p]));
    return groups.map((g) => {
      const policy = policyMap.get(g.id);
      return {
        ...g,
        enabled: policy?.enabled ?? true,
        requiresApproval: policy?.requiresApproval ?? false,
      };
    });
  }

  async enableGroup(tenantId: string, groupId: string): Promise<void> {
    if (!this.policyStore) return;
    await this.policyStore.upsert({
      tenantId,
      mcpGroupId: groupId,
      enabled: true,
      requiresApproval: false,
    });
  }

  async disableGroup(tenantId: string, groupId: string): Promise<void> {
    if (!this.policyStore) return;
    await this.policyStore.upsert({
      tenantId,
      mcpGroupId: groupId,
      enabled: false,
      requiresApproval: false,
    });
  }

  async setApprovalRequired(
    tenantId: string,
    groupId: string,
    requiresApproval: boolean
  ): Promise<void> {
    if (!this.policyStore) return;
    const existing = await this.policyStore.findByTenant(tenantId);
    const current = existing.find((p) => p.mcpGroupId === groupId);
    await this.policyStore.upsert({
      tenantId,
      mcpGroupId: groupId,
      enabled: current?.enabled ?? true,
      requiresApproval,
    });
  }

  async checkToolAccess(
    tenantId: string,
    groupId: string,
    _toolName: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.policyStore) return { allowed: true };

    const policies = await this.policyStore.findByTenant(tenantId);
    const policy = policies.find((p) => p.mcpGroupId === groupId);

    if (policy && !policy.enabled) {
      return { allowed: false, reason: 'group disabled by tenant policy' };
    }

    if (policy?.requiresApproval) {
      return { allowed: false, reason: 'requires approval' };
    }

    if (policy?.maxCallsPerDay && this.usageStore) {
      const count = await this.usageStore.countToday(tenantId, groupId);
      if (count >= policy.maxCallsPerDay) {
        return { allowed: false, reason: 'daily call limit exceeded' };
      }
    }

    return { allowed: true };
  }

  async recordUsage(
    tenantId: string,
    groupId: string,
    toolName: string,
    actor: string
  ): Promise<void> {
    if (!this.usageStore) return;
    await this.usageStore.record({
      tenantId,
      groupId,
      toolName,
      calledAt: new Date().toISOString(),
      actor,
    });
  }

  async listTools(groupId: string, authToken?: string) {
    if (!this.marketplaceClient.isConfigured()) return [];
    const result = await this.marketplaceClient.listMcpTools(groupId, authToken);
    return result?.tools ?? [];
  }

  async syncTools(groupId: string, authToken?: string): Promise<unknown> {
    if (!this.marketplaceClient.isConfigured()) return null;
    return this.marketplaceClient.syncMcpTools(groupId, authToken);
  }
}
