import { Hono } from 'hono';
import { z } from 'zod';
import type { AgentDefinitionService } from '../../contexts/agent-core/application/agent-definition-service.js';
import type { AgentDefinitionSpec } from '../../contexts/agent-core/domain/agent-definition.js';

/**
 * Agent 定义 CRD 管理路由(admin 控制面)。
 *
 * 薄层(§1.3):参数提取 + 结构校验(zod) → 调 service → 返回。
 * spec 内部字段校验(枚举/必填)下沉 service.validateAgentDefinitionSpec,路由只校验是对象。
 * 分页(§7.2.1 第2条):GET / 支持 skip/limit,默认 0/50,上限 100。
 * auth:由 admin 聚合层统一挂 authMiddleware + requireRole('platform_admin')(见 routes/index.ts)。
 */
const createBodySchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(128),
  spec: z.record(z.unknown()),
  description: z.string().max(512).optional(),
});

const updateBodySchema = z.object({
  spec: z.record(z.unknown()),
});

const listQuerySchema = z.object({
  tenantId: z.string().optional(),
  status: z.string().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export function createAdminAgentDefinitionRoutes(svc: AgentDefinitionService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    const query = parsed.success ? parsed.data : {};
    const result = await svc.list({
      tenantId: query.tenantId,
      status: query.status,
      skip: query.skip,
      limit: query.limit,
    });
    return c.json(result);
  });

  app.get('/:id', async (c) => {
    return c.json(await svc.get(c.req.param('id')));
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const def = await svc.create({
      tenantId: parsed.data.tenantId,
      name: parsed.data.name,
      spec: parsed.data.spec as unknown as AgentDefinitionSpec,
      description: parsed.data.description ?? null,
    });
    return c.json(def, 201);
  });

  app.put('/:id', async (c) => {
    const body = await c.req.json();
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    return c.json(
      await svc.update(c.req.param('id'), {
        spec: parsed.data.spec as unknown as AgentDefinitionSpec,
      })
    );
  });

  app.delete('/:id', async (c) => {
    await svc.archive(c.req.param('id'));
    return c.json({ success: true });
  });

  return app;
}
