import { eq, desc, and, sql, inArray, count } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  evalSuites,
  evalCases,
  evalRuns,
  evalResults,
  evalReplayQueue,
  evalAlertRules,
} from '../schema/eval-benchmark.js';

export class EvalBenchmarkRepository {
  constructor(private db: Database) {}

  /* ──── Suites ──── */

  async listSuites(tenantId?: string) {
    const conditions = tenantId ? [eq(evalSuites.tenantId, tenantId)] : [];
    return this.db
      .select()
      .from(evalSuites)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evalSuites.createdAt));
  }

  async getSuite(id: string) {
    const [row] = await this.db.select().from(evalSuites).where(eq(evalSuites.id, id)).limit(1);
    return row ?? null;
  }

  async createSuite(data: {
    id: string;
    name: string;
    description?: string;
    configType?: string;
    evalType?: string;
    categoryWeights?: Record<string, number>;
    tenantId?: string;
  }) {
    const [row] = await this.db
      .insert(evalSuites)
      .values({
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        configType: data.configType ?? 'ideal_output',
        evalType: data.evalType ?? null,
        categoryWeights: data.categoryWeights ?? null,
        tenantId: data.tenantId ?? null,
      })
      .returning();
    return row!;
  }

  async updateSuite(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      evalType: string;
      categoryWeights: Record<string, number>;
      status: string;
      totalCases: number;
      version: number;
    }>
  ) {
    const [row] = await this.db
      .update(evalSuites)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(evalSuites.id, id))
      .returning();
    return row ?? null;
  }

  async deleteSuite(id: string) {
    await this.db.delete(evalCases).where(eq(evalCases.suiteId, id));
    const [row] = await this.db.delete(evalSuites).where(eq(evalSuites.id, id)).returning();
    return !!row;
  }

  /* ──── Cases ──── */

  async listCases(
    suiteId: string,
    filters?: { category?: string; difficulty?: string; status?: string; evalType?: string }
  ) {
    const conditions = [eq(evalCases.suiteId, suiteId)];
    if (filters?.category) conditions.push(eq(evalCases.category, filters.category));
    if (filters?.difficulty) conditions.push(eq(evalCases.difficulty, filters.difficulty));
    if (filters?.status) conditions.push(eq(evalCases.status, filters.status));
    if (filters?.evalType) conditions.push(eq(evalCases.evalType, filters.evalType));

    return this.db
      .select()
      .from(evalCases)
      .where(and(...conditions))
      .orderBy(evalCases.category, evalCases.caseKey);
  }

  async getCase(id: string) {
    const [row] = await this.db.select().from(evalCases).where(eq(evalCases.id, id)).limit(1);
    return row ?? null;
  }

  async createCase(data: {
    id: string;
    suiteId: string;
    caseKey: string;
    category: string;
    subcategory?: string;
    difficulty?: string;
    taskDescription: string;
    context?: unknown;
    evalType: string;
    expectedOutput?: unknown;
    expectedBehavior?: string;
    expectedTrajectory?: string;
    expectedTools?: string[];
    matchRules?: unknown;
    rubric?: unknown;
    tags?: string[];
    mcpToolsInvolved?: string[];
    skillsInvolved?: string[];
    regressionSource?: string;
  }) {
    const [row] = await this.db
      .insert(evalCases)
      .values({
        id: data.id,
        suiteId: data.suiteId,
        caseKey: data.caseKey,
        category: data.category,
        subcategory: data.subcategory ?? null,
        difficulty: data.difficulty ?? 'medium',
        taskDescription: data.taskDescription,
        context: data.context ?? null,
        evalType: data.evalType,
        expectedOutput: data.expectedOutput ?? null,
        expectedBehavior: data.expectedBehavior ?? null,
        expectedTrajectory: data.expectedTrajectory ?? null,
        expectedTools: data.expectedTools ?? null,
        matchRules: data.matchRules ?? null,
        rubric: data.rubric ?? null,
        tags: data.tags ?? null,
        mcpToolsInvolved: data.mcpToolsInvolved ?? null,
        skillsInvolved: data.skillsInvolved ?? null,
        regressionSource: data.regressionSource ?? null,
      })
      .returning();

    // Update suite total count
    await this.db.execute(
      sql`UPDATE eval_suites SET total_cases = (SELECT count(*) FROM eval_cases WHERE suite_id = ${data.suiteId}) WHERE id = ${data.suiteId}`
    );

    return row!;
  }

  async updateCase(
    id: string,
    patch: Partial<{
      caseKey: string;
      version: number;
      category: string;
      subcategory: string;
      difficulty: string;
      taskDescription: string;
      context: unknown;
      evalType: string;
      expectedOutput: unknown;
      expectedBehavior: string;
      expectedTrajectory: string;
      expectedTools: string[];
      matchRules: unknown;
      rubric: unknown;
      tags: string[];
      mcpToolsInvolved: string[];
      skillsInvolved: string[];
      status: string;
      consecutivePassCount: number;
    }>
  ) {
    const [row] = await this.db
      .update(evalCases)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(evalCases.id, id))
      .returning();
    return row ?? null;
  }

  async deleteCase(id: string) {
    const c = await this.getCase(id);
    const [row] = await this.db.delete(evalCases).where(eq(evalCases.id, id)).returning();
    if (row && c) {
      await this.db.execute(
        sql`UPDATE eval_suites SET total_cases = (SELECT count(*) FROM eval_cases WHERE suite_id = ${c.suiteId}) WHERE id = ${c.suiteId}`
      );
    }
    return !!row;
  }

  async batchCreateCases(cases: Array<Parameters<EvalBenchmarkRepository['createCase']>[0]>) {
    if (cases.length === 0) return [];
    const rows = await this.db
      .insert(evalCases)
      .values(
        cases.map((c) => ({
          id: c.id,
          suiteId: c.suiteId,
          caseKey: c.caseKey,
          category: c.category,
          subcategory: c.subcategory ?? null,
          difficulty: c.difficulty ?? 'medium',
          taskDescription: c.taskDescription,
          context: c.context ?? null,
          evalType: c.evalType,
          expectedOutput: c.expectedOutput ?? null,
          expectedBehavior: c.expectedBehavior ?? null,
          expectedTrajectory: c.expectedTrajectory ?? null,
          expectedTools: c.expectedTools ?? null,
          matchRules: c.matchRules ?? null,
          rubric: c.rubric ?? null,
          tags: c.tags ?? null,
          mcpToolsInvolved: c.mcpToolsInvolved ?? null,
          skillsInvolved: c.skillsInvolved ?? null,
          regressionSource: c.regressionSource ?? null,
        }))
      )
      .returning();

    // Update suite count
    const suiteIds = [...new Set(cases.map((c) => c.suiteId))];
    for (const suiteId of suiteIds) {
      await this.db.execute(
        sql`UPDATE eval_suites SET total_cases = (SELECT count(*) FROM eval_cases WHERE suite_id = ${suiteId}) WHERE id = ${suiteId}`
      );
    }

    return rows;
  }

  /* ──── Runs ──── */

  async listRuns(opts?: { suiteId?: string; status?: string; tenantId?: string; employeeId?: string; limit?: number }) {
    const conditions = [];
    if (opts?.suiteId) conditions.push(eq(evalRuns.suiteId, opts.suiteId));
    if (opts?.status) conditions.push(eq(evalRuns.status, opts.status));
    if (opts?.tenantId) conditions.push(eq(evalRuns.tenantId, opts.tenantId));
    if (opts?.employeeId) conditions.push(eq(evalRuns.employeeId, opts.employeeId));

    return this.db
      .select()
      .from(evalRuns)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evalRuns.createdAt))
      .limit(opts?.limit ?? 50);
  }

  async getRun(id: string) {
    const [row] = await this.db.select().from(evalRuns).where(eq(evalRuns.id, id)).limit(1);
    return row ?? null;
  }

  async createRun(data: {
    id: string;
    suiteId: string;
    triggerType: string;
    configVersion?: string;
    baselineRunId?: string;
    employeeId?: string;
    environment?: string;
    totalCases: number;
    tenantId?: string;
  }) {
    const [row] = await this.db
      .insert(evalRuns)
      .values({
        id: data.id,
        suiteId: data.suiteId,
        triggerType: data.triggerType,
        configVersion: data.configVersion ?? null,
        baselineRunId: data.baselineRunId ?? null,
        employeeId: data.employeeId ?? null,
        environment: data.environment ?? 'staging',
        totalCases: data.totalCases,
        tenantId: data.tenantId ?? null,
        status: 'pending',
      })
      .returning();
    return row!;
  }

  async updateRun(
    id: string,
    patch: Partial<{
      status: string;
      completedCases: number;
      passedCases: number;
      overallScore: number;
      dimensionScores: Record<string, number>;
      verdict: string;
      totalTokens: number;
      totalCost: number;
      startedAt: Date;
      finishedAt: Date;
      evaluatorIds: string[];
    }>
  ) {
    const [row] = await this.db.update(evalRuns).set(patch).where(eq(evalRuns.id, id)).returning();
    return row ?? null;
  }

  /* ──── Results ──── */

  async listResults(runId: string) {
    return this.db
      .select()
      .from(evalResults)
      .where(eq(evalResults.runId, runId))
      .orderBy(evalResults.id);
  }

  async createResult(data: {
    runId: string;
    caseId: string;
    score?: number;
    dimensionScores?: Record<string, number>;
    actualOutput?: string;
    toolCallsLog?: unknown;
    durationMs?: number;
    tokenUsage?: number;
    judgeResponse?: unknown;
    passed?: boolean;
    regression?: boolean;
    failureReason?: string;
    status?: string;
  }) {
    const [row] = await this.db
      .insert(evalResults)
      .values({
        runId: data.runId,
        caseId: data.caseId,
        score: data.score ?? null,
        dimensionScores: data.dimensionScores ?? null,
        actualOutput: data.actualOutput ?? null,
        toolCallsLog: data.toolCallsLog ?? null,
        durationMs: data.durationMs ?? null,
        tokenUsage: data.tokenUsage ?? null,
        judgeResponse: data.judgeResponse ?? null,
        passed: data.passed ?? null,
        regression: data.regression ?? false,
        failureReason: data.failureReason ?? null,
        status: data.status ?? 'pending',
      })
      .returning();
    return row!;
  }

  async updateResult(
    id: number,
    patch: Partial<{
      score: number;
      dimensionScores: Record<string, number>;
      actualOutput: string;
      toolCallsLog: unknown;
      durationMs: number;
      tokenUsage: number;
      judgeResponse: unknown;
      passed: boolean;
      regression: boolean;
      failureReason: string;
      status: string;
    }>
  ) {
    const [row] = await this.db
      .update(evalResults)
      .set(patch)
      .where(eq(evalResults.id, id))
      .returning();
    return row ?? null;
  }

  /* ──── Replay Queue ──── */

  async listReplayQueue(opts?: { status?: string; tenantId?: string; limit?: number }) {
    const conditions = [];
    if (opts?.status) conditions.push(eq(evalReplayQueue.reviewStatus, opts.status));
    if (opts?.tenantId) conditions.push(eq(evalReplayQueue.tenantId, opts.tenantId));

    return this.db
      .select()
      .from(evalReplayQueue)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evalReplayQueue.createdAt))
      .limit(opts?.limit ?? 50);
  }

  async createReplayEntry(data: {
    traceId: string;
    triggerReason: string;
    originalInput?: string;
    agentOutput?: string;
    userCorrection?: string;
    failureMode?: string;
    tenantId?: string;
  }) {
    const [row] = await this.db
      .insert(evalReplayQueue)
      .values({
        traceId: data.traceId,
        triggerReason: data.triggerReason,
        originalInput: data.originalInput ?? null,
        agentOutput: data.agentOutput ?? null,
        userCorrection: data.userCorrection ?? null,
        failureMode: data.failureMode ?? null,
        tenantId: data.tenantId ?? null,
      })
      .returning();
    return row!;
  }

  async updateReplayEntry(
    id: number,
    patch: Partial<{
      reviewStatus: string;
      promotedCaseId: string;
      reviewedBy: string;
      reviewedAt: Date;
    }>
  ) {
    const [row] = await this.db
      .update(evalReplayQueue)
      .set(patch)
      .where(eq(evalReplayQueue.id, id))
      .returning();
    return row ?? null;
  }

  /* ──── Alert Rules ──── */

  async listAlertRules(tenantId?: string) {
    const conditions = tenantId ? [eq(evalAlertRules.tenantId, tenantId)] : [];
    return this.db
      .select()
      .from(evalAlertRules)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(evalAlertRules.id);
  }

  async createAlertRule(data: {
    name: string;
    conditionExpr: string;
    severity?: string;
    actionType?: string;
    notificationChannels?: unknown;
    tenantId?: string;
  }) {
    const [row] = await this.db
      .insert(evalAlertRules)
      .values({
        name: data.name,
        conditionExpr: data.conditionExpr,
        severity: data.severity ?? 'medium',
        actionType: data.actionType ?? 'notify',
        notificationChannels: data.notificationChannels ?? null,
        tenantId: data.tenantId ?? null,
      })
      .returning();
    return row!;
  }

  async updateAlertRule(
    id: number,
    patch: Partial<{
      name: string;
      conditionExpr: string;
      severity: string;
      actionType: string;
      notificationChannels: unknown;
      enabled: boolean;
    }>
  ) {
    const [row] = await this.db
      .update(evalAlertRules)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(evalAlertRules.id, id))
      .returning();
    return row ?? null;
  }

  async deleteAlertRule(id: number) {
    const [row] = await this.db.delete(evalAlertRules).where(eq(evalAlertRules.id, id)).returning();
    return !!row;
  }

  /* ──── Dashboard Aggregations ──── */

  async getDashboardMetrics(tenantId?: string) {
    const suiteConditions = tenantId ? [eq(evalSuites.tenantId, tenantId)] : [];
    const runConditions = tenantId ? [eq(evalRuns.tenantId, tenantId)] : [];

    const [suiteCount] = await this.db
      .select({ value: count() })
      .from(evalSuites)
      .where(suiteConditions.length ? and(...suiteConditions) : undefined);

    const [caseCount] = await this.db
      .select({ value: count() })
      .from(evalCases)
      .where(eq(evalCases.status, 'active'));

    const [runCount] = await this.db
      .select({ value: count() })
      .from(evalRuns)
      .where(runConditions.length ? and(...runConditions) : undefined);

    const recentRuns = await this.db
      .select()
      .from(evalRuns)
      .where(
        and(
          eq(evalRuns.status, 'completed'),
          ...(tenantId ? [eq(evalRuns.tenantId, tenantId)] : [])
        )
      )
      .orderBy(desc(evalRuns.createdAt))
      .limit(10);

    const latestScore = recentRuns[0]?.overallScore ?? null;
    const latestVerdict = recentRuns[0]?.verdict ?? null;
    const avgScore =
      recentRuns.length > 0
        ? recentRuns.reduce((s, r) => s + (r.overallScore ?? 0), 0) / recentRuns.length
        : null;

    const [replayPending] = await this.db
      .select({ value: count() })
      .from(evalReplayQueue)
      .where(eq(evalReplayQueue.reviewStatus, 'pending'));

    return {
      totalSuites: suiteCount?.value ?? 0,
      totalCases: caseCount?.value ?? 0,
      totalRuns: runCount?.value ?? 0,
      latestScore,
      latestVerdict,
      avgScore10Runs: avgScore,
      replayPendingCount: replayPending?.value ?? 0,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        suiteId: r.suiteId,
        employeeId: r.employeeId,
        overallScore: r.overallScore,
        verdict: r.verdict,
        triggerType: r.triggerType,
        createdAt: r.createdAt,
        configVersion: r.configVersion,
        environment: r.environment,
      })),
    };
  }

  async getScoreTrend(days: number = 30, tenantId?: string) {
    const since = new Date(Date.now() - days * 86400_000);
    const conditions = [sql`${evalRuns.createdAt} >= ${since}`, eq(evalRuns.status, 'completed')];
    if (tenantId) conditions.push(eq(evalRuns.tenantId, tenantId));

    return this.db
      .select({
        id: evalRuns.id,
        overallScore: evalRuns.overallScore,
        dimensionScores: evalRuns.dimensionScores,
        verdict: evalRuns.verdict,
        configVersion: evalRuns.configVersion,
        createdAt: evalRuns.createdAt,
      })
      .from(evalRuns)
      .where(and(...conditions))
      .orderBy(evalRuns.createdAt);
  }

  async getCategoryHeatmap(runId: string) {
    const results = await this.db
      .select({
        caseId: evalResults.caseId,
        score: evalResults.score,
        passed: evalResults.passed,
      })
      .from(evalResults)
      .where(eq(evalResults.runId, runId));

    // Join with case info
    if (results.length === 0) return [];
    const caseIds = results.map((r) => r.caseId);
    const cases = await this.db
      .select({ id: evalCases.id, category: evalCases.category })
      .from(evalCases)
      .where(inArray(evalCases.id, caseIds));

    const categoryMap = new Map(cases.map((c) => [c.id, c.category]));
    const grouped: Record<
      string,
      { total: number; passed: number; avgScore: number; scores: number[] }
    > = {};

    for (const r of results) {
      const cat = categoryMap.get(r.caseId) ?? 'unknown';
      if (!grouped[cat]) grouped[cat] = { total: 0, passed: 0, avgScore: 0, scores: [] };
      grouped[cat].total++;
      if (r.passed) grouped[cat].passed++;
      if (r.score != null) grouped[cat].scores.push(r.score);
    }

    return Object.entries(grouped).map(([category, data]) => ({
      category,
      total: data.total,
      passed: data.passed,
      passRate: data.total > 0 ? data.passed / data.total : 0,
      avgScore:
        data.scores.length > 0 ? data.scores.reduce((s, v) => s + v, 0) / data.scores.length : 0,
    }));
  }
}
