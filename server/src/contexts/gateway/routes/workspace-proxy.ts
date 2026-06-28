import { Hono } from 'hono';
import { WorkspaceBackendClient } from '../clients/workspace-backend-client.js';
import { logger } from '../../../app/logger.js';

export function createWorkspaceProxyRoutes(client: WorkspaceBackendClient) {
  const app = new Hono();

  app.get('/', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'workspace-backend' }, 503);
    }
    try {
      const userId = c.req.query('userId');
      const type = c.req.query('type');
      const data = await client.listWorkspaces({
        userId: userId || undefined,
        type: type || undefined,
      });
      return c.json({ success: true, data });
    } catch (err) {
      logger.warn(
        { service: 'workspace-backend', err: err instanceof Error ? err.message : String(err) },
        'workspace proxy degraded — upstream failed, returning empty workspaces'
      );
      return c.json({
        success: true,
        degraded: true,
        error: err instanceof Error ? err.message : 'workspace upstream failed',
        data: { workspaces: [] },
      });
    }
  });

  app.get('/workspaces', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'workspace-backend' }, 503);
    }
    try {
      const userId = c.req.query('userId');
      const type = c.req.query('type');
      const data = await client.listWorkspaces({
        userId: userId || undefined,
        type: type || undefined,
      });
      return c.json({ success: true, data });
    } catch (err) {
      logger.warn(
        { service: 'workspace-backend', err: err instanceof Error ? err.message : String(err) },
        'workspace proxy degraded — upstream failed, returning empty workspaces'
      );
      return c.json({
        success: true,
        degraded: true,
        error: err instanceof Error ? err.message : 'workspace upstream failed',
        data: { workspaces: [] },
      });
    }
  });

  app.post('/', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ success: false, error: 'Workspace backend not configured' }, 503);
    }
    try {
      const body = await c.req.json();
      const data = await client.createWorkspace(body);
      return c.json({ success: true, data }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'workspace backend unavailable';
      return c.json({ success: false, error: msg }, 502);
    }
  });

  app.get('/:id', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'workspace-backend' }, 503);
    }
    try {
      const data = await client.getWorkspace(c.req.param('id'));
      return c.json({ success: true, data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'workspace backend unavailable';
      return c.json({ success: false, error: msg }, 502);
    }
  });

  app.get('/:id/conversations', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'workspace-backend' }, 503);
    }
    try {
      const data = await client.listConversations(c.req.param('id'));
      return c.json({ success: true, data });
    } catch (err) {
      logger.warn(
        { service: 'workspace-backend', err: err instanceof Error ? err.message : String(err) },
        'workspace proxy degraded — upstream failed, returning empty conversations'
      );
      return c.json({
        success: true,
        degraded: true,
        error: err instanceof Error ? err.message : 'workspace upstream failed',
        data: { conversations: [] },
      });
    }
  });

  app.get('/:id/apps', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'workspace-backend' }, 503);
    }
    try {
      const data = await client.listApps(c.req.param('id'));
      return c.json({ success: true, data });
    } catch (err) {
      logger.warn(
        { service: 'workspace-backend', err: err instanceof Error ? err.message : String(err) },
        'workspace proxy degraded — upstream failed, returning empty apps'
      );
      return c.json({
        success: true,
        degraded: true,
        error: err instanceof Error ? err.message : 'workspace upstream failed',
        data: { apps: [] },
      });
    }
  });

  app.post('/:id/apps/:appId/deploy', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ success: false, error: 'Workspace backend not configured' }, 503);
    }
    try {
      const data = await client.deployApp(c.req.param('id'), c.req.param('appId'));
      return c.json({ success: true, data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'workspace backend unavailable';
      return c.json({ success: false, error: msg }, 502);
    }
  });

  return app;
}
