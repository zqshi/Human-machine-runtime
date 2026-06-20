import type { MarketplaceClient } from '../gateway/clients/marketplace-client.js';

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  downloads: number;
  rating: number;
}

export interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  capabilities: string[];
}

export interface IAuditSink {
  log(type: string, payload: Record<string, unknown>): void;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PublishRequest {
  id: string;
  skillSlug: string;
  tenantId: string;
  actor: string;
  version?: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface IApprovalStore {
  create(req: Omit<PublishRequest, 'id' | 'createdAt'>): Promise<PublishRequest>;
  findPending(tenantId: string): Promise<PublishRequest[]>;
  findById(id: string): Promise<PublishRequest | null>;
  update(id: string, patch: Partial<PublishRequest>): Promise<PublishRequest | null>;
}

export class MarketplaceService {
  private client: MarketplaceClient;
  private audit: IAuditSink | null;
  private approvalStore: IApprovalStore | null;

  constructor(client: MarketplaceClient, audit?: IAuditSink, approvalStore?: IApprovalStore) {
    this.client = client;
    this.audit = audit ?? null;
    this.approvalStore = approvalStore ?? null;
  }

  /** 技能市场后端（marketplace）未配置时明确拒绝，而非崩溃。 */
  private requireConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new Error('Marketplace backend (marketplace) not configured — set MARKETPLACE_API_URL');
    }
  }

  async listSkills(
    params: { keyword?: string; page?: number; pageSize?: number } = {}
  ): Promise<unknown> {
    this.requireConfigured();
    return this.client.listSkills({
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    });
  }

  async listSkillsForTenant(
    tenantId: string,
    params: { keyword?: string; page?: number; pageSize?: number } = {}
  ): Promise<unknown> {
    this.requireConfigured();
    const result = await this.client.listSkills({
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 50,
    });
    this.audit?.log('marketplace.skill.listed', { tenantId, keyword: params.keyword });
    return result;
  }

  async getSkill(id: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getSkill(id);
  }

  async searchSkills(keyword: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.searchSkills(keyword);
  }

  async requestPublish(
    skillSlug: string,
    data: { files?: Record<string, string>; version?: string; changelog?: string },
    actor: string,
    tenantId: string
  ): Promise<PublishRequest | unknown> {
    this.requireConfigured();
    if (!this.approvalStore) {
      const result = await this.client.publishSkill(skillSlug, data);
      this.audit?.log('marketplace.skill.published', { skillSlug, actor, version: data.version });
      return result;
    }

    const req = await this.approvalStore.create({
      skillSlug,
      tenantId,
      actor,
      version: data.version,
      status: 'pending',
    });
    this.audit?.log('marketplace.skill.publish_requested', {
      requestId: req.id,
      skillSlug,
      actor,
      tenantId,
    });
    return req;
  }

  async listPendingApprovals(tenantId: string): Promise<PublishRequest[]> {
    if (!this.approvalStore) return [];
    return this.approvalStore.findPending(tenantId);
  }

  async approvePublish(
    requestId: string,
    reviewer: string,
    authToken?: string
  ): Promise<PublishRequest | null> {
    this.requireConfigured();
    if (!this.approvalStore) return null;
    const req = await this.approvalStore.findById(requestId);
    if (!req || req.status !== 'pending') return null;

    await this.client.publishSkill(req.skillSlug, { version: req.version }, authToken);
    const updated = await this.approvalStore.update(requestId, {
      status: 'approved',
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
    });
    this.audit?.log('marketplace.skill.publish_approved', {
      requestId,
      skillSlug: req.skillSlug,
      reviewer,
    });
    return updated;
  }

  async rejectPublish(
    requestId: string,
    reviewer: string,
    reason?: string
  ): Promise<PublishRequest | null> {
    if (!this.approvalStore) return null;
    const req = await this.approvalStore.findById(requestId);
    if (!req || req.status !== 'pending') return null;

    const updated = await this.approvalStore.update(requestId, {
      status: 'rejected',
      reviewedBy: reviewer,
      reviewNote: reason,
      reviewedAt: new Date().toISOString(),
    });
    this.audit?.log('marketplace.skill.publish_rejected', {
      requestId,
      skillSlug: req.skillSlug,
      reviewer,
      reason,
    });
    return updated;
  }

  async publishSkill(
    slug: string,
    data: { files?: Record<string, string>; version?: string; changelog?: string },
    actor?: string,
    authToken?: string
  ): Promise<unknown> {
    this.requireConfigured();
    const result = await this.client.publishSkill(slug, data, authToken);
    this.audit?.log('marketplace.skill.published', { slug, actor, version: data.version });
    return result;
  }

  async moderateSkill(
    skillId: string,
    action: 'approve' | 'reject',
    actor: string,
    note?: string,
    authToken?: string
  ): Promise<unknown> {
    this.requireConfigured();
    const result = await this.client.moderateSkill(skillId, action, note, authToken);
    this.audit?.log('marketplace.skill.moderated', { skillId, action, actor, note });
    return result;
  }

  async downloadSkill(skillId: string, version?: string, authToken?: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.downloadSkill(skillId, version, authToken);
  }

  async getSkillStats(skillId: string, authToken?: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getSkillStats(skillId, authToken);
  }

  async listAgents(
    params: { keyword?: string; page?: number; pageSize?: number } = {}
  ): Promise<unknown> {
    this.requireConfigured();
    return this.client.listAgents({
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    });
  }

  async getAgent(id: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getAgent(id);
  }

  async getModerationQueue(
    params?: { type?: string; page?: number; pageSize?: number },
    authToken?: string
  ): Promise<unknown> {
    this.requireConfigured();
    return this.client.adminModerationQueue(params, authToken);
  }
}
