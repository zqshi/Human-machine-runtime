import { eq, and, gte, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { tokenUsageSnapshots } from '../schema/observability.js';
import type {
  ITokenUsageStore,
  TokenUsageSummary,
} from '../../contexts/observability/token-usage-service.js';

export class TokenUsageRepository implements ITokenUsageStore {
  constructor(private db: Database) {}

  async upsertSnapshot(data: {
    tenantId: string;
    userUid?: string;
    model?: string;
    timeBucket: Date;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCost: number;
    requestCount: number;
  }): Promise<void> {
    await this.db.insert(tokenUsageSnapshots).values({
      tenantId: data.tenantId,
      userUid: data.userUid ?? null,
      model: data.model ?? null,
      timeBucket: data.timeBucket,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      totalCost: data.totalCost,
      requestCount: data.requestCount,
    });
  }

  async getSummary(tenantId: string, since: Date): Promise<TokenUsageSummary> {
    const [totals] = await this.db
      .select({
        totalTokens: sql<number>`coalesce(sum(total_tokens), 0)::int`,
        totalCost: sql<number>`coalesce(sum(total_cost), 0)::real`,
        requestCount: sql<number>`coalesce(sum(request_count), 0)::int`,
      })
      .from(tokenUsageSnapshots)
      .where(
        and(eq(tokenUsageSnapshots.tenantId, tenantId), gte(tokenUsageSnapshots.timeBucket, since))
      );

    const byModel = await this.db
      .select({
        model: tokenUsageSnapshots.model,
        tokens: sql<number>`coalesce(sum(total_tokens), 0)::int`,
        cost: sql<number>`coalesce(sum(total_cost), 0)::real`,
        requests: sql<number>`coalesce(sum(request_count), 0)::int`,
      })
      .from(tokenUsageSnapshots)
      .where(
        and(eq(tokenUsageSnapshots.tenantId, tenantId), gte(tokenUsageSnapshots.timeBucket, since))
      )
      .groupBy(tokenUsageSnapshots.model);

    return {
      tenantId,
      period: `since ${since.toISOString().split('T')[0]}`,
      totalTokens: totals?.totalTokens ?? 0,
      totalCost: totals?.totalCost ?? 0,
      requestCount: totals?.requestCount ?? 0,
      byModel: byModel.map((r) => ({
        model: r.model ?? 'unknown',
        tokens: r.tokens,
        cost: r.cost,
        requests: r.requests,
      })),
    };
  }
}
