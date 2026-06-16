import { Hono } from 'hono';
import type { McpService } from '../../../contexts/mcp-management/mcp-service.js';
import { getUpstreamToken } from '../../../middleware/auth.js';

export function createMcpProxyRoutes(mcpService?: McpService) {
  const app = new Hono();

  app.get('/groups', async (c) => {
    if (!mcpService) {
      return c.json({ error: 'MCP service not configured' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const groups = await mcpService.listMcpGroups('default', authToken);
    return c.json({ groups });
  });

  app.get('/groups/:groupId/tools', async (c) => {
    if (!mcpService) return c.json({ error: 'MCP service not configured' }, 503);
    const authToken = getUpstreamToken(c);
    const tools = await mcpService.listTools(c.req.param('groupId'), authToken);
    return c.json({ tools });
  });

  app.post('/groups/:groupId/enable', async (c) => {
    if (!mcpService) return c.json({ error: 'MCP service not configured' }, 503);
    await mcpService.enableGroup('default', c.req.param('groupId'));
    return c.json({ success: true });
  });

  app.post('/groups/:groupId/disable', async (c) => {
    if (!mcpService) return c.json({ error: 'MCP service not configured' }, 503);
    await mcpService.disableGroup('default', c.req.param('groupId'));
    return c.json({ success: true });
  });

  return app;
}
