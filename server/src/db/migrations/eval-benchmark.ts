import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateEvalBenchmark(db: MigrateDb): Promise<void> {
  // ─── eval_suites ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_suites (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      config_type VARCHAR(32) NOT NULL DEFAULT 'ideal_output',
      category_weights JSONB,
      version INTEGER NOT NULL DEFAULT 1,
      tenant_id VARCHAR(64),
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      total_cases INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── eval_cases ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_cases (
      id VARCHAR(64) PRIMARY KEY,
      suite_id VARCHAR(64) NOT NULL,
      case_key VARCHAR(64) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      category VARCHAR(64) NOT NULL,
      subcategory VARCHAR(64),
      difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
      task_description TEXT NOT NULL,
      context JSONB,
      eval_type VARCHAR(32) NOT NULL,
      expected_output JSONB,
      expected_behavior TEXT,
      expected_trajectory TEXT,
      expected_tools JSONB,
      match_rules JSONB,
      rubric JSONB,
      tags JSONB,
      mcp_tools_involved JSONB,
      skills_involved JSONB,
      regression_source VARCHAR(128),
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      consecutive_pass_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── eval_runs ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id VARCHAR(64) PRIMARY KEY,
      suite_id VARCHAR(64) NOT NULL,
      trigger_type VARCHAR(32) NOT NULL,
      config_version VARCHAR(64),
      baseline_run_id VARCHAR(64),
      employee_id VARCHAR(64),
      environment VARCHAR(16) NOT NULL DEFAULT 'staging',
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      total_cases INTEGER NOT NULL DEFAULT 0,
      completed_cases INTEGER NOT NULL DEFAULT 0,
      passed_cases INTEGER NOT NULL DEFAULT 0,
      overall_score REAL,
      dimension_scores JSONB,
      verdict VARCHAR(16),
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      tenant_id VARCHAR(64),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── eval_results ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_results (
      id SERIAL PRIMARY KEY,
      run_id VARCHAR(64) NOT NULL,
      case_id VARCHAR(64) NOT NULL,
      score REAL,
      dimension_scores JSONB,
      actual_output TEXT,
      tool_calls_log JSONB,
      duration_ms INTEGER,
      token_usage INTEGER,
      judge_response JSONB,
      passed BOOLEAN,
      regression BOOLEAN DEFAULT false,
      failure_reason TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── eval_replay_queue ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_replay_queue (
      id SERIAL PRIMARY KEY,
      trace_id VARCHAR(128) NOT NULL,
      trigger_reason VARCHAR(32) NOT NULL,
      original_input TEXT,
      agent_output TEXT,
      user_correction TEXT,
      failure_mode VARCHAR(32),
      review_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      promoted_case_id VARCHAR(64),
      reviewed_by VARCHAR(64),
      reviewed_at TIMESTAMPTZ,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── eval_alert_rules ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_alert_rules (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      condition_expr TEXT NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'medium',
      action_type VARCHAR(32) NOT NULL DEFAULT 'notify',
      notification_channels JSONB,
      enabled BOOLEAN NOT NULL DEFAULT true,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── Indexes ───
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_suites_tenant ON eval_suites(tenant_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_suites_status ON eval_suites(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_cases_suite ON eval_cases(suite_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_cases_category ON eval_cases(category)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_cases_difficulty ON eval_cases(difficulty)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_cases_status ON eval_cases(status)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_cases_eval_type ON eval_cases(eval_type)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_suite ON eval_runs(suite_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON eval_runs(status)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_trigger ON eval_runs(trigger_type)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs(created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_tenant ON eval_runs(tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_results(run_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_results_case ON eval_results(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_results_passed ON eval_results(passed)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_replay_status ON eval_replay_queue(review_status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_replay_trigger ON eval_replay_queue(trigger_reason)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_replay_tenant ON eval_replay_queue(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_alert_rules_tenant ON eval_alert_rules(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_alert_rules_enabled ON eval_alert_rules(enabled)`
  );

  // ─── Add employee_id to eval_runs (idempotent) ───
  await db.execute(sql`
    ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS employee_id VARCHAR(64)
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_employee ON eval_runs(employee_id)`
  );

  // ─── eval_evaluators ───
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_evaluators (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      type VARCHAR(32) NOT NULL,
      dimensions JSONB NOT NULL DEFAULT '[]',
      scoring_rubric JSONB DEFAULT '[]',
      rule_config JSONB,
      judge_config JSONB,
      threshold REAL NOT NULL DEFAULT 0.8,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ─── Add evaluator_ids to eval_runs (idempotent) ───
  await db.execute(sql`
    ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS evaluator_ids JSONB
  `);

  // ─── Add config_type to eval_suites (idempotent) ───
  await db.execute(sql`
    ALTER TABLE eval_suites ADD COLUMN IF NOT EXISTS config_type VARCHAR(32) NOT NULL DEFAULT 'ideal_output'
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_suites_config_type ON eval_suites(config_type)`
  );

  // ─── Add expected_trajectory to eval_cases (idempotent) ───
  await db.execute(sql`
    ALTER TABLE eval_cases ADD COLUMN IF NOT EXISTS expected_trajectory TEXT
  `);

  // ─── Evaluator indexes ───
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_evaluators_type ON eval_evaluators(type)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_evaluators_status ON eval_evaluators(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_evaluators_tenant ON eval_evaluators(tenant_id)`
  );

  // ─── Add eval_type to eval_suites (idempotent) ───
  await db.execute(sql`
    ALTER TABLE eval_suites ADD COLUMN IF NOT EXISTS eval_type VARCHAR(32)
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_eval_suites_eval_type ON eval_suites(eval_type)`
  );

  // ─── Clean up old mixed suites — will be re-imported as split presets ───
  await db.execute(sql`
    DELETE FROM eval_cases WHERE suite_id IN (SELECT id FROM eval_suites)
  `);
  await db.execute(sql`
    DELETE FROM eval_suites
  `);
}
