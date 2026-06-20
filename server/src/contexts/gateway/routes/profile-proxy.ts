import { Hono } from 'hono';
import { ProfileServiceClient } from '../clients/profile-service-client.js';
import { getUpstreamToken } from '../../../middleware/auth.js';

export function createProfileProxyRoutes(client: ProfileServiceClient) {
  const app = new Hono();

  app.get('/:agentId', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'profile-service' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const data = await client.getAgentProfile(c.req.param('agentId'), authToken);
    return c.json({ success: true, data });
  });

  app.put('/:agentId', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ success: false, error: 'Profile service not configured' }, 503);
    }
    const body = await c.req.json();
    const authToken = getUpstreamToken(c);
    const data = await client.updateAgentProfile(c.req.param('agentId'), body, authToken);
    return c.json({ success: true, data });
  });

  app.get('/:agentId/journey', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'profile-service' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const data = await client.getAgentJourney(c.req.param('agentId'), authToken);
    return c.json({ success: true, data });
  });

  app.get('/:agentId/blog', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'profile-service' }, 503);
    }
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const authToken = getUpstreamToken(c);
    const data = await client.listBlogEntries(
      c.req.param('agentId'),
      { page, pageSize },
      authToken
    );
    return c.json({ success: true, data });
  });

  app.get('/:agentId/usage', async (c) => {
    if (!client.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'profile-service' }, 503);
    }
    const period = c.req.query('period');
    const authToken = getUpstreamToken(c);
    const data = await client.getUsageSummary(
      c.req.param('agentId'),
      period || undefined,
      authToken
    );
    return c.json({ success: true, data });
  });

  return app;
}
