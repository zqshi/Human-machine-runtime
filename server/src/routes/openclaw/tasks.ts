import { Hono } from 'hono';
import { z } from 'zod';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const createGoalSchema = z
  .object({
    title: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    ownerId: z.string().optional(),
    status: z.string().optional(),
    milestones: z.array(z.record(z.unknown())).optional(),
    collaboratorIds: z.array(z.string()).optional(),
  })
  .passthrough();

const createWorkorderSchema = z
  .object({
    title: z.string().optional(),
    name: z.string().optional(),
    targetAgentId: z.string().optional(),
    content: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

export function createOpenclawTaskRoutes(repo: OpenclawRepository) {
  const app = new Hono();

  /* ──── Tasks ──── */

  app.get('/tasks', async (c) => {
    const limit = Number(c.req.query('limit')) || undefined;
    const offset = Number(c.req.query('offset')) || undefined;
    if (limit || offset) {
      const result = await repo.listPaged('task', { limit, offset });
      return c.json(result);
    }
    const items = await repo.list('task');
    return c.json({ items });
  });

  app.patch('/tasks/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const task = await repo.get('task', id);
    if (!task) return c.json({ error: 'task not found' }, 404);
    const updated = { ...task, ...patch, updatedAt: Date.now() };
    await repo.upsert('task', id, updated);
    appEventBus.publish('task:updated', updated);
    return c.json(updated);
  });

  app.post('/tasks/:id/escalate', async (c) => {
    const id = c.req.param('id');
    const { reason } = await c.req.json<{ reason: string }>();
    appEventBus.publish('escalation:triggered', { taskId: id, stage: 'l1', reason });
    return c.json({ stage: 'l1', action: 'escalated', reason });
  });

  app.post('/tasks/:id/escalate/resolve', async (c) => {
    const id = c.req.param('id');
    const { resolution } = await c.req.json<{ resolution: string }>();
    appEventBus.publish('escalation:resolved', { taskId: id, resolution });
    return c.json({ resolved: true, resolution });
  });

  /* ──── Goals ──── */

  app.get('/goals', async (c) => {
    const ownerId = c.req.query('ownerId');
    const collaboratorId = c.req.query('collaboratorId');
    const limit = Number(c.req.query('limit')) || undefined;
    const offset = Number(c.req.query('offset')) || undefined;
    if (!ownerId && !collaboratorId && (limit || offset)) {
      const result = await repo.listPaged('goal', { limit, offset });
      return c.json(result);
    }
    let items = await repo.list('goal');
    if (ownerId) items = items.filter((g) => g.ownerId === ownerId);
    if (collaboratorId)
      items = items.filter((g) =>
        (g.collaboratorIds as string[] | undefined)?.includes(collaboratorId)
      );
    return c.json({ items });
  });

  app.post('/goals', async (c) => {
    const parsed = await parseBody(c, createGoalSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const body = parsed.data;
    const now = Date.now();
    const goal = {
      id: newId('goal'),
      ...body,
      status: body.status ?? 'active',
      milestones: body.milestones ?? [],
      progressUpdates: [],
      relatedTaskIds: [],
      relatedDecisionIds: [],
      collaboratorIds: body.collaboratorIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsert('goal', goal.id, goal);
    appEventBus.publish('goal:updated', goal);
    return c.json(goal, 201);
  });

  app.patch('/goals/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const goal = await repo.get('goal', id);
    if (!goal) return c.json({ error: 'goal not found' }, 404);
    const updated = { ...goal, ...patch, updatedAt: Date.now() };
    await repo.upsert('goal', id, updated);
    appEventBus.publish('goal:updated', updated);
    return c.json(updated);
  });

  app.post('/goals/:id/decompose', async (c) => {
    const id = c.req.param('id');
    const { apply } = await c.req.json<{ apply?: boolean }>();
    const goal = await repo.get('goal', id);
    return c.json({
      applied: !!apply,
      category: 'operational',
      goal: goal ?? null,
      suggestedTasks: [
        { name: '分析需求', agentId: 'dev-assistant', priority: 'high' },
        { name: '制定执行计划', agentId: 'ops-assistant', priority: 'medium' },
      ],
      suggestedMilestones: [
        { title: '需求确认', deadline: Date.now() + 86400000 },
        { title: '方案评审', deadline: Date.now() + 172800000 },
      ],
    });
  });

  app.post('/goals/:id/collaborators', async (c) => {
    const id = c.req.param('id');
    const { userId } = await c.req.json<{ userId: string }>();
    const goal = await repo.get('goal', id);
    if (!goal) return c.json({ error: 'goal not found' }, 404);
    const collabs = (goal.collaboratorIds as string[]) ?? [];
    if (!collabs.includes(userId)) collabs.push(userId);
    goal.collaboratorIds = collabs;
    await repo.upsert('goal', id, goal);
    return c.json({ goal });
  });

  app.delete('/goals/:id/collaborators/:userId', async (c) => {
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    const goal = await repo.get('goal', id);
    if (!goal) return c.json({ error: 'goal not found' }, 404);
    goal.collaboratorIds = ((goal.collaboratorIds as string[]) ?? []).filter((u) => u !== userId);
    await repo.upsert('goal', id, goal);
    return c.json({ goal });
  });

  /* ──── Work Orders ──── */

  app.get('/workorders', async (c) => {
    const status = c.req.query('status');
    const limit = Number(c.req.query('limit')) || undefined;
    const offset = Number(c.req.query('offset')) || undefined;
    if (!status && (limit || offset)) {
      const result = await repo.listPaged('workorder', { limit, offset });
      return c.json(result);
    }
    let items = await repo.list('workorder');
    if (status) items = items.filter((w) => w.status === status);
    return c.json({ items });
  });

  app.get('/workorders/sent', async (c) => {
    const items = await repo.list('workorder');
    return c.json({ items: items.filter((w) => w.direction === 'sent') });
  });

  app.post('/workorders', async (c) => {
    const parsed = await parseBody(c, createWorkorderSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const body = parsed.data;
    const wo = {
      id: newId('wo'),
      ...body,
      status: 'pending',
      direction: 'sent',
      createdAt: Date.now(),
    };
    await repo.upsert('workorder', wo.id, wo);
    appEventBus.publish('workorder:created', wo);
    return c.json(wo, 201);
  });

  app.post('/workorders/:id/respond', async (c) => {
    const id = c.req.param('id');
    const { response } = await c.req.json<{ response: string }>();
    const wo = await repo.get('workorder', id);
    if (!wo) return c.json({ error: 'work order not found' }, 404);
    wo.status = 'completed';
    wo.response = response;
    wo.respondedAt = Date.now();
    await repo.upsert('workorder', id, wo);
    appEventBus.publish('workorder:completed', wo);
    return c.json(wo);
  });

  return app;
}
