import { Hono } from 'hono';
import type { ObjectiveService } from '../../contexts/cockpit/application/objective-service.js';
import type {
  Objective,
  ObjectiveLevel,
  ObjectiveStatus,
} from '../../contexts/cockpit/domain/objective/objective.js';

/**
 * cockpit 战略解码子系统路由（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 薄层：参数提取 → 调 ObjectiveService → 返回。业务逻辑（CRUD/状态机/解码）在 service。
 * 前端 DTO 不变（id/level/title/description/parentId/confidence/status/metrics + createdAt/updatedAt epoch ms）。
 */
function serializeObjective(o: Objective) {
  const p = o.toProps();
  return {
    id: p.id,
    level: p.level,
    parentId: p.parentId,
    title: p.title,
    description: p.description,
    confidence: p.confidence,
    status: p.status,
    metrics: p.metrics,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
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

export function createCockpitObjectiveRoutes(service: ObjectiveService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listObjectives({
      level: q('level') as ObjectiveLevel | undefined,
      parentId: q('parentId'),
      tenantId: q('tenantId'),
      status: q('status') as ObjectiveStatus | undefined,
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeObjective),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const o = await service.createObjective(body);
    return c.json(serializeObjective(o), 201);
  });

  app.get('/:id', async (c) => {
    const o = await service.getObjective(c.req.param('id'));
    if (!o) return c.json({ error: 'objective not found' }, 404);
    return c.json(serializeObjective(o));
  });

  app.patch('/:id', async (c) => {
    const patch = await c.req.json();
    const o = await service.updateObjective(c.req.param('id'), patch);
    if (!o) return c.json({ error: 'objective not found' }, 404);
    return c.json(serializeObjective(o));
  });

  app.delete('/:id', async (c) => {
    const removed = await service.deleteObjective(c.req.param('id'));
    if (!removed) return c.json({ error: 'objective not found' }, 404);
    return c.json({ success: true });
  });

  // 战略解码（接真 LLM，未配置→503 故障暴露，不回退硬编码）
  app.post('/decode', async (c) => {
    const { intent } = await c.req.json<{ intent: string }>();
    const result = await service.decodeStrategy(intent);
    if (!result.ok) {
      return c.json({ error: result.reason }, result.status);
    }
    return c.json(result.data);
  });

  return app;
}
