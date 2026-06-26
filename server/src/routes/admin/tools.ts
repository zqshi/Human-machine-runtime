import { Hono } from 'hono';
import { z } from 'zod';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';
import type { Context } from 'hono';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

function getTenantId(c: Context): string {
  return getUser(c).tenantId ?? 'default';
}

/* ──── Validation Schemas ──── */

const createSourceSchema = z.object({
  sourceType: z.enum(['openapi', 'database', 'gateway', 'mcp_native']),
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  // OpenAPI
  specUrl: z.string().url().optional(),
  specContent: z.string().optional(),
  specVersion: z.string().optional(),
  syncStrategy: z.enum(['manual', 'on_change', 'periodic']).optional(),
  syncIntervalMin: z.number().int().positive().optional(),
  // Database
  dbType: z.enum(['postgresql', 'mysql']).optional(),
  dbHost: z.string().optional(),
  dbPort: z.number().int().positive().optional(),
  dbName: z.string().optional(),
  dbSchemaName: z.string().optional(),
  credentialId: z.string().optional(),
  // Gateway
  gatewayType: z.enum(['higress', 'kong', 'apisix', 'custom']).optional(),
  gatewayUrl: z.string().optional(),
  gatewayCredentialId: z.string().optional(),
  // MCP Native
  mcpTransport: z.string().optional(),
  mcpEndpoint: z.string().optional(),
});

const updateDefinitionSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

const bindToolSchema = z.object({
  definitionId: z.string().min(1),
  instanceId: z.string().optional(),
  displayName: z.string().optional(),
});

const testToolSchema = z.object({
  params: z.record(z.unknown()).default({}),
});

/* ──── Route Factory ──── */

export function createAdminToolRoutes(toolSvc: ToolManagementService) {
  const app = new Hono();

  /* ──── Sources ──── */

  app.get('/sources', async (c) => {
    const tenantId = getTenantId(c);
    const sources = await toolSvc.listSources(tenantId);
    return c.json({ sources });
  });

  app.get('/sources/:id', async (c) => {
    const source = await toolSvc.getSource(c.req.param('id'));
    if (!source) return c.json({ error: 'not found' }, 404);
    return c.json(source);
  });

  app.post('/sources', async (c) => {
    const parsed = await parseBody(c, createSourceSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const tenantId = getTenantId(c);
    const user = getUser(c);
    const source = await toolSvc.createSource(tenantId, parsed.data as never, user.username);
    return c.json(source, 201);
  });

  app.put('/sources/:id', async (c) => {
    const body = await c.req.json();
    const updated = await toolSvc.updateSource(c.req.param('id'), body);
    if (!updated) return c.json({ error: 'not found' }, 404);
    return c.json(updated);
  });

  app.delete('/sources/:id', async (c) => {
    await toolSvc.deleteSource(c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/sources/:id/sync', async (c) => {
    const result = await toolSvc.syncSource(c.req.param('id'));
    return c.json(result);
  });

  app.post('/sources/:id/introspect', async (c) => {
    // 探测表结构不落库(供 McpDatabaseFlow 测试连接+预览 schema,用户勾选后再 sync)
    const result = await toolSvc.introspectSource(c.req.param('id'));
    return c.json(result);
  });

  app.post('/sources/:id/test-connection', async (c) => {
    const result = await toolSvc.testConnection(c.req.param('id'));
    return c.json(result);
  });

  /* ──── Definitions ──── */

  app.get('/definitions', async (c) => {
    const tenantId = getTenantId(c);
    const sourceId = c.req.query('sourceId');
    const definitions = await toolSvc.listDefinitions(tenantId, sourceId);
    return c.json({ definitions });
  });

  app.get('/definitions/:id', async (c) => {
    const def = await toolSvc.getDefinition(c.req.param('id'));
    if (!def) return c.json({ error: 'not found' }, 404);
    return c.json(def);
  });

  app.put('/definitions/:id', async (c) => {
    const parsed = await parseBody(c, updateDefinitionSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const updated = await toolSvc.updateDefinition(c.req.param('id'), parsed.data);
    if (!updated) return c.json({ error: 'not found' }, 404);
    return c.json(updated);
  });

  app.post('/definitions/:id/test', async (c) => {
    const parsed = await parseBody(c, testToolSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const tenantId = getTenantId(c);
    const user = getUser(c);
    const result = await toolSvc.executeTool(
      c.req.param('id'),
      parsed.data.params as Record<string, unknown>,
      {
        tenantId,
        callerId: user.username,
      }
    );
    return c.json(result);
  });

  /* ──── Instances ──── */

  app.get('/instances', async (c) => {
    const tenantId = getTenantId(c);
    const instances = await toolSvc.listInstances(tenantId);
    return c.json({ instances });
  });

  app.post('/instances', async (c) => {
    const parsed = await parseBody(c, bindToolSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const tenantId = getTenantId(c);
    const instance = await toolSvc.bindTool(
      parsed.data.definitionId,
      tenantId,
      parsed.data.instanceId,
      parsed.data.displayName
    );
    return c.json(instance, 201);
  });

  app.delete('/instances/:id', async (c) => {
    await toolSvc.unbindTool(c.req.param('id'));
    return c.json({ success: true });
  });

  /* ──── Stats & Logs ──── */

  app.get('/stats', async (c) => {
    const tenantId = getTenantId(c);
    const stats = await toolSvc.getStats(tenantId);
    return c.json(stats);
  });

  app.get('/call-logs', async (c) => {
    const tenantId = getTenantId(c);
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const logs = await toolSvc.getCallLogs(tenantId, { limit, offset });
    return c.json({ logs });
  });

  /* ──── Upload Spec ──── */

  app.post('/upload-spec', async (c) => {
    const body = await c.req.json<{ specContent?: string }>();
    if (!body.specContent) return badRequest(c, 'specContent is required');
    const result = await toolSvc.uploadSpec(body.specContent);
    return c.json(result);
  });

  return app;
}
