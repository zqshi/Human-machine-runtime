/**
 * Eval Benchmark API Client
 *
 * Covers all /api/admin/eval/* routes.
 */

import { request } from './adminApiClient';

/* ──── Types ──── */

/** 工具调用记录 — 对齐 SpanItem 结构，Phase 1 为空数组，Phase 3 接入真实 Agent 后填充 */
export interface ToolCallEntry {
  spanId: string;
  parentId: string | null;
  operationName: string;
  startTime: string | null;
  durationMs: number;
  status: string;
  depth: number;
  tags?: Record<string, unknown> | null;
  model?: string | null;
  inputPayload?: unknown;
  outputPayload?: unknown;
}

export interface EvalSuite {
  id: string;
  name: string;
  description?: string;
  configType: 'ideal_output' | 'workflow';
  evalType?: string;
  categoryWeights?: Record<string, number>;
  version: number;
  tenantId?: string;
  status: string;
  totalCases: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvalCase {
  id: string;
  suiteId: string;
  caseKey: string;
  version: number;
  category: string;
  subcategory?: string;
  difficulty: string;
  taskDescription: string;
  context?: Record<string, unknown>;
  evalType: string;
  expectedOutput?: Record<string, unknown>;
  expectedBehavior?: string;
  expectedTrajectory?: string;
  expectedTools?: string[];
  matchRules?: Record<string, unknown>;
  rubric?: Record<string, unknown>;
  tags?: string[];
  mcpToolsInvolved?: string[];
  skillsInvolved?: string[];
  regressionSource?: string;
  status: string;
  consecutivePassCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvalRun {
  id: string;
  suiteId: string;
  triggerType: string;
  configVersion?: string;
  baselineRunId?: string;
  employeeId?: string;
  evaluatorIds?: string[];
  environment: string;
  status: string;
  totalCases: number;
  completedCases: number;
  passedCases: number;
  overallScore?: number;
  dimensionScores?: Record<string, number>;
  verdict?: string;
  totalTokens: number;
  totalCost: number;
  tenantId?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface EvalResult {
  id: number;
  runId: string;
  caseId: string;
  score?: number;
  dimensionScores?: Record<string, number>;
  actualOutput?: string;
  toolCallsLog?: ToolCallEntry[];
  durationMs?: number;
  tokenUsage?: number;
  judgeResponse?: {
    task_understanding?: number;
    execution_quality?: number;
    delivery_quality?: number;
    total?: number;
    comment?: string;
    top_issue?: string;
    [key: string]: unknown;
  } | Record<string, unknown>;
  passed?: boolean;
  regression?: boolean;
  failureReason?: string;
  status: string;
  createdAt: string;
}

export interface EvalReplayEntry {
  id: number;
  traceId: string;
  triggerReason: string;
  originalInput?: string;
  agentOutput?: string;
  userCorrection?: string;
  failureMode?: string;
  reviewStatus: string;
  promotedCaseId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  tenantId?: string;
  createdAt: string;
}

export interface EvalAlertRule {
  id: number;
  name: string;
  conditionExpr: string;
  severity: string;
  actionType: string;
  notificationChannels?: unknown;
  enabled: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvalDimension {
  key: string;
  label: string;
  weight: number;
  description?: string;
}

export interface ScoringRubricEntry {
  score: number;
  desc: string;
}

export interface RuleConfigItem {
  type: 'exact_match' | 'contains' | 'regex' | 'json_path_match' | 'script';
  field: string;
  value: string;
  weight: number;
  jsonPath?: string;
  language?: 'python' | 'javascript';
}

export interface JudgeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  promptTemplate: string;
}

export interface EvalEvaluator {
  id: string;
  name: string;
  description?: string;
  type: 'rule_based' | 'llm_judge' | 'hybrid';
  dimensions: EvalDimension[];
  scoringRubric: ScoringRubricEntry[];
  ruleConfig?: RuleConfigItem[];
  judgeConfig?: JudgeConfig;
  threshold: number;
  status: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  totalSuites: number;
  totalCases: number;
  totalRuns: number;
  latestScore: number | null;
  latestVerdict: string | null;
  avgScore10Runs: number | null;
  replayPendingCount: number;
  recentRuns: Array<{
    id: string;
    suiteId: string;
    employeeId?: string;
    overallScore: number | null;
    verdict: string | null;
    triggerType: string;
    status: string;
    createdAt: string;
    configVersion?: string;
    environment?: string;
    evaluatorIds?: string[];
  }>;
}

export interface EvalReport {
  runId: string;
  suiteId: string;
  configVersion?: string;
  baselineVersion?: string;
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    degraded: number;
    overallScore: number;
    baselineScore?: number;
    delta?: number;
    verdict: string;
  };
  dimensions: Record<string, { score: number; baseline?: number; delta?: number }>;
  failures: Array<{
    caseId: string;
    caseKey: string;
    category: string;
    expected: string;
    actual: string;
    score: number;
    regression: boolean;
  }>;
  improvements: Array<{
    caseId: string;
    caseKey: string;
    scoreBefore: number;
    scoreAfter: number;
  }>;
  recommendations: Array<{ priority: string; action: string }>;
  generatedAt: string;
}

/* ──── API ──── */

export const evalApi = {
  /* ── Preset Import ── */
  importPreset(): Promise<{
    imported: Array<{ suiteId: string; name: string; caseCount: number }>;
    skipped: string[];
    totalCases: number;
    message: string;
  }> {
    return request('/api/admin/eval/import-preset', { method: 'POST' });
  },

  /* ── Suites ── */
  listSuites(): Promise<{ suites: EvalSuite[] }> {
    return request('/api/admin/eval/suites');
  },
  getSuite(id: string): Promise<EvalSuite> {
    return request(`/api/admin/eval/suites/${encodeURIComponent(id)}`);
  },
  createSuite(data: {
    name: string;
    description?: string;
    configType?: 'ideal_output' | 'workflow';
    evalType?: string;
    categoryWeights?: Record<string, number>;
  }): Promise<EvalSuite> {
    return request('/api/admin/eval/suites', { method: 'POST', body: JSON.stringify(data) });
  },
  updateSuite(id: string, data: Partial<EvalSuite>): Promise<EvalSuite> {
    return request(`/api/admin/eval/suites/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteSuite(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/eval/suites/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ── Cases ── */
  listCases(
    suiteId: string,
    filters?: { category?: string; difficulty?: string; evalType?: string }
  ): Promise<{ cases: EvalCase[]; total: number }> {
    const qs = new URLSearchParams();
    if (filters?.category) qs.set('category', filters.category);
    if (filters?.difficulty) qs.set('difficulty', filters.difficulty);
    if (filters?.evalType) qs.set('evalType', filters.evalType);
    const q = qs.toString();
    return request(
      `/api/admin/eval/suites/${encodeURIComponent(suiteId)}/cases${q ? `?${q}` : ''}`
    );
  },
  getCase(id: string): Promise<EvalCase> {
    return request(`/api/admin/eval/cases/${encodeURIComponent(id)}`);
  },
  createCase(
    data: Partial<EvalCase> & {
      suiteId: string;
      caseKey: string;
      category: string;
      taskDescription: string;
      evalType: string;
    }
  ): Promise<EvalCase> {
    return request('/api/admin/eval/cases', { method: 'POST', body: JSON.stringify(data) });
  },
  batchCreateCases(
    cases: Array<
      Partial<EvalCase> & {
        suiteId: string;
        caseKey: string;
        category: string;
        taskDescription: string;
        evalType: string;
      }
    >
  ): Promise<{ cases: EvalCase[]; total: number }> {
    return request('/api/admin/eval/cases/batch', {
      method: 'POST',
      body: JSON.stringify({ cases }),
    });
  },
  updateCase(id: string, data: Partial<EvalCase>): Promise<EvalCase> {
    return request(`/api/admin/eval/cases/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteCase(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/eval/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ── Runs ── */
  listRuns(opts?: { suiteId?: string; status?: string; employeeId?: string }): Promise<{ runs: EvalRun[] }> {
    const qs = new URLSearchParams();
    if (opts?.suiteId) qs.set('suiteId', opts.suiteId);
    if (opts?.status) qs.set('status', opts.status);
    if (opts?.employeeId) qs.set('employeeId', opts.employeeId);
    const q = qs.toString();
    return request(`/api/admin/eval/runs${q ? `?${q}` : ''}`);
  },
  getRun(id: string): Promise<EvalRun> {
    return request(`/api/admin/eval/runs/${encodeURIComponent(id)}`);
  },
  startRun(data: {
    suiteId: string;
    triggerType?: string;
    configVersion?: string;
    baselineRunId?: string;
    employeeId?: string;
    modelId?: string;
    environment?: string;
    evaluatorIds?: string[];
  }): Promise<EvalRun> {
    return request('/api/admin/eval/runs', { method: 'POST', body: JSON.stringify(data) });
  },
  getRunResults(runId: string): Promise<{ results: EvalResult[] }> {
    return request(`/api/admin/eval/runs/${encodeURIComponent(runId)}/results`);
  },
  getRunReport(runId: string): Promise<EvalReport> {
    return request(`/api/admin/eval/runs/${encodeURIComponent(runId)}/report`);
  },

  /* ── Dashboard ── */
  getDashboardMetrics(): Promise<DashboardMetrics> {
    return request('/api/admin/eval/dashboard/metrics');
  },
  getDashboardTrends(days?: number): Promise<{
    trends: Array<{ id: string; overallScore: number; verdict: string; createdAt: string }>;
  }> {
    const qs = days ? `?days=${days}` : '';
    return request(`/api/admin/eval/dashboard/trends${qs}`);
  },
  getCategoryHeatmap(runId: string): Promise<{
    heatmap: Array<{
      category: string;
      total: number;
      passed: number;
      passRate: number;
      avgScore: number;
    }>;
  }> {
    return request(`/api/admin/eval/dashboard/heatmap/${encodeURIComponent(runId)}`);
  },

  /* ── Replay Queue ── */
  listReplay(status?: string): Promise<{ items: EvalReplayEntry[] }> {
    const qs = status ? `?status=${status}` : '';
    return request(`/api/admin/eval/replay${qs}`);
  },
  reviewReplay(id: number, status: 'approved' | 'rejected'): Promise<EvalReplayEntry> {
    return request(`/api/admin/eval/replay/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },
  promoteReplay(
    id: number,
    data: {
      suiteId: string;
      caseKey?: string;
      category?: string;
      taskDescription: string;
      evalType?: string;
      expectedBehavior?: string;
      traceId?: string;
    }
  ): Promise<EvalCase> {
    return request(`/api/admin/eval/replay/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /* ── Alert Rules ── */
  listAlertRules(): Promise<{ rules: EvalAlertRule[] }> {
    return request('/api/admin/eval/alerts');
  },
  createAlertRule(data: {
    name: string;
    conditionExpr: string;
    severity?: string;
    actionType?: string;
    notificationChannels?: unknown;
  }): Promise<EvalAlertRule> {
    return request('/api/admin/eval/alerts', { method: 'POST', body: JSON.stringify(data) });
  },
  updateAlertRule(id: number, data: Partial<EvalAlertRule>): Promise<EvalAlertRule> {
    return request(`/api/admin/eval/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteAlertRule(id: number): Promise<{ success: boolean }> {
    return request(`/api/admin/eval/alerts/${id}`, { method: 'DELETE' });
  },

  /* ── Evaluators ── */
  listEvaluators(opts?: { type?: string; status?: string }): Promise<{ evaluators: EvalEvaluator[] }> {
    const qs = new URLSearchParams();
    if (opts?.type) qs.set('type', opts.type);
    if (opts?.status) qs.set('status', opts.status);
    const q = qs.toString();
    return request(`/api/admin/eval/evaluators${q ? `?${q}` : ''}`);
  },
  getEvaluator(id: string): Promise<EvalEvaluator> {
    return request(`/api/admin/eval/evaluators/${encodeURIComponent(id)}`);
  },
  createEvaluator(data: {
    name: string;
    description?: string;
    type: 'rule_based' | 'llm_judge' | 'hybrid';
    dimensions: EvalDimension[];
    scoringRubric?: ScoringRubricEntry[];
    ruleConfig?: RuleConfigItem[];
    judgeConfig?: JudgeConfig;
    threshold?: number;
  }): Promise<EvalEvaluator> {
    return request('/api/admin/eval/evaluators', { method: 'POST', body: JSON.stringify(data) });
  },
  updateEvaluator(id: string, data: Partial<EvalEvaluator>): Promise<EvalEvaluator> {
    return request(`/api/admin/eval/evaluators/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteEvaluator(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/eval/evaluators/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  importEvaluatorPreset(): Promise<{
    imported: string[];
    skipped: string[];
    message: string;
  }> {
    return request('/api/admin/eval/evaluators/import-preset', { method: 'POST' });
  },
};
