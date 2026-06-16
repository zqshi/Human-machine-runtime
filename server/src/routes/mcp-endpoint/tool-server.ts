/**
 * MCP Tool Server — 为 Agent Runtime 提供 MCP 协议兼容的工具接口
 *
 * Agent 通过这些端点发现可用工具并执行调用。
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createMcpToolServerRoutes(toolSvc: ToolManagementService) {
  const app = new Hono();

  /**
   * GET /api/mcp/tools — 列出当前租户可用的工具
   * 返回 MCP-compatible tool list
   */
  app.get('/tools', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';
    const definitions = await toolSvc.listDefinitions(tenantId);
    const enabledTools = definitions.filter((d) => d.enabled);

    const tools = enabledTools.map((d) => ({
      name: d.name,
      description: d.description || d.summary || '',
      inputSchema: d.inputSchema || { type: 'object', properties: {} },
      metadata: {
        definitionId: d.id,
        sourceId: d.sourceId,
        method: d.method,
        path: d.path,
        executionType: d.executionType,
        tags: d.tags,
      },
    }));

    return c.json({ tools });
  });

  /**
   * POST /api/mcp/tools/:name/call — 执行工具调用
   * MCP tool_call 兼容接口
   */
  app.post('/tools/:name/call', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';
    const toolName = c.req.param('name');
    const body = await c.req.json<{ arguments?: Record<string, unknown> }>();

    // 查找工具定义
    const definitions = await toolSvc.listDefinitions(tenantId);
    const definition = definitions.find((d) => d.name === toolName && d.enabled);

    if (!definition) {
      return c.json({ error: `tool "${toolName}" not found or disabled` }, 404);
    }

    const result = await toolSvc.executeTool(definition.id, body.arguments || {}, {
      tenantId,
      callerId: user.username,
      instanceId: undefined,
    });

    if (result.success) {
      return c.json({ content: [{ type: 'text', text: JSON.stringify(result.data) }] });
    }

    return c.json({ error: { message: result.error || 'execution failed' }, isError: true }, 500);
  });

  return app;
}
