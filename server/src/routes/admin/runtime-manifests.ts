import { Hono } from 'hono';
import type { BakingService } from '../../contexts/agent-core/application/baking-service.js';
import type { AgentDefinitionService } from '../../contexts/agent-core/application/agent-definition-service.js';
import type { RuntimeManifestRepository } from '../../db/repositories/runtime-manifest-repository.js';

/**
 * 编译固化管理路由(v2.0 C12,admin 控制面)。
 *
 * 薄层(§1.3):参数提取 → 调 service/repo → 返回。
 * - POST /:agentDefinitionId/bake          触发 bake(同步固化,取 def.tenantId+generation → BakingService.bake)
 * - GET  /:agentDefinitionId               某定义 manifest(generation 倒序 top-N,版本对比/回滚)
 * - GET  /:agentDefinitionId/:generation   精确查某版本固化产物
 *
 * auth:由 admin 聚合层统一挂 authMiddleware + requireRole('platform_admin')(见 routes/index.ts)。
 * 分页(§7.2.1 第2条):GET /:agentDefinitionId 的 limit 下推 DB 层(top-N by generation,默认 50 上限 200;
 * generation 天然有界,极少触顶,total=all.length 即真实值)。
 */
export function createAdminRuntimeManifestRoutes(
  bakingService: BakingService,
  agentDefinitionService: AgentDefinitionService,
  manifestRepo: RuntimeManifestRepository
) {
  const app = new Hono();

  // 触发 bake。tenantId 取自 AgentDefinition(跨租户工具校验用),generation 取自 def 当前 generation。
  app.post('/:agentDefinitionId/bake', async (c) => {
    const defId = c.req.param('agentDefinitionId');
    const def = await agentDefinitionService.get(defId);
    if (!def) {
      return c.json({ error: 'agent definition not found' }, 404);
    }
    const result = await bakingService.bake({
      agentDefinitionId: defId,
      generation: def.generation,
      tenantId: def.tenantId,
    });
    return c.json(result, 200); // 同步固化完成,body 含 status(baked|failed)+ manifestId
  });

  // 某定义 manifest(generation 倒序 top-N,版本对比/回滚查看)。limit 下推 DB 层(§7.2.1 第2条)。
  app.get('/:agentDefinitionId', async (c) => {
    const defId = c.req.param('agentDefinitionId');
    const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
    const all = await manifestRepo.listByDefinition(defId, limit);
    return c.json({ items: all, total: all.length, limit });
  });

  // 单个 manifest 内容(按 defId + generation 精确查某版本固化产物)
  app.get('/:agentDefinitionId/:generation', async (c) => {
    const defId = c.req.param('agentDefinitionId');
    const generation = Number(c.req.param('generation'));
    if (!Number.isFinite(generation)) {
      return c.json({ error: 'generation must be a number' }, 400);
    }
    const manifest = await manifestRepo.findManifest(defId, generation);
    if (!manifest) {
      return c.json({ error: 'manifest not found or not baked' }, 404);
    }
    return c.json(manifest);
  });

  return app;
}
