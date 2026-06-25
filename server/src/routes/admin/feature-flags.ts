import { Hono } from 'hono';
import { z } from 'zod';
import type {
  FeatureFlagConfig,
  SystemConfigService,
} from '../../contexts/system-config/system-config-service.js';

/**
 * Feature Flag 管理路由(admin 控制面,#13 灰度)。
 *
 * 薄层(§1.3):参数提取 + zod 校验 → 调 SystemConfigService → 返回。
 * 消费 T5 service:getFeatureFlags/getFeatureFlag/setFeatureFlag。
 * auth:由 admin 聚合层统一挂(见 routes/index.ts)。
 */
const flagBodySchema = z.object({
  enabled: z.boolean(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
  allowedTenants: z.array(z.string()).optional(),
  killSwitch: z.boolean().optional(),
});

export function createAdminFeatureFlagRoutes(svc: SystemConfigService) {
  const app = new Hono();

  /** 列出全部 feature flag */
  app.get('/', async (c) => {
    return c.json({ flags: await svc.getFeatureFlags() });
  });

  /** 查询单个 flag */
  app.get('/:key', async (c) => {
    const flag = await svc.getFeatureFlag(c.req.param('key'));
    if (!flag) return c.json({ error: 'flag not found' }, 404);
    return c.json(flag);
  });

  /** 设置/更新 flag(整体覆盖) */
  app.put('/:key', async (c) => {
    const body = await c.req.json();
    const parsed = flagBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const config = parsed.data as FeatureFlagConfig;
    await svc.setFeatureFlag(c.req.param('key'), config);
    return c.json({ key: c.req.param('key'), flag: config });
  });

  return app;
}
