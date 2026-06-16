import type { Database } from '../client.js';
import type { TraceFilters } from './ai-gateway/helpers.js';
import {
  listModels as listModelsQ,
  getModel as getModelQ,
  createModel as createModelQ,
  updateModel as updateModelQ,
  deleteModel as deleteModelQ,
  toggleModel as toggleModelQ,
} from './ai-gateway/model-queries.js';
import {
  listGrantsByModel as listGrantsByModelQ,
  listGrantsByInstance as listGrantsByInstanceQ,
  setModelGrants as setModelGrantsQ,
  countGrantsByModel as countGrantsByModelQ,
} from './ai-gateway/grant-queries.js';
import {
  getInstanceKey as getInstanceKeyQ,
  listInstanceKeys as listInstanceKeysQ,
  upsertInstanceKey as upsertInstanceKeyQ,
  deleteInstanceKey as deleteInstanceKeyQ,
} from './ai-gateway/key-queries.js';
import {
  deleteTracesBefore as deleteTracesBeforeQ,
  listTraces as listTracesQ,
  getTraceDetail as getTraceDetailQ,
  getTraceStats as getTraceStatsQ,
  insertTrace as insertTraceQ,
  traceExistsByRequestId as traceExistsByRequestIdQ,
} from './ai-gateway/trace-queries.js';
import {
  listDistributedTraces as listDistributedTracesQ,
  getDistributedTraceDetail as getDistributedTraceDetailQ,
  insertDistributedTrace as insertDistributedTraceQ,
  updateDistributedTrace as updateDistributedTraceQ,
} from './ai-gateway/distributed-trace-queries.js';
import {
  listRiskRules as listRiskRulesQ,
  getRiskRule as getRiskRuleQ,
  createRiskRule as createRiskRuleQ,
  updateRiskRule as updateRiskRuleQ,
  deleteRiskRule as deleteRiskRuleQ,
  toggleRiskRule as toggleRiskRuleQ,
} from './ai-gateway/risk-queries.js';
import {
  insertCostRecord as insertCostRecordQ,
  getCostSummary as getCostSummaryQ,
  getCostAnalysis as getCostAnalysisQ,
} from './ai-gateway/cost-queries.js';

/**
 * AI Gateway 仓储（薄委托层）。
 *
 * 实际查询逻辑按聚合根拆分到 `./ai-gateway/*-queries.ts`，本类仅保留方法签名
 * 与调用约定，确保 12 个调用方的 import 路径与方法 API 完全不变。
 */
export class AiGatewayRepository {
  constructor(private db: Database) {}

  /* ──── Models ──── */

  async listModels() {
    return listModelsQ(this.db);
  }

  async getModel(id: number) {
    return getModelQ(this.db, id);
  }

  async createModel(data: {
    displayName: string;
    description?: string;
    providerType: string;
    protocolType: string;
    baseUrl: string;
    providerModelName?: string;
    modelName?: string;
    apiKey?: string;
    apiKeySecretRef?: string;
    isSecure?: boolean;
    isActive?: boolean;
    inputPrice?: number;
    outputPrice?: number;
    cacheReadCost?: number;
    cacheCreationCost?: number;
    currency?: string;
    maxTokens?: number;
    timeout?: number;
    streamTimeout?: number;
    rateLimitPerMin?: number;
  }) {
    return createModelQ(this.db, data);
  }

  async updateModel(
    id: number,
    patch: Partial<{
      displayName: string;
      description: string;
      providerType: string;
      protocolType: string;
      baseUrl: string;
      providerModelName: string;
      modelName: string;
      apiKey: string;
      apiKeySecretRef: string;
      isSecure: boolean;
      isActive: boolean;
      healthStatus: string;
      lastHealthCheckAt: Date;
      inputPrice: number;
      outputPrice: number;
      cacheReadCost: number;
      cacheCreationCost: number;
      currency: string;
      maxTokens: number;
      timeout: number;
      streamTimeout: number;
      rateLimitPerMin: number;
    }>
  ) {
    return updateModelQ(this.db, id, patch);
  }

  async deleteModel(id: number) {
    return deleteModelQ(this.db, id);
  }

  async toggleModel(id: number) {
    return toggleModelQ(this.db, id);
  }

  /* ──── Model Grants（instance × model 白名单，默认关闭） ──── */

  /** 查询某模型已授权的 instanceId 列表 */
  async listGrantsByModel(modelId: number): Promise<string[]> {
    return listGrantsByModelQ(this.db, modelId);
  }

  /** 查询某 instance 已被授权的 modelId 列表 */
  async listGrantsByInstance(instanceId: string): Promise<number[]> {
    return listGrantsByInstanceQ(this.db, instanceId);
  }

  /** 全量覆盖某模型的授权集合（事务内 delete + insert） */
  async setModelGrants(
    modelId: number,
    instanceIds: string[],
    tenantId: string,
    grantedBy?: string
  ): Promise<string[]> {
    return setModelGrantsQ(this.db, modelId, instanceIds, tenantId, grantedBy);
  }

  /** 批量统计每个模型的授权数（卡片徽标用） */
  async countGrantsByModel(): Promise<{ modelId: number; count: number }[]> {
    return countGrantsByModelQ(this.db);
  }

