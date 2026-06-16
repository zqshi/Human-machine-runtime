import { Hono } from 'hono';
import { z } from 'zod';
import type { EvalBenchmarkRepository } from '../../db/repositories/eval-benchmark-repository.js';
import type { EvalEvaluatorRepository } from '../../db/repositories/eval-evaluator-repository.js';
import type { EvalService } from '../../contexts/eval-benchmark/eval-service.js';
import { newId } from '../../shared/utils.js';
import type { Context } from 'hono';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

function toUndef(v: string | null | undefined): string | undefined {
  return v ?? undefined;
}

const createSuiteSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  configType: z.enum(['ideal_output', 'workflow']).optional(),
  evalType: z.enum([
    'exact_match',
    'structured_match',
    'behavioral',
    'safety_check',
    'llm_judge',
    'f1_score',
    'trajectory',
  ]).optional(),
  categoryWeights: z.record(z.number()).optional(),
});

const createCaseSchema = z.object({
  suiteId: z.string().min(1),
  caseKey: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  taskDescription: z.string().min(1),
  context: z.any().optional(),
  evalType: z.enum([
    'exact_match',
    'structured_match',
    'behavioral',
    'safety_check',
    'llm_judge',
    'f1_score',
    'trajectory',
  ]),
  expectedOutput: z.any().optional(),
  expectedBehavior: z.string().optional(),
  expectedTrajectory: z.string().optional(),
  expectedTools: z.array(z.string()).optional(),
  matchRules: z.any().optional(),
  rubric: z.any().optional(),
  tags: z.array(z.string()).optional(),
  mcpToolsInvolved: z.array(z.string()).optional(),
  skillsInvolved: z.array(z.string()).optional(),
  regressionSource: z.string().optional(),
});

const startRunSchema = z.object({
  suiteId: z.string().min(1),
  triggerType: z
    .enum(['manual', 'config_change', 'scheduled', 'model_upgrade', 'ab_test'])
    .optional(),
  configVersion: z.string().optional(),
  baselineRunId: z.string().optional(),
  employeeId: z.string().min(1),
  modelId: z.string().optional(),
  environment: z.enum(['staging', 'dev']).optional(),
  evaluatorIds: z.array(z.string().min(1)).min(1),
});

const createAlertRuleSchema = z.object({
  name: z.string().min(1),
  conditionExpr: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  actionType: z.enum(['notify', 'pause_agent', 'block_deploy']).optional(),
  notificationChannels: z.any().optional(),
});

const createEvaluatorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['rule_based', 'llm_judge', 'hybrid']),
  dimensions: z.array(z.object({
    key: z.string(),
    label: z.string(),
    weight: z.number(),
    description: z.string().optional(),
  })).min(1),
  scoringRubric: z.array(z.object({
    score: z.number(),
    desc: z.string(),
  })).optional(),
  ruleConfig: z.array(z.object({
    type: z.enum(['exact_match', 'contains', 'regex', 'json_path_match', 'script']),
    field: z.string(),
    value: z.string(),
    weight: z.number(),
    jsonPath: z.string().optional(),
    language: z.enum(['python', 'javascript']).optional(),
  })).optional(),
  judgeConfig: z.object({
    model: z.string(),
    temperature: z.number(),
    maxTokens: z.number(),
    promptTemplate: z.string(),
  }).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

import { PRESET_SUITES } from '../../contexts/eval-benchmark/eval-preset-data.js';
import { EVALUATOR_TEMPLATES } from '../../contexts/eval-benchmark/evaluator-templates.js';

