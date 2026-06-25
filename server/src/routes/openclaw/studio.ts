/**
 * Studio Routes — /api/openclaw/studio/*
 *
 * 聚合查询用户 AI 资产(Agent + Skill + MCP),区分来源;Agent 编排配置读写。
 *
 * T13:从 STUB 假数据改为薄层(§1.3),业务逻辑下沉 StudioService。
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Principal } from '../../middleware/auth.js';
import type { StudioService } from '../../contexts/agent-core/application/studio-service.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createStudioRoutes(svc: StudioService) {
  const app = new Hono();

  /** GET /assets — 聚合租户全部 AI 资产(自建 + 已安装 + 组织共享) */
  app.get('/assets', async (c) => {
    const user = getUser(c);
    const items = await svc.listAssets(user.tenantId || 'default');
    return c.json({ success: true, items });
  });

  /** POST /assets/install — 从组织共享安装资产到租户 */
  app.post('/assets/install', async (c) => {
    const user = getUser(c);
    const { assetId, source } = (await c.req.json().catch(() => ({}))) as {
      assetId?: string;
      source?: string;
    };
    if (!assetId) return c.json({ error: 'assetId required' }, 400);
    const result = await svc.installAsset(
      user.tenantId || 'default',
      assetId,
      source ?? 'tenant',
      'studio'
    );
    if (!result) return c.json({ error: 'asset not found in shared assets' }, 404);
    return c.json({ success: true, id: result.id });
  });

  /** DELETE /assets/:id — 卸载已安装资产 */
  app.delete('/assets/:id', async (c) => {
    const user = getUser(c);
    const ok = await svc.uninstallAsset(user.tenantId || 'default', c.req.param('id'));
    if (!ok) return c.json({ error: 'installation not found' }, 404);
    return c.json({ success: true });
  });

  /** GET /agents/:id/config — 读 Agent 编排配置 */
  app.get('/agents/:id/config', async (c) => {
    const config = await svc.getAgentConfig(c.req.param('id'));
    if (!config) return c.json({ error: 'agent not found' }, 404);
    return c.json(config);
  });

  /** PUT /agents/:id/config — 保存 Agent 编排配置(草稿) */
  app.put('/agents/:id/config', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const ok = await svc.saveAgentConfig(c.req.param('id'), body);
    if (!ok) return c.json({ error: 'agent not found' }, 404);
    return c.json({ success: true });
  });

  /** POST /agents/:id/publish — 发布 Agent 配置 */
  app.post('/agents/:id/publish', async (c) => {
    const { version } = (await c.req.json().catch(() => ({}))) as { version?: string };
    const result = await svc.publishAgent(c.req.param('id'), version ?? '');
    if (!result) return c.json({ error: 'agent not found' }, 404);
    return c.json({ success: true, version: result.version });
  });

  return app;
}
