import type { Context, Next } from 'hono';
import type { SystemConfigService } from '../contexts/system-config/system-config-service.js';

/**
 * requireFeatureFlag — 路由级 feature flag 灰度中间件(#13)。
 *
 * flag 未启用/未配置 → 404(灰度未命中,不暴露端点);启用 → next。
 * 租户级灰度:从 c.var.tenantId 取租户(authMiddleware 注入),配合 isFeatureEnabled 的 hash 灰度。
 *
 * 用法:admin.route('/experimental', requireFeatureFlag(ctx.systemConfigService, 'agent.runtime.canary'), handler)
 *      或 service 层直接调 configService.isFeatureEnabled(key, tenantId)(更常用,非路由级)。
 */
export function requireFeatureFlag(configService: SystemConfigService, key: string) {
  return async (c: Context, next: Next) => {
    const tenantId =
      (c as unknown as { var?: { tenantId?: string } }).var?.tenantId ??
      (c.req.query('tenantId') as string | undefined);
    const enabled = await configService.isFeatureEnabled(key, tenantId);
    if (!enabled) {
      return c.json({ error: 'feature not available' }, 404);
    }
    await next();
  };
}
