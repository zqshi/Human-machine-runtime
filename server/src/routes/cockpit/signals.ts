import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';
import { filteredResponse, pagedResponse } from './pagination.js';

export function createCockpitSignalRoutes(repo: CockpitRepository) {
  const app = new Hono();

  app.get('/signals', async (c) => {
    const urgency = c.req.query('urgency');
    return c.json(
      await filteredResponse(
        repo,
        'signal',
        (k) => c.req.query(k),
        (items) => (urgency ? items.filter((s) => s.urgency === urgency) : items)
      )
    );
  });

  app.get('/signals/emergent', async (c) => {
    return c.json(await pagedResponse(repo, 'emergent_signal', (k) => c.req.query(k)));
  });

  app.post('/signals/emergent', async (c) => {
    const body = await c.req.json();
    const signal = { id: newId('sig'), ...body, createdAt: Date.now() };
    await repo.upsert('emergent_signal', signal.id, signal);
    appEventBus.publish('emergent-signal:detected', signal);
    return c.json(signal, 201);
  });

  app.patch('/signals/emergent/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const signal = await repo.get('emergent_signal', id);
    if (!signal) return c.json({ error: 'signal not found' }, 404);
    const updated = { ...signal, ...patch };
    await repo.upsert('emergent_signal', id, updated);
    return c.json(updated);
  });

  app.post('/corrections/apply', async (c) => {
    const body = await c.req.json<{ planId: string; actions: unknown[] }>();
    appEventBus.publish('correction:applied', {
      planId: body.planId,
      affectedTasks: [],
      affectedGoals: [],
    });
    return c.json({ applied: body.actions?.length ?? 0, failed: 0 });
  });

  app.get('/patterns', async (c) => {
    return c.json(await pagedResponse(repo, 'pattern', (k) => c.req.query(k)));
  });

  app.post('/patterns', async (c) => {
    const body = await c.req.json();
    const pattern = { id: newId('pat'), ...body };
    await repo.upsert('pattern', pattern.id, pattern);
    appEventBus.publish('pattern:discovered', pattern);
    return c.json(pattern, 201);
  });

  return app;
}
