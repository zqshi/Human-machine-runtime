import { Hono } from 'hono';
import { MarketplaceClient } from '../clients/marketplace-client.js';
import { getUpstreamToken } from '../../../middleware/auth.js';
import { GatewayError } from '../clients/base-client.js';

function gatewayErrorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  err: unknown
) {
  if (err instanceof GatewayError) {
    return c.json(
      { success: false, error: err.message, service: 'marketplace' },
      err.status as 502
    );
  }
  const message = err instanceof Error ? err.message : 'upstream unavailable';
  return c.json({ success: false, error: message, service: 'marketplace' }, 502);
}

export function createMarketplaceProxyRoutes(client: MarketplaceClient) {
  const app = new Hono();

  app.get('/skills', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'marketplace' }, 503);
    }
    const keyword = c.req.query('keyword');
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const authToken = getUpstreamToken(c);
    try {
      const data = await client.listSkills(
        { keyword: keyword || undefined, page, pageSize },
        authToken
      );
      return c.json({ success: true, data });
    } catch (err) {
      return gatewayErrorResponse(c, err);
    }
  });

  app.get('/skills/:id', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'marketplace' }, 503);
    }
    const authToken = getUpstreamToken(c);
    try {
      const data = await client.getSkill(c.req.param('id'), authToken);
      return c.json({ success: true, data });
    } catch (err) {
      return gatewayErrorResponse(c, err);
    }
  });

  app.get('/skills/search', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'marketplace' }, 503);
    }
    const keyword = c.req.query('keyword') || '';
    const authToken = getUpstreamToken(c);
    try {
      const data = await client.searchSkills(keyword, undefined, authToken);
      return c.json({ success: true, data });
    } catch (err) {
      return gatewayErrorResponse(c, err);
    }
  });

  app.get('/agents', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'marketplace' }, 503);
    }
    const keyword = c.req.query('keyword');
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const authToken = getUpstreamToken(c);
    try {
      const data = await client.listAgents(
        { keyword: keyword || undefined, page, pageSize },
        authToken
      );
      return c.json({ success: true, data });
    } catch (err) {
      return gatewayErrorResponse(c, err);
    }
  });

  app.get('/agents/:id', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'marketplace' }, 503);
    }
    const authToken = getUpstreamToken(c);
    try {
      const data = await client.getAgent(c.req.param('id'), authToken);
      return c.json({ success: true, data });
    } catch (err) {
      return gatewayErrorResponse(c, err);
    }
  });

  return app;
}
