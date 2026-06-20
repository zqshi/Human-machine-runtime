import type { InstanceService } from '../tenant-instance/instance-service.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import type { MarketplaceClient } from '../gateway/clients/marketplace-client.js';
import { newId } from '../../shared/utils.js';

export class SharedAgentService {
  constructor(
    private instanceSvc: InstanceService,
    private opRepo: OperationalRepository,
    private marketplaceClient?: MarketplaceClient
  ) {}

  async listAll() {
    const all = await this.instanceSvc.list();
    const registered = await this.opRepo
      .list('tool_config')
      .then((rows) =>
        rows.filter((r) => (r as Record<string, unknown>).category === 'shared_agent')
      );

    const agents = all.map((inst) => ({
      id: inst.id,
      name: inst.name,
      state: inst.state,
      tenantId: inst.tenantId,
      source: inst.source,
      department: inst.department,
      jobTitle: inst.jobTitle,
      type: 'instance',
    }));

    const shared = registered.map((r) => ({
      id: r.id,
      name: r.name ?? 'unknown',
      state: 'registered',
      source: 'shared',
      type: 'shared',
      ...(r as Record<string, unknown>),
    }));

    let hubAgents: unknown[] = [];
    if (this.marketplaceClient?.isConfigured()) {
      try {
        const hubRes = await this.marketplaceClient.listAgents({ pageSize: 50 });
        const items = Array.isArray(hubRes) ? hubRes : (hubRes as Record<string, unknown>)?.items;
        hubAgents = Array.isArray(items)
          ? items.map((a: Record<string, unknown>) => ({ ...a, type: 'hub' }))
          : [];
      } catch {
        /* marketplace backend unavailable */
      }
    }

    const merged = [...agents, ...shared, ...hubAgents];
    return { agents: merged, total: merged.length };
  }

  async recommend(requirement?: string) {
    const all = await this.instanceSvc.list();
    const lowerReq = (requirement ?? '').toLowerCase();

    const scored = all.map((inst) => {
      let relevance = 0.5;
      if (lowerReq) {
        if (inst.name.toLowerCase().includes(lowerReq)) relevance += 0.3;
        if (inst.department?.toLowerCase().includes(lowerReq)) relevance += 0.1;
        if (inst.jobTitle?.toLowerCase().includes(lowerReq)) relevance += 0.1;
      }
      if (inst.state === 'running') relevance += 0.1;
      return { id: inst.id, name: inst.name, state: inst.state, relevance: Math.min(1, relevance) };
    });

    scored.sort((a, b) => b.relevance - a.relevance);

    return {
      recommendations: scored.slice(0, 5),
      requirement,
      total: scored.length,
    };
  }

  async register(input: {
    name: string;
    description?: string;
    capabilities?: string[];
    category?: string;
    isPublic?: boolean;
  }) {
    const id = newId('agent');
    await this.opRepo.upsert('tool_config', id, {
      category: 'shared_agent',
      name: input.name,
      description: input.description,
      capabilities: input.capabilities,
      agentCategory: input.category,
      isPublic: input.isPublic ?? true,
      registeredAt: new Date().toISOString(),
    });
    return { id, name: input.name };
  }

  async unregister(id: string) {
    return this.opRepo.remove('tool_config', id);
  }
}
