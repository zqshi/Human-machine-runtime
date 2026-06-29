import { Hono } from 'hono';
import type { OrchestrationService } from '../../contexts/cockpit/application/orchestration-service.js';
import type {
  OrchestrationChain,
  OrchestrationChainStatus,
} from '../../contexts/cockpit/domain/orchestration/orchestration-chain.js';
import type {
  Escalation,
  EscalationStatus,
} from '../../contexts/cockpit/domain/orchestration/escalation.js';
import type {
  OrchestrationAgent,
  OrchestrationAgentStatus,
} from '../../contexts/cockpit/domain/orchestration/orchestration-agent.js';

/**
 * cockpit 编排子系统路由（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 薄层：参数提取 → 调 OrchestrationService → 返回。业务逻辑（CRUD/advance 状态机/escalation
 * status 转换）在 service。前端不消费三端点（孤儿），实体化破 EAV 贫血 + 为真调度留接口。
 * advance 是诚实假推进（手动 currentStep++），真调度接 /agent/dispatch 留 [PLANNED]。
 * serialize Date→ms（同 decisions route 契约）。
 */

function serializeChain(c: OrchestrationChain) {
  const p = c.toProps();
  return {
    id: p.id,
    name: p.name,
    steps: p.steps,
    currentStep: p.currentStep,
    status: p.status,
    agentId: p.agentId,
    tenantId: p.tenantId,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}

function serializeEscalation(e: Escalation) {
  const p = e.toProps();
  return {
    id: p.id,
    status: p.status,
    severity: p.severity,
    triggerReason: p.triggerReason,
    relatedTaskId: p.relatedTaskId,
    metadata: p.metadata,
    tenantId: p.tenantId,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}

function serializeAgent(a: OrchestrationAgent) {
  const p = a.toProps();
  return {
    id: p.id,
    agentId: p.agentId,
    role: p.role,
    status: p.status,
    metadata: p.metadata,
    tenantId: p.tenantId,
    registeredAt: p.registeredAt.getTime(),
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

export function createCockpitOrchestrationRoutes(service: OrchestrationService) {
  const app = new Hono();

  // ── chains ──
  app.get('/orchestration/chains', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listChains({
      status: q('status') as OrchestrationChainStatus | undefined,
      agentId: q('agentId'),
      tenantId: q('tenantId'),
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeChain),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/orchestration/chains', async (c) => {
    const body = await c.req.json();
    const chain = await service.createChain(body);
    return c.json(serializeChain(chain), 201);
  });

  app.get('/orchestration/chains/:id', async (c) => {
    const chain = await service.getChain(c.req.param('id'));
    if (!chain) return c.json({ error: 'chain not found' }, 404);
    return c.json(serializeChain(chain));
  });

  // 诚实化:当前为手动编排链步骤推进(currentStep++)。真 Agent 路由(按 step 调度
  // /agent/dispatch)留 [PLANNED],不假装调度了 Agent。
  app.post('/orchestration/chains/:id/advance', async (c) => {
    const chain = await service.advanceChain(c.req.param('id'));
    if (!chain) return c.json({ error: 'chain not found' }, 404);
    return c.json(serializeChain(chain));
  });

  // ── escalations ──
  app.get('/orchestration/escalations', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listEscalations({
      status: q('status') as EscalationStatus | undefined,
      tenantId: q('tenantId'),
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeEscalation),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/orchestration/escalations', async (c) => {
    const body = await c.req.json();
    const escalation = await service.createEscalation(body);
    return c.json(serializeEscalation(escalation), 201);
  });

  // PATCH 收敛为 status 状态机转换 + metadata 合并（原 route 任意 patch 透传下沉为合法转换）。
  app.patch('/orchestration/escalations/:id', async (c) => {
    const { status, metadata } = await c.req.json<{
      status?: EscalationStatus;
      metadata?: Record<string, unknown>;
    }>();
    if (!status) return c.json({ error: 'status required' }, 400);
    const escalation = await service.updateEscalation(c.req.param('id'), { status, metadata });
    if (!escalation) return c.json({ error: 'escalation not found' }, 404);
    return c.json(serializeEscalation(escalation));
  });

  // ── agents ──
  app.get('/orchestration/agents', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listAgents({
      agentId: q('agentId'),
      status: q('status') as OrchestrationAgentStatus | undefined,
      tenantId: q('tenantId'),
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeAgent),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/orchestration/agents', async (c) => {
    const body = await c.req.json();
    const agent = await service.createAgent(body);
    return c.json(serializeAgent(agent), 201);
  });

  return app;
}
