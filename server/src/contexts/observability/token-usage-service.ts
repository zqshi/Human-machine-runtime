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

  /**
   * 记录一笔 token 用量(来自 claude-worker / agent executor / 任意真实 LLM 调用)。
   *
   * - 时间桶取当前时刻:TokenUsageRepository.upsertSnapshot 实际为 INSERT,
   *   查询时按时间范围 SUM 聚合,因此每次 record 都落一行新 snapshot。
   * - fire-and-forget 由调用方决定;此处返回 Promise,失败仅 log warn 不抛。
   * - store 未注入时(单测/未配 DB)直接 no-op。
   */
  async recordUsage(input: {
    tenantId: string;
    model?: string;
    inputTokens: number;
    outputTokens: number;
    source?: string;
  }): Promise<void> {
    if (!this.store) return;
    const { tenantId, model, inputTokens, outputTokens, source } = input;
    if (inputTokens === 0 && outputTokens === 0) return;
    const total = inputTokens + outputTokens;
    try {
      await this.store.upsertSnapshot({
        tenantId,
        model: model ?? 'unknown',
        timeBucket: new Date(),
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: total,
        // Claude Agent SDK 直接调用,未走 LiteLLM 计费,单价留 0 让分析侧按 model 估算
        totalCost: 0,
        requestCount: 1,
        ...(source ? { userUid: source } : {}),
      });
    } catch (err) {
      logger.warn({ tenantId, model, err }, 'token usage recordUsage failed');
    }
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
