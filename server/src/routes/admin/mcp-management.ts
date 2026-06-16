import { Hono } from 'hono';
import type { Context } from 'hono';
import type { McpService } from '../../contexts/mcp-management/mcp-service.js';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createAdminMcpRoutes(mcpService: McpService) {
  const app = new Hono();

  app.get('/groups', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';
    const groups = await mcpService.listMcpGroups(tenantId);
    return c.json({ success: true, data: groups });
  });

  app.get('/groups/:id/tools', async (c) => {
    const tools = await mcpService.listTools(c.req.param('id'));
    return c.json({ success: true, data: tools });
  });

  app.post('/groups/:id/enable', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';
    await mcpService.enableGroup(tenantId, c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/groups/:id/disable', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';
    await mcpService.disableGroup(tenantId, c.req.param('id'));
    return c.json({ success: true });
  });

  return app;
}
