import type { ProfileServiceClient } from '../gateway/clients/profile-service-client.js';
import type { LiteLLMClient } from '../gateway/clients/litellm-client.js';
import { logger } from '../../app/logger.js';

export interface TokenUsageSummary {
  tenantId: string;
  period: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  byModel: { model: string; tokens: number; cost: number; requests: number }[];
}

export interface ITokenUsageStore {
  upsertSnapshot(data: {
    tenantId: string;
    userUid?: string;
    model?: string;
    timeBucket: Date;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCost: number;
    requestCount: number;
  }): Promise<void>;
  getSummary(tenantId: string, since: Date): Promise<TokenUsageSummary>;
}

export class TokenUsageService {
  private profileServiceClient: ProfileServiceClient;
  private litellmClient: LiteLLMClient;
  private store: ITokenUsageStore | null;

  constructor(
    profileServiceClient: ProfileServiceClient,
    litellmClient: LiteLLMClient,
    store?: ITokenUsageStore
  ) {
    this.profileServiceClient = profileServiceClient;
    this.litellmClient = litellmClient;
    this.store = store ?? null;
  }

  async getUsageSummary(tenantId: string, period = '30d'): Promise<TokenUsageSummary> {
    if (this.store) {
      const since = this.periodToDate(period);
      return this.store.getSummary(tenantId, since);
    }

    return {
      tenantId,
      period,
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      byModel: [],
    };
  }

  async syncFromPortal(agentId: string, tenantId: string, period?: string): Promise<void> {
    if (!this.profileServiceClient.isConfigured() || !this.store) return;
    try {
      const usage = (await this.profileServiceClient.getUsageSummary(agentId, period)) as Record<
        string,
        unknown
      >;
      if (usage && typeof usage === 'object') {
        await this.store.upsertSnapshot({
          tenantId,
          model: String(usage.model ?? 'unknown'),
          timeBucket: new Date(),
          promptTokens: Number(usage.promptTokens ?? 0),
          completionTokens: Number(usage.completionTokens ?? 0),
          totalTokens: Number(usage.totalTokens ?? 0),
          totalCost: Number(usage.totalCost ?? 0),
          requestCount: Number(usage.requestCount ?? 0),
        });
      }
    } catch (err) {
      logger.warn({ agentId, tenantId, err }, 'token usage sync from profile service failed');
    }
  }

  async getLiteLLMSpend(startDate?: string, endDate?: string) {
    if (!this.litellmClient.isConfigured()) return null;
    return this.litellmClient.getSpend({ startDate, endDate });
  }

  private periodToDate(period: string): Date {
    const num = parseInt(period, 10) || 30;
    return new Date(Date.now() - num * 86_400_000);
  }
}