  /* ──── Instance LLM Keys（virtual key 缓存） ──── */

  async getInstanceKey(instanceId: string) {
    return getInstanceKeyQ(this.db, instanceId);
  }

  async listInstanceKeys(): Promise<
    {
      instanceId: string;
      tenantId: string;
      litellmKey: string;
      litellmKeyId: string | null;
      allowedModels: string[];
      syncStatus: string;
      lastError: string | null;
      syncedAt: Date;
    }[]
  > {
    return listInstanceKeysQ(this.db);
  }

  async upsertInstanceKey(data: {
    instanceId: string;
    tenantId: string;
    litellmKey: string;
    litellmKeyId?: string | null;
    allowedModels: string[];
    syncStatus?: string;
    lastError?: string | null;
  }) {
    return upsertInstanceKeyQ(this.db, data);
  }

  async deleteInstanceKey(instanceId: string) {
    return deleteInstanceKeyQ(this.db, instanceId);
  }

  /* ──── Traces ──── */

  /** 删除 created_at < before 的 trace（按 trace_id 级联清理 flow_nodes/risk_hits/cost_records）。返回删除条数 */
  async deleteTracesBefore(before: Date): Promise<number> {
    return deleteTracesBeforeQ(this.db, before);
  }

  async listTraces(filters?: TraceFilters & { page?: number; limit?: number }) {
    return listTracesQ(this.db, filters);
  }

  async getTraceDetail(traceId: string) {
    return getTraceDetailQ(this.db, traceId);
  }

  /* ──── Distributed Traces ──── */

  async listDistributedTraces(filters?: {
    status?: string;
    userId?: string;
    instanceId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    return listDistributedTracesQ(this.db, filters);
  }

  async getDistributedTraceDetail(traceId: string) {
    return getDistributedTraceDetailQ(this.db, traceId);
  }

  async insertDistributedTrace(data: {
    traceId: string;
    rootOperation?: string;
    userId?: string;
    instanceId?: string;
    sessionId?: string;
    tags?: Record<string, unknown>;
  }) {
    return insertDistributedTraceQ(this.db, data);
  }

  async updateDistributedTrace(
    traceId: string,
    patch: Partial<{
      spanCount: number;
      status: string;
      totalTokens: number;
      totalCost: number;
      totalDurationMs: number;
      completedAt: Date;
    }>
  ) {
    return updateDistributedTraceQ(this.db, traceId, patch);
  }

  async getTraceStats(filters?: { dateFrom?: string; dateTo?: string }) {
    return getTraceStatsQ(this.db, filters);
  }

  /* ──── Risk Rules ──── */

  async listRiskRules() {
    return listRiskRulesQ(this.db);
  }

  async getRiskRule(ruleId: string) {
    return getRiskRuleQ(this.db, ruleId);
  }

  async createRiskRule(data: {
    ruleId: string;
    displayName: string;
    description?: string;
    pattern: string;
    severity: string;
    action: string;
    category?: string;
    isEnabled?: boolean;
    sortOrder?: number;
  }) {
    return createRiskRuleQ(this.db, data);
  }

  async updateRiskRule(
    ruleId: string,
    patch: Partial<{
      displayName: string;
      description: string;
      pattern: string;
      severity: string;
      action: string;
      category: string;
      isEnabled: boolean;
      sortOrder: number;
    }>
  ) {
    return updateRiskRuleQ(this.db, ruleId, patch);
  }

  async deleteRiskRule(ruleId: string) {
    return deleteRiskRuleQ(this.db, ruleId);
  }

  async toggleRiskRule(ruleId: string) {
    return toggleRiskRuleQ(this.db, ruleId);
  }

  /* ──── Trace Write ──── */

  async insertTrace(data: {
    traceId: string;
    sessionId: string;
    requestId: string;
    userId?: string;
    instanceId?: string;
    apiKeyHash?: string;
    requestedModel: string;
    actualModel?: string;
    providerType?: string;
    status: string;
    promptTokens: number;
    completionTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    latencyMs: number;
    inputCost?: number;
    outputCost?: number;
    estimatedCost?: number;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    completedAt?: Date;
    // ── 分布式追踪字段 ──
    distTraceId?: string;
    parentSpanId?: string;
    operationName?: string;
    spanKind?: string;
    startTime?: Date;
  }) {
    return insertTraceQ(this.db, data);
  }

  async insertCostRecord(data: {
    traceId: string;
    userId?: string;
    model: string;
    providerType: string;
    promptTokens: number;
    completionTokens: number;
    inputPrice?: number;
    outputPrice?: number;
    currency?: string;
    exchangeRate?: number;
    costOriginal: number;
    costCny: number;
  }) {
    return insertCostRecordQ(this.db, data);
  }

  async traceExistsByRequestId(requestId: string): Promise<boolean> {
    return traceExistsByRequestIdQ(this.db, requestId);
  }

  /* ──── Costs ──── */

  async getCostSummary() {
    return getCostSummaryQ(this.db);
  }

  async getCostAnalysis(filters?: { dateFrom?: string; dateTo?: string }) {
    return getCostAnalysisQ(this.db, filters);
  }
}
