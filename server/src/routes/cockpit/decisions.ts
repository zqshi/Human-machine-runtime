import { Hono } from 'hono';
import type { DecisionService } from '../../contexts/cockpit/application/decision-service.js';
import type {
  Decision,
  DecisionResponseStatus,
  RespondAction,
} from '../../contexts/cockpit/domain/judgment/decision.js';
import type {
  JudgmentRecord,
  DecisionSource,
} from '../../contexts/cockpit/domain/judgment/judgment-record.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';

/**
 * cockpit 判断子系统路由（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 薄层：参数提取 → 调 DecisionService → 返回。业务逻辑（CRUD/respond 状态机/analytics 聚合）在 service。
 * 前端 DTO 不变（id/agentId/title/context/recommendation/alternatives/urgency/deadline/responseStatus/
 * userResponse/responseAt/impactScope/downstreamTaskIds/downstreamGoalIds + createdAt/updatedAt epoch ms）。
 *
 * inbox 是跨聚合视图聚合（workorder/goal 非 Decision 聚合），保留 route 层调 cockpitRepo，
 * 标 [PLANNED] 待 workorder/goal 实体化后下沉。
 */
function serializeDecision(d: Decision) {
  const p = d.toProps();
  return {
    id: p.id,
    agentId: p.agentId,
    title: p.title,
    context: p.context,
    recommendation: p.recommendation,
    alternatives: p.alternatives,
    urgency: p.urgency,
    deadline: p.deadline,
    responseStatus: p.responseStatus,
    userResponse: p.userResponse,
    responseAt: p.responseAt,
    impactScope: p.impactScope,
    downstreamTaskIds: p.downstreamTaskIds,
    downstreamGoalIds: p.downstreamGoalIds,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}

function serializeJudgmentRecord(r: JudgmentRecord) {
  const p = r.toProps();
  return {
    id: p.id,
    decisionId: p.decisionId,
    source: p.source,
    action: p.action,
    selectedOptionId: p.selectedOptionId,
    feedback: p.feedback,
    respondedAt: p.respondedAt,
    createdAt: p.createdAt,
    contextSnapshot: p.contextSnapshot,
  };
}

function parsePagedQuery(q: (k: string) => string | undefined) {
  const limit = q('limit');
  const offset = q('offset');
  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  };
}

export function createCockpitDecisionRoutes(
  service: DecisionService,
  cockpitRepo: CockpitRepository
) {
  const app = new Hono();

  app.get('/decisions', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listDecisions({
      responseStatus: q('status') as DecisionResponseStatus | undefined,
      agentId: q('agentId'),
      tenantId: q('tenantId'),
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeDecision),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // respond 状态机（accept/decline/defer/modify）+ service 自动生成审计 JudgmentRecord。
  app.post('/decisions/:id/respond', async (c) => {
    const { action, feedback, optionId, deferUntil } = await c.req.json<{
      action: RespondAction;
      feedback?: string;
      optionId?: string;
      deferUntil?: number;
    }>();
    const d = await service.respondDecision(c.req.param('id'), action, {
      feedback,
      optionId,
      deferUntil,
    });
    if (!d) return c.json({ error: 'decision not found' }, 404);
    return c.json({ decision: serializeDecision(d) });
  });

  app.get('/judgment-records', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listJudgmentRecords({
      decisionId: q('decisionId'),
      source: q('source') as DecisionSource | undefined,
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeJudgmentRecord),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/judgment-records', async (c) => {
    const body = await c.req.json();
    const r = await service.createJudgmentRecord(body);
    return c.json(serializeJudgmentRecord(r), 201);
  });

  // 判断质量统计（对标前端 JudgmentAnalytics 全量语义，service 内存算）。
  app.get('/judgment-analytics', async (c) => {
    const snapshot = await service.getJudgmentAnalytics();
    return c.json(snapshot);
  });

  // [PLANNED] inbox 跨聚合聚合（workorder/goal 非 Decision 聚合），保留 route 调 cockpitRepo，
  // 待 workorder/goal 实体化后下沉独立 service。
  app.get('/inbox', async (c) => {
    const workorders = await cockpitRepo.list('workorder');
    const goals = await cockpitRepo.list('goal');
    const pendingWOs = workorders.filter((w) => w.status === 'pending').length;
    return c.json({ workOrders: workorders, goalCount: goals.length, pendingCount: pendingWOs });
  });

  return app;
}
