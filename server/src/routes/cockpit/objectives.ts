import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';
import { filteredResponse } from './pagination.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import { decodeStrategy } from './llm-analysis.js';

export function createCockpitObjectiveRoutes(
  repo: CockpitRepository,
  /** EAOS 战略解码真 LLM(未配置→/decode 返 503 故障暴露,不回退硬编码) */
  llm?: LiteLLMClient | null,
  model?: string
) {
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
    const result = await decodeStrategy(intent, llm ?? null, model ?? '');
    if (!result.ok) {
      // 503 未配置 / 502 调用失败或输出不可解析 —— 故障暴露,不回退硬编码
      return c.json({ error: result.reason }, result.status);
    }
    appEventBus.publish('objective:decoded', {
      l0Id: newId('l0'),
      questions: result.data.questions.map((q) => q.question),
    });
    return c.json(result.data);
  });

  return app;
}
