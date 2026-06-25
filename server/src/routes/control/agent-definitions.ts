import { Hono } from 'hono';
import type { Context } from 'hono';
import type { MarketplaceService } from '../../contexts/marketplace/marketplace-service.js';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

/**
 * createControlAgentDefinitionRoutes — AgentDefinition 的管理控制面操作(L2)。
 *
 * 与 admin/agent-definitions(CRUD def)区分:本路由承载面向操作的 def 派生动作。
 * 当前仅 D10「实例化对话」:为已存在 AgentDefinition 生成对话 instance + 同步 key。
 */
export function createControlAgentDefinitionRoutes(marketplaceService: MarketplaceService) {
  const app = new Hono();

  /**
   * POST /:id/instantiate — D10:为 AgentDefinition 实例化对话 instance + 同步默认 key。
   *
   * 管理后台声明式向导(AgentCreateFlow)创建 Agent 后「去对话」调用:生成 instance +
   * LiteLLM key,前端凭返回的 instanceId 进入对话(sharedAgentChatService.openInstalledInstance)。
   * 复用 marketplaceService.instantiateExistingDefinition(instance+key sync,同 installAgent 后半段)。
   */
  app.post('/:id/instantiate', async (c) => {
    const user = getUser(c);
    const result = await marketplaceService.instantiateExistingDefinition(
      c.req.param('id'),
      user.tenantId || 'default',
      user.username
    );
    return c.json({ success: true, data: result }, 201);
  });

  return app;
}
