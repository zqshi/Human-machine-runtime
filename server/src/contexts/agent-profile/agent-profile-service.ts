import type { ProfileServiceClient } from '../gateway/clients/profile-service-client.js';

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
  private client: ProfileServiceClient;

  constructor(client: ProfileServiceClient) {
    this.client = client;
  }

  /** Agent 档案后端（profile-service）未配置时明确拒绝，而非崩溃。 */
  private requireConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new Error(
        'Agent profile backend (profile-service) not configured — set PROFILE_SERVICE_API_URL'
      );
    }
  }

  async getProfile(agentId: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getAgentProfile(agentId);
  }

  async updateProfile(agentId: string, data: Partial<AgentProfile>): Promise<unknown> {
    this.requireConfigured();
    return this.client.updateAgentProfile(agentId, data);
  }

  async getJourney(agentId: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getAgentJourney(agentId);
  }

  async getUsage(agentId: string, period?: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getUsageSummary(agentId, period);
  }

  async listBlog(agentId: string, page = 1, pageSize = 20): Promise<unknown> {
    this.requireConfigured();
    return this.client.listBlogEntries(agentId, { page, pageSize });
  }
}
