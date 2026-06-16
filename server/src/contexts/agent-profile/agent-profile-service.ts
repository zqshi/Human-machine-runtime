import type { PortalClient } from '../gateway/clients/portal-client.js';

export interface AgentProfile {
  id: string;
  name: string;
  avatar?: string;
  jobTitle?: string;
  department?: string;
  skills: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface AgentJourney {
  agentId: string;
  milestones: { date: string; event: string; detail?: string }[];
}

export interface UsageSummary {
  agentId: string;
  period: string;
  totalTokens: number;
  totalRequests: number;
  breakdown: { model: string; tokens: number; requests: number }[];
}

export class AgentProfileService {
  private client: PortalClient;

  constructor(client: PortalClient) {
    this.client = client;
  }

  async getProfile(agentId: string): Promise<unknown> {
    return this.client.getAgentProfile(agentId);
  }

  async updateProfile(agentId: string, data: Partial<AgentProfile>): Promise<unknown> {
    return this.client.updateAgentProfile(agentId, data);
  }

  async getJourney(agentId: string): Promise<unknown> {
    return this.client.getAgentJourney(agentId);
  }

  async getUsage(agentId: string, period?: string): Promise<unknown> {
    return this.client.getUsageSummary(agentId, period);
  }

  async listBlog(agentId: string, page = 1, pageSize = 20): Promise<unknown> {
    return this.client.listBlogEntries(agentId, { page, pageSize });
  }
}
