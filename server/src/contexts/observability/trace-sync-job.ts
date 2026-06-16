import type { LiteLLMClient, SpendLogEntry } from '../gateway/clients/litellm-client.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import { logger } from '../../app/logger.js';

const USD_TO_CNY = 7.2;

export class TraceSyncJob {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSyncAt: Date;
  private syncing = false;

  constructor(
    private litellmClient: LiteLLMClient,
    private aiRepo: AiGatewayRepository,
    private intervalMs = 60_000
  ) {
    this.lastSyncAt = new Date(Date.now() - 24 * 3600_000);
  }

  start(): void {
    if (this.timer) return;
    if (!this.litellmClient.isConfigured()) {
      logger.info('trace-sync: LiteLLM not configured, skipping');
      return;
    }
    logger.info({ intervalMs: this.intervalMs }, 'trace-sync: started');
    this.sync();
    this.timer = setInterval(() => this.sync(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('trace-sync: stopped');
    }
  }

  async sync(): Promise<number> {
    if (this.syncing) return 0;
    this.syncing = true;
    let synced = 0;

    try {
      const startDate = this.lastSyncAt.toISOString().split('T')[0];
      const now = new Date();
      const endDate = new Date(now.getTime() + 86400_000).toISOString().split('T')[0];

      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const result = await this.litellmClient.getSpendLogs({
          startDate,
          endDate,
          page,
          pageSize,
        });
        const logs = result.data;

        if (logs.length === 0) break;

        const cutoff = this.lastSyncAt.getTime();
        for (const log of logs) {
          const t = new Date(log.startTime).getTime();
          if (t <= cutoff) continue;

          try {
            const exists = await this.aiRepo.traceExistsByRequestId(log.request_id);
            if (exists) continue;

            await this.writeTrace(log);
            synced++;
          } catch (err) {
            logger.warn({ requestId: log.request_id, err }, 'trace-sync: failed to write trace');
          }
        }

        const maxTime = Math.max(...logs.map((l) => new Date(l.startTime).getTime()));
        if (maxTime > this.lastSyncAt.getTime()) {
          this.lastSyncAt = new Date(maxTime);
        }

        hasMore = logs.length >= pageSize && page * pageSize < result.total;
        page++;
      }

      if (synced > 0) {
        logger.info({ synced }, 'trace-sync: batch complete');
      }
    } catch (err) {
      logger.warn({ err }, 'trace-sync: fetch failed');
    } finally {
      this.syncing = false;
    }

    return synced;
  }

  private async writeTrace(log: SpendLogEntry): Promise<void> {
    const startTime = new Date(log.startTime);
    const endTime = log.endTime ? new Date(log.endTime) : null;
    const latencyMs = endTime ? endTime.getTime() - startTime.getTime() : 0;

    const metadata = log.metadata ?? {};
    const userId = log.user || (metadata.user as string) || null;
    const instanceId = (metadata.instance_id as string) || null;
    const apiKeyHash = log.api_key || null;
    const sessionId = (metadata.session_id as string) || log.call_type || 'sync';
    const status = log.spend != null ? 'success' : 'error';
    const provider = log.custom_llm_provider || inferProvider(log.model);

    const promptTokens = log.prompt_tokens || 0;
    const completionTokens = log.completion_tokens || 0;
    const cacheReadTokens = log.cache_hit ? promptTokens : 0;
    const cacheCreationTokens = 0; // LiteLLM spend logs 不携带此数据
    const spend = log.spend || 0;
    const totalTokens = promptTokens + completionTokens;
    const inputRatio = totalTokens > 0 ? promptTokens / totalTokens : 0.5;
    const inputCost = spend * inputRatio;
    const outputCost = spend * (1 - inputRatio);

    await this.aiRepo.insertTrace({
      traceId: log.request_id,
      sessionId,
      requestId: log.request_id,
      userId: userId ?? undefined,
      instanceId: instanceId ?? undefined,
      apiKeyHash: apiKeyHash ?? undefined,
      requestedModel: log.model || 'unknown',
      actualModel: log.model || undefined,
      providerType: provider ?? undefined,
      status,
      promptTokens,
      completionTokens,
      cacheReadTokens,
      cacheCreationTokens,
      latencyMs,
      inputCost,
      outputCost,
      estimatedCost: spend,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      createdAt: startTime,
      completedAt: endTime ?? undefined,
    });

    await this.aiRepo.insertCostRecord({
      traceId: log.request_id,
      userId: userId ?? undefined,
      model: log.model || 'unknown',
      providerType: provider || 'unknown',
      promptTokens,
      completionTokens,
      costOriginal: spend,
      costCny: spend * USD_TO_CNY,
      currency: 'USD',
      exchangeRate: USD_TO_CNY,
    });
  }
}

function inferProvider(model: string): string {
  if (!model) return 'unknown';
  const m = model.toLowerCase();
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('gpt') || m.includes('o1') || m.includes('o3') || m.includes('o4'))
    return 'openai';
  if (m.includes('glm') || m.includes('zhipu')) return 'zhipu';
  if (m.includes('qwen')) return 'qwen';
  if (m.includes('gemini')) return 'google';
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('mistral')) return 'mistral';
  return 'unknown';
}
