import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';

export function createOpenclawCollaborationRoutes(repo: OpenclawRepository) {
  const app = new Hono();

  /* ──── Intents ──── */

  app.get('/intents', async (c) => {
    const items = await repo.list('intent');
    return c.json({ items });
  });

  app.post('/intents', async (c) => {
    const body = await c.req.json();
    const intent = { id: newId('int'), ...body };
    await repo.upsert('intent', intent.id, intent);
    return c.json(intent, 201);
  });

  app.post('/intents/dispatch', async (c) => {
    const body = await c.req.json<{
      intentType: string;
      payload: unknown;
      fromAgentId: string;
    }>();
    const targetAgentId = body.fromAgentId === 'dev-assistant' ? 'ops-assistant' : 'dev-assistant';
    appEventBus.publish('intent:dispatched', {
      intentId: newId('intd'),
      fromAgent: body.fromAgentId,
      toAgent: targetAgentId,
      payload: body.payload as Record<string, unknown>,
    });
    return c.json({ dispatched: true, targetAgentId });
  });

  /* ──── Sessions ──── */

  app.get('/sessions', async (c) => {
    const items = await repo.list('collab_session');
    return c.json({ items });
  });

  app.post('/sessions', async (c) => {
    const body = await c.req.json<{ purpose: string; participantIds: string[] }>();
    const now = Date.now();
    const session = {
      id: newId('sess'),
      purpose: body.purpose,
      participants: (body.participantIds ?? []).map((pid: string) => ({
        id: pid,
        type: 'agent',
        name: pid,
      })),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsert('collab_session', session.id, session);
    appEventBus.publish('session:created', {
      sessionId: session.id,
      agents: body.participantIds ?? [],
      purpose: body.purpose,
    });
    return c.json(session, 201);
  });

  app.get('/sessions/:id', async (c) => {
    const session = await repo.get('collab_session', c.req.param('id'));
    if (!session) return c.json({ error: 'session not found' }, 404);
    return c.json(session);
  });

  app.patch('/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const session = await repo.get('collab_session', id);
    if (!session) return c.json({ error: 'session not found' }, 404);
    const updated = { ...session, ...patch, updatedAt: Date.now() };
    await repo.upsert('collab_session', id, updated);
    if (patch.status === 'escalated') {
      appEventBus.publish('session:escalated', {
        sessionId: id,
        reason: (patch as Record<string, unknown>).reason ?? 'manual escalation',
        confidence: 0,
      });
    }
    return c.json(updated);
  });

  /* ──── Agent Profiles ──── */

  app.get('/agent-profiles', async (c) => {
    const items = await repo.list('agent_profile');
    return c.json({ items });
  });

  app.get('/agent-profiles/:id', async (c) => {
    const profile = await repo.get('agent_profile', c.req.param('id'));
    if (!profile) {
      return c.json({
        agentId: c.req.param('id'),
        agentName: c.req.param('id'),
        domains: [],
        successRate: 0,
        avgDurationMs: 0,
        avgTokenCost: 0,
        totalCompleted: 0,
        totalFailed: 0,
      });
    }
    return c.json(profile);
  });

  app.patch('/agent-profiles/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    let profile = await repo.get('agent_profile', id);
    if (!profile) {
      profile = {
        agentId: id,
        agentName: id,
        domains: [],
        successRate: 0,
        avgDurationMs: 0,
        avgTokenCost: 0,
        totalCompleted: 0,
        totalFailed: 0,
      };
    }
    const updated = { ...profile, ...patch };
    await repo.upsert('agent_profile', id, updated);
    appEventBus.publish('agent-profile:updated', { agentId: id, metric: 'manual', newValue: 0 });
    return c.json(updated);
  });

  app.post('/agent-profiles/:id/record', async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json<{
      domain: string;
      success: boolean;
      durationMs: number;
      tokenCost: number;
    }>();
    let profile = await repo.get('agent_profile', id);
    if (!profile) {
      profile = {
        agentId: id,
        agentName: id,
        domains: [],
        successRate: 0,
        avgDurationMs: 0,
        avgTokenCost: 0,
        totalCompleted: 0,
        totalFailed: 0,
      };
    }
    if (data.success) profile.totalCompleted = (profile.totalCompleted as number) + 1;
    else profile.totalFailed = (profile.totalFailed as number) + 1;
    await repo.upsert('agent_profile', id, profile);
    return c.json({ recorded: true });
  });

  /* ──── Contracts ──── */

  app.post('/contracts', async (c) => {
    const body = await c.req.json();
    const contract = { id: newId('ctr'), ...body, status: 'active' };
    await repo.upsert('contract', contract.id, contract);
    return c.json(contract, 201);
  });

  app.get('/contracts/:id', async (c) => {
    const contract = await repo.get('contract', c.req.param('id'));
    if (!contract) return c.json({ error: 'contract not found' }, 404);
    return c.json(contract);
  });

  return app;
}
