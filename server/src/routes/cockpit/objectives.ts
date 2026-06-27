import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';
import { filteredResponse } from './pagination.js';

export function createCockpitObjectiveRoutes(repo: CockpitRepository) {
  const app = new Hono();

  app.get('/', async (c) => {
    const level = c.req.query('level');
    return c.json(
      await filteredResponse(
        repo,
        'objective',
        (k) => c.req.query(k),
        (items) => (level ? items.filter((o) => o.level === level) : items)
      )
    );
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const obj = {
      id: newId('obj'),
      ...body,
      status: body.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsert('objective', obj.id, obj);
    return c.json(obj, 201);
  });

  app.get('/:id', async (c) => {
    const obj = await repo.get('objective', c.req.param('id'));
    if (!obj) return c.json({ error: 'objective not found' }, 404);
    return c.json(obj);
  });

  app.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const obj = await repo.get('objective', id);
    if (!obj) return c.json({ error: 'objective not found' }, 404);
    const updated = { ...obj, ...patch, updatedAt: Date.now() };
    await repo.upsert('objective', id, updated);
    appEventBus.publish('objective:updated', updated);
    return c.json(updated);
  });

  app.delete('/:id', async (c) => {
    await repo.remove('objective', c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/decode', async (c) => {
    const { intent } = await c.req.json<{ intent: string }>();
    const result = {
      questions: [
        { id: 'q1', question: `如何理解「${intent}」的核心目标？`, purpose: 'clarify' },
        { id: 'q2', question: '成功的衡量标准是什么？', purpose: 'metrics' },
      ],
      hypotheses: [
        { id: 'h1', statement: '当前方案可实现 80% 的目标', baselineValue: 50, targetValue: 80 },
      ],
      constraints: ['资源有限', '时间紧迫'],
      suggestedL1Objectives: [
        { title: '明确关键指标', keyQuestion: '哪些指标最能反映进展？' },
        { title: '确定执行路径', keyQuestion: '最小可行方案是什么？' },
      ],
    };
    appEventBus.publish('objective:decoded', {
      l0Id: newId('l0'),
      questions: result.questions.map((q) => q.question),
    });
    return c.json(result);
  });

  return app;
}
