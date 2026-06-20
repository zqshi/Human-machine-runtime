import { Hono } from 'hono';
import { ContainerOrchestratorClient } from '../clients/container-orchestrator-client.js';
import type { ChannelService } from '../../channel/channel-service.js';
import { getUpstreamToken } from '../../../middleware/auth.js';

export function createChannelProxyRoutes(
  farmClient: ContainerOrchestratorClient,
  channelService?: ChannelService
) {
  const app = new Hono();

  app.get('/channels', async (c) => {
    if (!farmClient.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'container-orchestrator' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const data = await farmClient.listChannels(authToken);
    return c.json({ success: true, data });
  });

  app.post('/channels/:channelId/messages', async (c) => {
    if (!farmClient.isConfigured()) {
      return c.json({ success: false, error: 'ClawFarm service not configured' }, 503);
    }
    const body = await c.req.json();
    const authToken = getUpstreamToken(c);
    const data = await farmClient.sendMessage(c.req.param('channelId'), body, authToken);
    return c.json({ success: true, data });
  });

  app.get('/instances', async (c) => {
    if (!farmClient.isConfigured()) {
      return c.json({ error: 'upstream not configured', service: 'container-orchestrator' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const data = await farmClient.listInstances(authToken);
    return c.json({ success: true, data });
  });

  app.post('/instances/:id/start', async (c) => {
    if (!farmClient.isConfigured()) {
      return c.json({ success: false, error: 'ClawFarm service not configured' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const data = await farmClient.startInstance(c.req.param('id'), authToken);
    return c.json({ success: true, data });
  });

  app.post('/instances/:id/stop', async (c) => {
    if (!farmClient.isConfigured()) {
      return c.json({ success: false, error: 'ClawFarm service not configured' }, 503);
    }
    const authToken = getUpstreamToken(c);
    const data = await farmClient.stopInstance(c.req.param('id'), authToken);
    return c.json({ success: true, data });
  });

  app.get('/bridge/status', async (c) => {
    if (!channelService) return c.json({ success: true, data: { configured: [] } });
    return c.json({ success: true, data: { configured: channelService.listChannelTypes() } });
  });

  return app;
}