export function createAdminEvalRoutes(repo: EvalBenchmarkRepository, evalService: EvalService, evaluatorRepo: EvalEvaluatorRepository) {
  const app = new Hono();

  /* ──── Import Preset ──── */

  app.post('/import-preset', async (c) => {
    const user = getUser(c);
    const existing = await repo.listSuites(toUndef(user.tenantId));
    const imported: Array<{ suiteId: string; name: string; caseCount: number }> = [];
    const skipped: string[] = [];

    for (const preset of PRESET_SUITES) {
      const alreadyExists = existing.find((s) => s.name === preset.name);
      if (alreadyExists) {
        skipped.push(preset.name);
        continue;
      }

      const suiteId = newId('evs');
      await repo.createSuite({
        id: suiteId,
        name: preset.name,
        description: preset.description,
        configType: preset.configType,
        evalType: preset.evalType,
        categoryWeights: preset.categoryWeights,
        tenantId: toUndef(user.tenantId),
      });

      const cases = await repo.batchCreateCases(
        preset.cases.map((pc) => ({
          id: newId('evc'),
          suiteId,
          caseKey: pc.caseKey,
          category: pc.category,
          subcategory: pc.subcategory,
          difficulty: pc.difficulty,
          taskDescription: pc.taskDescription,
          evalType: pc.evalType,
          expectedBehavior: pc.expectedBehavior,
          expectedOutput: pc.expectedOutput,
          expectedTools: pc.expectedTools,
          expectedTrajectory: pc.expectedTrajectory,
          tags: pc.tags,
        }))
      );

      imported.push({ suiteId, name: preset.name, caseCount: cases.length });
    }

    const totalCases = imported.reduce((s, i) => s + i.caseCount, 0);
    return c.json(
      {
        imported,
        skipped,
        totalCases,
        message: `已导入 ${imported.length} 个预设评测集（${totalCases} 用例）${skipped.length > 0 ? `，跳过 ${skipped.length} 个已存在` : ''}`,
      },
      201
    );
  });

  /* ──── Suites ──── */

  app.get('/suites', async (c) => {
    const user = getUser(c);
    const suites = await repo.listSuites(toUndef(user.tenantId));
    return c.json({ suites });
  });

  app.get('/suites/:id', async (c) => {
    const suite = await repo.getSuite(c.req.param('id'));
    if (!suite) return c.json({ error: 'Suite not found' }, 404);
    return c.json(suite);
  });

  app.post('/suites', async (c) => {
    const body = await c.req.json();
    const parsed = createSuiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const user = getUser(c);
    const suite = await repo.createSuite({
      id: newId('evs'),
      name: parsed.data.name,
      description: parsed.data.description,
      configType: parsed.data.configType,
      evalType: parsed.data.evalType,
      categoryWeights: parsed.data.categoryWeights,
      tenantId: toUndef(user.tenantId),
    });
    return c.json(suite, 201);
  });

  app.put('/suites/:id', async (c) => {
    const body = await c.req.json();
    const suite = await repo.updateSuite(c.req.param('id'), body);
    if (!suite) return c.json({ error: 'Suite not found' }, 404);
    return c.json(suite);
  });

  app.delete('/suites/:id', async (c) => {
    const deleted = await repo.deleteSuite(c.req.param('id'));
    if (!deleted) return c.json({ error: 'Suite not found' }, 404);
    return c.json({ success: true });
  });

  /* ──── Cases ──── */

  app.get('/suites/:suiteId/cases', async (c) => {
    const suiteId = c.req.param('suiteId');
    const category = c.req.query('category');
    const difficulty = c.req.query('difficulty');
    const status = c.req.query('status');
    const evalType = c.req.query('evalType');

    const cases = await repo.listCases(suiteId, {
      category: category || undefined,
      difficulty: difficulty || undefined,
      status: status || undefined,
      evalType: evalType || undefined,
    });
    return c.json({ cases, total: cases.length });
  });

  app.get('/cases/:id', async (c) => {
    const evalCase = await repo.getCase(c.req.param('id'));
    if (!evalCase) return c.json({ error: 'Case not found' }, 404);
    return c.json(evalCase);
  });

  app.post('/cases', async (c) => {
    const body = await c.req.json();
    const parsed = createCaseSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    // 校验 suite evalType 锁定
    const suite = await repo.getSuite(parsed.data.suiteId);
    if (!suite) return c.json({ error: 'Suite not found' }, 404);
    if (suite.evalType && suite.evalType !== parsed.data.evalType) {
      return c.json({
        error: `此评测集已锁定评测类型为 ${suite.evalType}，不能创建 ${parsed.data.evalType} 类型的用例`,
      }, 400);
    }

    const evalCase = await repo.createCase({
      id: newId('evc'),
      ...parsed.data,
    });
    return c.json(evalCase, 201);
  });

  app.post('/cases/batch', async (c) => {
    const body = await c.req.json();
    const cases: Array<z.infer<typeof createCaseSchema>> = body.cases;
    if (!Array.isArray(cases) || cases.length === 0) {
      return c.json({ error: 'cases array required' }, 400);
    }

    // 校验所有 case 的 evalType 与 suite 一致
    const suiteIds = [...new Set(cases.map((cs) => cs.suiteId))];
    for (const suiteId of suiteIds) {
      const suite = await repo.getSuite(suiteId);
      if (!suite) return c.json({ error: `Suite ${suiteId} not found` }, 404);
      if (suite.evalType) {
        const mismatched = cases.filter((cs) => cs.suiteId === suiteId && cs.evalType !== suite.evalType);
        if (mismatched.length > 0) {
          return c.json({
            error: `评测集已锁定评测类型为 ${suite.evalType}，${mismatched.length} 条用例类型不匹配`,
          }, 400);
        }
      }
    }

    const created = await repo.batchCreateCases(cases.map((cs) => ({ id: newId('evc'), ...cs })));
    return c.json({ cases: created, total: created.length }, 201);
  });

  app.put('/cases/:id', async (c) => {
    const body = await c.req.json();
    const evalCase = await repo.updateCase(c.req.param('id'), body);
    if (!evalCase) return c.json({ error: 'Case not found' }, 404);
    return c.json(evalCase);
  });

  app.delete('/cases/:id', async (c) => {
    const deleted = await repo.deleteCase(c.req.param('id'));
    if (!deleted) return c.json({ error: 'Case not found' }, 404);
    return c.json({ success: true });
  });

  /* ──── Runs ──── */

  app.get('/runs', async (c) => {
    const user = getUser(c);
    const suiteId = c.req.query('suiteId');
    const status = c.req.query('status');
    const employeeId = c.req.query('employeeId');
    const runs = await repo.listRuns({
      suiteId: suiteId || undefined,
      status: status || undefined,
      employeeId: employeeId || undefined,
      tenantId: toUndef(user.tenantId),
    });
    return c.json({ runs });
  });

  app.get('/runs/:id', async (c) => {
    const run = await repo.getRun(c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    return c.json(run);
  });

  app.post('/runs', async (c) => {
    const body = await c.req.json();
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const user = getUser(c);
    try {
      const run = await evalService.startRun({
        suiteId: parsed.data.suiteId,
        triggerType: parsed.data.triggerType ?? 'manual',
        configVersion: parsed.data.configVersion,
        baselineRunId: parsed.data.baselineRunId,
        employeeId: parsed.data.employeeId,
        modelId: parsed.data.modelId,
        environment: parsed.data.environment,
        evaluatorIds: parsed.data.evaluatorIds,
        tenantId: toUndef(user.tenantId),
      });
      return c.json(run, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get('/runs/:id/results', async (c) => {
    const results = await repo.listResults(c.req.param('id'));
    return c.json({ results });
  });

  app.get('/runs/:id/report', async (c) => {
    try {
      const report = await evalService.generateReport(c.req.param('id'));
      return c.json(report);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  /* ──── Dashboard ──── */

  app.get('/dashboard/metrics', async (c) => {
    const user = getUser(c);
    const metrics = await repo.getDashboardMetrics(toUndef(user.tenantId));
    return c.json(metrics);
  });

  app.get('/dashboard/trends', async (c) => {
    const user = getUser(c);
    const days = parseInt(c.req.query('days') || '30', 10);
    const trends = await repo.getScoreTrend(days, toUndef(user.tenantId));
    return c.json({ trends });
  });

  app.get('/dashboard/heatmap/:runId', async (c) => {
    const heatmap = await repo.getCategoryHeatmap(c.req.param('runId'));
    return c.json({ heatmap });
  });

  /* ──── Replay Queue ──── */

  app.get('/replay', async (c) => {
    const user = getUser(c);
    const status = c.req.query('status');
    const items = await repo.listReplayQueue({
      status: status || undefined,
      tenantId: toUndef(user.tenantId),
    });
    return c.json({ items });
  });

  app.post('/replay/:id/review', async (c) => {
    const body = await c.req.json();
    const user = getUser(c);
    const id = parseInt(c.req.param('id'), 10);
    const entry = await repo.updateReplayEntry(id, {
      reviewStatus: body.status, // 'approved' | 'rejected'
      reviewedBy: user.username,
      reviewedAt: new Date(),
    });
    if (!entry) return c.json({ error: 'Entry not found' }, 404);
    return c.json(entry);
  });

  app.post('/replay/:id/promote', async (c) => {
    const body = await c.req.json();
    const id = parseInt(c.req.param('id'), 10);
    // Promote to case
    const caseId = newId('evc');
    const evalCase = await repo.createCase({
      id: caseId,
      suiteId: body.suiteId,
      caseKey: body.caseKey || `REPLAY-${id}`,
      category: body.category || '线上回收',
      taskDescription: body.taskDescription,
      evalType: body.evalType || 'behavioral',
      expectedBehavior: body.expectedBehavior,
      regressionSource: body.traceId,
    });

    await repo.updateReplayEntry(id, {
      reviewStatus: 'promoted',
      promotedCaseId: caseId,
    });

    return c.json(evalCase, 201);
  });

  /* ──── Alert Rules ──── */

  app.get('/alerts', async (c) => {
    const user = getUser(c);
    const rules = await repo.listAlertRules(toUndef(user.tenantId));
    return c.json({ rules });
  });

  app.post('/alerts', async (c) => {
    const body = await c.req.json();
    const parsed = createAlertRuleSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const user = getUser(c);
    const rule = await repo.createAlertRule({
      ...parsed.data,
      tenantId: toUndef(user.tenantId),
    });
    return c.json(rule, 201);
  });

  app.put('/alerts/:id', async (c) => {
    const body = await c.req.json();
    const id = parseInt(c.req.param('id'), 10);
    const rule = await repo.updateAlertRule(id, body);
    if (!rule) return c.json({ error: 'Rule not found' }, 404);
    return c.json(rule);
  });

  app.delete('/alerts/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const deleted = await repo.deleteAlertRule(id);
    if (!deleted) return c.json({ error: 'Rule not found' }, 404);
    return c.json({ success: true });
  });

  /* ──── Evaluators ──── */

  app.get('/evaluators', async (c) => {
    const user = getUser(c);
    const type = c.req.query('type');
    const status = c.req.query('status');
    const evaluators = await evaluatorRepo.listEvaluators({
      type: type || undefined,
      status: status || undefined,
      tenantId: toUndef(user.tenantId),
    });
    return c.json({ evaluators });
  });

  app.get('/evaluators/:id', async (c) => {
    const evaluator = await evaluatorRepo.getEvaluator(c.req.param('id'));
    if (!evaluator) return c.json({ error: 'Evaluator not found' }, 404);
    return c.json(evaluator);
  });

  app.post('/evaluators', async (c) => {
    const body = await c.req.json();
    const parsed = createEvaluatorSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const user = getUser(c);
    const evaluator = await evaluatorRepo.createEvaluator({
      id: newId('evl'),
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type,
      dimensions: parsed.data.dimensions,
      scoringRubric: parsed.data.scoringRubric,
      ruleConfig: parsed.data.ruleConfig,
      judgeConfig: parsed.data.judgeConfig,
      threshold: parsed.data.threshold,
      tenantId: toUndef(user.tenantId),
    });
    return c.json(evaluator, 201);
  });

  app.put('/evaluators/:id', async (c) => {
    const body = await c.req.json();
    const evaluator = await evaluatorRepo.updateEvaluator(c.req.param('id'), body);
    if (!evaluator) return c.json({ error: 'Evaluator not found' }, 404);
    return c.json(evaluator);
  });

  app.delete('/evaluators/:id', async (c) => {
    const deleted = await evaluatorRepo.deleteEvaluator(c.req.param('id'));
    if (!deleted) return c.json({ error: 'Evaluator not found' }, 404);
    return c.json({ success: true });
  });

  /* ──── Evaluator Preset Import ──── */

  app.post('/evaluators/import-preset', async (c) => {
    const user = getUser(c);
    const existing = await evaluatorRepo.listEvaluators({ tenantId: toUndef(user.tenantId) });
    const imported: string[] = [];
    const skipped: string[] = [];

    for (const tpl of EVALUATOR_TEMPLATES) {
      const alreadyExists = existing.some((e) => e.name === tpl.name);
      if (alreadyExists) {
        skipped.push(tpl.name);
        continue;
      }

      await evaluatorRepo.createEvaluator({
        id: newId('evl'),
        name: tpl.name,
        description: tpl.description,
        type: tpl.type,
        dimensions: tpl.dimensions,
        scoringRubric: tpl.scoringRubric,
        ruleConfig: tpl.ruleConfig,
        judgeConfig: tpl.judgeConfig,
        threshold: tpl.threshold,
        tenantId: toUndef(user.tenantId),
      });
      imported.push(tpl.name);
    }

    return c.json({
      imported,
      skipped,
      message: `已导入 ${imported.length} 个预设评估器${skipped.length > 0 ? `，跳过 ${skipped.length} 个已存在` : ''}`,
    }, 201);
  });

  return app;
}
