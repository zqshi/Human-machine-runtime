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

  // 诚实化:涌现信号当前为手动录入(真实 CRUD)。自动提取(从 dispatch trace 异常检测)
  // 待接数据回流 [PLANNED],不由 LLM 编造(否则是另一种假智能)。
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
    // 诚实化:correction 传播链路未接入执行引擎(/agent/dispatch),未实际生效。
    // 不假装 affectedTasks/affectedGoals 已作用。自动传播待接 dispatch 数据回流 [PLANNED]。
    appEventBus.publish('correction:applied', {
      planId: body.planId,
      applied: false,
      affectedTasks: [],
      affectedGoals: [],
    });
    return c.json({
      applied: 0,
      failed: 0,
      effective: false,
      note: 'correction 传播链路未接入执行引擎,未实际生效(自动传播待实现)',
    });
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
