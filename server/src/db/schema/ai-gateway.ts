import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { instances } from './instance.js';

export const llmModels = pgTable(
  'llm_models',
  {
    id: serial('id').primaryKey(),
    displayName: varchar('display_name', { length: 128 }).notNull().unique(),
    description: text('description'),
    providerType: varchar('provider_type', { length: 32 }).notNull(),
    protocolType: varchar('protocol_type', { length: 32 }).notNull(),
    baseUrl: text('base_url').notNull(),
    providerModelName: varchar('provider_model_name', { length: 128 }),
    apiKey: text('api_key'),
    apiKeySecretRef: text('api_key_secret_ref'),
    isSecure: boolean('is_secure').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    healthStatus: varchar('health_status', { length: 16 }),
    lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
    inputPrice: real('input_price').notNull().default(0.0),
    outputPrice: real('output_price').notNull().default(0.0),
    cacheReadCost: real('cache_read_cost'),
    cacheCreationCost: real('cache_creation_cost'),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    maxTokens: integer('max_tokens'),
    timeout: integer('timeout'),
    streamTimeout: integer('stream_timeout'),
    rateLimitPerMin: integer('rate_limit_per_min'),
    modelName: varchar('model_name', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_llm_models_provider').on(table.providerType),
    index('idx_llm_models_active').on(table.isActive),
  ]
);

export const discoveredModels = pgTable('discovered_models', {
  id: varchar('id', { length: 255 }).primaryKey(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  providerType: varchar('provider_type', { length: 32 }).notNull(),
  providerModelName: varchar('provider_model_name', { length: 128 }).notNull(),
  inputPrice: real('input_price'),
  outputPrice: real('output_price'),
  currency: varchar('currency', { length: 8 }),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  providerId: integer('provider_id').references(() => llmModels.id, { onDelete: 'set null' }),
});

// ── 分布式追踪：顶层 Trace ──
// 一次用户请求的完整传播路径，可包含多次 LLM 调用、工具调用、风险审查等 Span
export const distributedTraces = pgTable(
  'distributed_traces',
  {
    id: serial('id').primaryKey(),
    traceId: varchar('trace_id', { length: 64 }).notNull().unique(),
    rootOperation: varchar('root_operation', { length: 255 }).notNull().default('unknown'),
    // 调用者信息
    userId: varchar('user_id', { length: 64 }),
    instanceId: varchar('instance_id', { length: 64 }),
    sessionId: varchar('session_id', { length: 64 }),
    // 汇总信息
    spanCount: integer('span_count').notNull().default(0),
    status: varchar('status', { length: 32 }).notNull().default('running'),
    totalTokens: integer('total_tokens').notNull().default(0),
    totalCost: real('total_cost').notNull().default(0.0),
    totalDurationMs: integer('total_duration_ms').notNull().default(0),
    tags: jsonb('tags'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_dist_traces_user').on(table.userId),
    index('idx_dist_traces_instance').on(table.instanceId),
    index('idx_dist_traces_status').on(table.status),
    index('idx_dist_traces_created').on(table.createdAt),
  ]
);

// ── Span：一次具体操作（LLM 调用、工具执行、风险审查等） ──
// ai_traces 语义降级为 Span，通过 distTraceId 关联到 distributed_traces
export const aiTraces = pgTable(
  'ai_traces',
  {
    id: serial('id').primaryKey(),
    traceId: varchar('trace_id', { length: 64 }).notNull().unique(),
    // ── 关联顶层 Trace ──
    distTraceId: varchar('dist_trace_id', { length: 64 }),
    parentSpanId: varchar('parent_span_id', { length: 64 }),
    // ── Span 自身信息 ──
    operationName: varchar('operation_name', { length: 255 }).notNull().default('llm.call'),
    spanKind: varchar('span_kind', { length: 32 }).notNull().default('internal'),
    // ── 原有字段（向下兼容） ──
    sessionId: varchar('session_id', { length: 64 }).notNull(),
    requestId: varchar('request_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }),
    instanceId: varchar('instance_id', { length: 64 }),
    apiKeyHash: varchar('api_key_hash', { length: 64 }),
    requestedModel: varchar('requested_model', { length: 64 }).notNull().default('auto'),
    actualModel: varchar('actual_model', { length: 64 }),
    providerType: varchar('provider_type', { length: 32 }),
    status: varchar('status', { length: 32 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheCreationTokens: integer('cache_creation_tokens').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    inputCost: real('input_cost').notNull().default(0.0),
    outputCost: real('output_cost').notNull().default(0.0),
    estimatedCost: real('estimated_cost').notNull().default(0.0),
    startTime: timestamp('start_time', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_ai_traces_dist_trace').on(table.distTraceId),
    index('idx_ai_traces_parent_span').on(table.parentSpanId),
    index('idx_ai_traces_user').on(table.userId),
    index('idx_ai_traces_status').on(table.status),
    index('idx_ai_traces_created').on(table.createdAt),
  ]
);

export const aiFlowNodes = pgTable(
  'ai_flow_nodes',
  {
    id: serial('id').primaryKey(),
    traceId: varchar('trace_id', { length: 64 })
      .notNull()
      .references(() => aiTraces.traceId, { onDelete: 'cascade' }),
    nodeId: varchar('node_id', { length: 64 }).notNull().unique(),
    kind: varchar('kind', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }),
    model: varchar('model', { length: 64 }),
    status: varchar('status', { length: 32 }),
    summary: text('summary'),
    inputPayload: jsonb('input_payload'),
    outputPayload: jsonb('output_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // ── Span 追踪字段（分布式可观测性） ──
    spanId: varchar('span_id', { length: 64 }),
    parentId: varchar('parent_span_id', { length: 64 }),
    operationName: varchar('operation_name', { length: 255 }),
    startTime: timestamp('start_time', { withTimezone: true }),
    durationMs: integer('duration_ms').default(0),
    tags: jsonb('tags'),
  },
  (table) => [
    index('idx_flow_nodes_trace').on(table.traceId),
    index('idx_flow_nodes_span_id').on(table.spanId),
    index('idx_flow_nodes_parent').on(table.parentId),
  ]
);

export const aiRiskHits = pgTable(
  'ai_risk_hits',
  {
    id: serial('id').primaryKey(),
    traceId: varchar('trace_id', { length: 64 })
      .notNull()
      .references(() => aiTraces.traceId, { onDelete: 'cascade' }),
    ruleId: varchar('rule_id', { length: 64 }).notNull(),
    ruleName: varchar('rule_name', { length: 128 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    matchSummary: text('match_summary').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_risk_hits_trace').on(table.traceId)]
);

export const riskRules = pgTable(
  'risk_rules',
  {
    id: serial('id').primaryKey(),
    ruleId: varchar('rule_id', { length: 64 }).notNull().unique(),
    displayName: varchar('display_name', { length: 128 }).notNull(),
    description: text('description'),
    pattern: text('pattern').notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    category: varchar('category', { length: 32 }).notNull().default('custom'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_risk_rules_category').on(table.category),
    index('idx_risk_rules_enabled').on(table.isEnabled),
  ]
);

export const costRecords = pgTable(
  'cost_records',
  {
    id: serial('id').primaryKey(),
    traceId: varchar('trace_id', { length: 64 })
      .notNull()
      .references(() => aiTraces.traceId, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 }),
    model: varchar('model', { length: 64 }).notNull(),
    providerType: varchar('provider_type', { length: 32 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    inputPrice: real('input_price').notNull().default(0.0),
    outputPrice: real('output_price').notNull().default(0.0),
    currency: varchar('currency', { length: 8 }).notNull().default('CNY'),
    exchangeRate: real('exchange_rate').notNull().default(1.0),
    costOriginal: real('cost_original').notNull().default(0.0),
    costCny: real('cost_cny').notNull().default(0.0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_cost_records_user').on(table.userId),
    index('idx_cost_records_created').on(table.createdAt),
  ]
);

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: serial('id').primaryKey(),
    fromCurrency: varchar('from_currency', { length: 8 }).notNull(),
    toCurrency: varchar('to_currency', { length: 8 }).notNull().default('CNY'),
    rate: real('rate').notNull().default(1.0),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_exchange_rates_unique').on(
      table.fromCurrency,
      table.toCurrency,
      table.fetchedAt
    ),
  ]
);

// ── 模型授权：数字员工实例(instance) × 模型(llm_model) 的白名单关系 ──
// 语义：默认关闭 —— 未命中本表的 (instanceId, modelId) 组合在调用拦截时拒绝。
export const instanceModelGrants = pgTable(
  'instance_model_grants',
  {
    id: serial('id').primaryKey(),
    instanceId: varchar('instance_id', { length: 64 })
      .notNull()
      .references(() => instances.id, { onDelete: 'cascade' }),
    modelId: integer('model_id')
      .notNull()
      .references(() => llmModels.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    grantedBy: varchar('granted_by', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_instance_model_grants_unique').on(table.instanceId, table.modelId),
    index('idx_instance_model_grants_tenant').on(table.tenantId),
    index('idx_instance_model_grants_model').on(table.modelId),
    index('idx_instance_model_grants_instance').on(table.instanceId),
  ]
);

// ── LiteLLM virtual key 缓存：每个 instance 对应一把绑定 allowed_models 的 key ──
// KeySyncService 在 grants 变更时生成/更新；chat.ts 调用时用此 key 实现 per-instance 模型隔离。
export const instanceLlmKeys = pgTable(
  'instance_llm_keys',
  {
    id: serial('id').primaryKey(),
    instanceId: varchar('instance_id', { length: 64 })
      .notNull()
      .references(() => instances.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    /** LiteLLM 返回的 key 明文（调用时用）；轮换时覆盖 */
    litellmKey: text('litellm_key').notNull(),
    /** LiteLLM key 标识（删除/吊销用） */
    litellmKeyId: varchar('litellm_key_id', { length: 128 }),
    /** 该 key 绑定的允许模型别名快照（JSON 数组） */
    allowedModels: jsonb('allowed_models').$type<string[]>().notNull().default([]),
    /** 同步状态：synced / failed / stale */
    syncStatus: varchar('sync_status', { length: 16 }).notNull().default('synced'),
    lastError: text('last_error'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_instance_llm_keys_unique').on(table.instanceId),
    index('idx_instance_llm_keys_tenant').on(table.tenantId),
  ]
);
