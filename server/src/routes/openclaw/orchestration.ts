import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';

export function createOpenclawOrchestrationRoutes(repo: OpenclawRepository) {
  const app = new Hono();

  app.get('/orchestration/chains', async (c) => {
    const status = c.req.query('status');
    const limit = Number(c.req.query('limit')) || undefined;
    const offset = Number(c.req.query('offset')) || undefined;
    if (!status && (limit || offset)) {
      return c.json(await repo.listPaged('orchestration_chain', { limit, offset }));
    }
    let items = await repo.list('orchestration_chain');
    if (status) items = items.filter((ch) => ch.status === status);
    return c.json({ items });
  });

  app.post('/orchestration/chains', async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const chain = {
      id: newId('orch'),
      ...body,
      status: 'active',
      steps: body.steps ?? [],
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsert('orchestration_chain', chain.id, chain);
    appEventBus.publish('orchestration:chain-created', chain);
    return c.json(chain, 201);
  });

  app.get('/orchestration/chains/:id', async (c) => {
    const chain = await repo.get('orchestration_chain', c.req.param('id'));
    if (!chain) return c.json({ error: 'chain not found' }, 404);
    return c.json(chain);
  });

  app.post('/orchestration/chains/:id/advance', async (c) => {
    const id = c.req.param('id');
    const chain = await repo.get('orchestration_chain', id);
    if (!chain) return c.json({ error: 'chain not found' }, 404);
    const nextStep = ((chain.currentStep as number) ?? 0) + 1;
    const steps = chain.steps as unknown[] | undefined;
    const updated: Record<string, unknown> = {
      ...chain,
      currentStep: nextStep,
      updatedAt: Date.now(),
    };
    if (nextStep >= (steps?.length ?? 0)) {
      updated.status = 'completed';
    }
    await repo.upsert('orchestration_chain', id, updated);
    appEventBus.publish('orchestration:step-advanced', { chainId: id, step: nextStep });
    return c.json(updated);
  });

  app.get('/orchestration/escalations', async (c) => {
    const limit = Number(c.req.query('limit')) || undefined;
    const offset = Number(c.req.query('offset')) || undefined;
    if (limit || offset) {
      return c.json(await repo.listPaged('escalation', { limit, offset }));
    }
    const items = await repo.list('escalation');
    return c.json({ items });
  });

  app.post('/orchestration/escalations', async (c) => {
    const body = await c.req.json();
    const escalation = {
      id: newId('esc'),
      ...body,
      status: 'open',
      createdAt: Date.now(),
    };
    await repo.upsert('escalation', escalation.id, escalation);
    appEventBus.publish('orchestration:escalation-created', escalation);
    return c.json(escalation, 201);
  });

  app.patch('/orchestration/escalations/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const item = await repo.get('escalation', id);
    if (!item) return c.json({ error: 'escalation not found' }, 404);
    const updated = { ...item, ...patch, updatedAt: Date.now() };
    await repo.upsert('escalation', id, updated);
    return c.json(updated);
  });

  app.get('/orchestration/agents', async (c) => {
    const limit = Number(c.req.query('limit')) || undefined;
    const offset = Number(c.req.query('offset')) || undefined;
    if (limit || offset) {
      return c.json(await repo.listPaged('orchestration_agent', { limit, offset }));
    }
    const items = await repo.list('orchestration_agent');
    return c.json({ items });
  });

  app.post('/orchestration/agents', async (c) => {
    const body = await c.req.json();
    const agent = { id: newId('oag'), ...body, registeredAt: Date.now() };
    await repo.upsert('orchestration_agent', agent.id, agent);
    return c.json(agent, 201);
  });

  return app;
}
