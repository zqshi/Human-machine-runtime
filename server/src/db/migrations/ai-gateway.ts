import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateAiGateway(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS llm_models (
      id SERIAL PRIMARY KEY,
      display_name VARCHAR(128) NOT NULL UNIQUE,
      description TEXT,
      provider_type VARCHAR(32) NOT NULL,
      protocol_type VARCHAR(32) NOT NULL,
      base_url TEXT NOT NULL,
      provider_model_name VARCHAR(128),
      api_key TEXT,
      api_key_secret_ref TEXT,
      is_secure BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      input_price REAL NOT NULL DEFAULT 0.0,
      output_price REAL NOT NULL DEFAULT 0.0,
      currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS discovered_models (
      id VARCHAR(255) PRIMARY KEY,
      display_name VARCHAR(128) NOT NULL,
      provider_type VARCHAR(32) NOT NULL,
      provider_model_name VARCHAR(128) NOT NULL,
      input_price REAL,
      output_price REAL,
      currency VARCHAR(8),
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      provider_id INTEGER REFERENCES llm_models(id) ON DELETE SET NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_traces (
      id SERIAL PRIMARY KEY,
      trace_id VARCHAR(64) NOT NULL UNIQUE,
      session_id VARCHAR(64) NOT NULL,
      request_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64),
      instance_id VARCHAR(64),
      requested_model VARCHAR(64) NOT NULL DEFAULT 'auto',
      actual_model VARCHAR(64),
      provider_type VARCHAR(32),
      status VARCHAR(32) NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      input_cost REAL NOT NULL DEFAULT 0.0,
      output_cost REAL NOT NULL DEFAULT 0.0,
      estimated_cost REAL NOT NULL DEFAULT 0.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_flow_nodes (
      id SERIAL PRIMARY KEY,
      trace_id VARCHAR(64) NOT NULL REFERENCES ai_traces(trace_id) ON DELETE CASCADE,
      node_id VARCHAR(64) NOT NULL UNIQUE,
      kind VARCHAR(32) NOT NULL,
      title VARCHAR(255),
      model VARCHAR(64),
      status VARCHAR(32),
      summary TEXT,
      input_payload JSONB,
      output_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_risk_hits (
      id SERIAL PRIMARY KEY,
      trace_id VARCHAR(64) NOT NULL REFERENCES ai_traces(trace_id) ON DELETE CASCADE,
      rule_id VARCHAR(64) NOT NULL,
      rule_name VARCHAR(128) NOT NULL,
      severity VARCHAR(16) NOT NULL,
      action VARCHAR(32) NOT NULL,
      match_summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_rules (
      id SERIAL PRIMARY KEY,
      rule_id VARCHAR(64) NOT NULL UNIQUE,
      display_name VARCHAR(128) NOT NULL,
      description TEXT,
      pattern TEXT NOT NULL,
      severity VARCHAR(16) NOT NULL,
      action VARCHAR(32) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'custom',
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cost_records (
      id SERIAL PRIMARY KEY,
      trace_id VARCHAR(64) NOT NULL REFERENCES ai_traces(trace_id) ON DELETE CASCADE,
      user_id VARCHAR(64),
      model VARCHAR(64) NOT NULL,
      provider_type VARCHAR(32) NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      input_price REAL NOT NULL DEFAULT 0.0,
      output_price REAL NOT NULL DEFAULT 0.0,
      currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
      exchange_rate REAL NOT NULL DEFAULT 1.0,
      cost_original REAL NOT NULL DEFAULT 0.0,
      cost_cny REAL NOT NULL DEFAULT 0.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id SERIAL PRIMARY KEY,
      from_currency VARCHAR(8) NOT NULL,
      to_currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
      rate REAL NOT NULL DEFAULT 1.0,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(from_currency, to_currency, fetched_at)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_budgets (
      id VARCHAR(64) PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_failover_chains (
      id VARCHAR(64) PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ALTER columns
  await db.execute(
    sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown'`
  );
  await db.execute(
    sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ`
  );
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64)`);
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS metadata JSONB`);

  // ── ai_flow_nodes: Span 追踪字段 ──
  await db.execute(sql`ALTER TABLE ai_flow_nodes ADD COLUMN IF NOT EXISTS span_id VARCHAR(64)`);
  await db.execute(sql`ALTER TABLE ai_flow_nodes ADD COLUMN IF NOT EXISTS parent_span_id VARCHAR(64)`);
  await db.execute(sql`ALTER TABLE ai_flow_nodes ADD COLUMN IF NOT EXISTS operation_name VARCHAR(255)`);
  await db.execute(sql`ALTER TABLE ai_flow_nodes ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ`);
  await db.execute(sql`ALTER TABLE ai_flow_nodes ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0`);
  await db.execute(sql`ALTER TABLE ai_flow_nodes ADD COLUMN IF NOT EXISTS tags JSONB`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_flow_nodes_span_id ON ai_flow_nodes(span_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_flow_nodes_parent ON ai_flow_nodes(parent_span_id)`);

  // ── distributed_traces：顶层 Trace 表 ──
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS distributed_traces (
      id SERIAL PRIMARY KEY,
      trace_id VARCHAR(64) NOT NULL UNIQUE,
      root_operation VARCHAR(255) NOT NULL DEFAULT 'unknown',
      user_id VARCHAR(64),
      instance_id VARCHAR(64),
      session_id VARCHAR(64),
      span_count INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'running',
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0.0,
      total_duration_ms INTEGER NOT NULL DEFAULT 0,
      tags JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_dist_traces_user ON distributed_traces(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_dist_traces_instance ON distributed_traces(instance_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_dist_traces_status ON distributed_traces(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_dist_traces_created ON distributed_traces(created_at)`);

  // ── ai_traces 降级为 Span：新增 distTraceId / parentSpanId / operationName / spanKind / startTime ──
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS dist_trace_id VARCHAR(64)`);
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS parent_span_id VARCHAR(64)`);
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS operation_name VARCHAR(255) NOT NULL DEFAULT 'llm.call'`);
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS span_kind VARCHAR(32) NOT NULL DEFAULT 'internal'`);
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_traces_dist_trace ON ai_traces(dist_trace_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_traces_parent_span ON ai_traces(parent_span_id)`);

  // ── llm_models: 扩展 LiteLLM 对齐字段 ──
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS max_tokens INTEGER`);
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS timeout INTEGER`);
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS stream_timeout INTEGER`);
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS rate_limit_per_min INTEGER DEFAULT 60`);
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS cache_read_cost REAL`);
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS cache_creation_cost REAL`);
  await db.execute(sql`ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS model_name VARCHAR(128)`);

  // ── ai_traces: 缓存 Token 统计字段 ──
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS cache_read_tokens INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE ai_traces ADD COLUMN IF NOT EXISTS cache_creation_tokens INTEGER NOT NULL DEFAULT 0`);

  // ── 模型授权：instance × llm_model 白名单（默认关闭） ──
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS instance_model_grants (
      id SERIAL PRIMARY KEY,
      instance_id VARCHAR(64) NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      model_id INTEGER NOT NULL REFERENCES llm_models(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL,
      granted_by VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(instance_id, model_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_instance_model_grants_tenant ON instance_model_grants(tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_instance_model_grants_model ON instance_model_grants(model_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_instance_model_grants_instance ON instance_model_grants(instance_id)`);

  // ── LiteLLM virtual key 缓存：instance → 绑定 allowed_models 的 key ──
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS instance_llm_keys (
      id SERIAL PRIMARY KEY,
      instance_id VARCHAR(64) NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL,
      litellm_key TEXT NOT NULL,
      litellm_key_id VARCHAR(128),
      allowed_models JSONB NOT NULL DEFAULT '[]'::jsonb,
      sync_status VARCHAR(16) NOT NULL DEFAULT 'synced',
      last_error TEXT,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(instance_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_instance_llm_keys_tenant ON instance_llm_keys(tenant_id)`);
}
