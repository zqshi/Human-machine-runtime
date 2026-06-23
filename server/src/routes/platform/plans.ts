import { Hono } from 'hono';
import { z } from 'zod';
import type { PlanService } from '../../contexts/tenant-management/plan-service.js';

const planSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).max(48),
  displayOrder: z.number().int().optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  quotaTemplate: z.record(z.unknown()).optional(),
  featureTemplate: z.record(z.boolean()).optional(),
});

// §7.2.1 规则 2:列表 API 必须支持分页,默认非空。
// plan 数量天然少(套餐枚举),默认 100 足以覆盖,但仍强制分页以保持规则一致性。
const listPlansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createPlanRoutes(planService: PlanService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const parsed = listPlansQuerySchema.safeParse(c.req.query());
    if (!parsed.success)
      return c.json({ error: 'invalid query', details: parsed.error.flatten() }, 400);
    const plans = await planService.list(parsed.data);
    return c.json({ plans });
  });

  app.get('/:id', async (c) => {
    const plan = await planService.getById(c.req.param('id'));
    return c.json({ plan });
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    const plan = await planService.create(parsed.data);
    return c.json({ plan }, 201);
  });

  app.put('/:id', async (c) => {
    const body = await c.req.json();
    const plan = await planService.update(c.req.param('id'), body);
    return c.json({ plan });
  });

  app.delete('/:id', async (c) => {
    await planService.delete(c.req.param('id'));
    return c.json({ success: true });
  });

  return app;
}
