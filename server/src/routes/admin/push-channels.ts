import { Hono } from 'hono';
import { z } from 'zod';
import type { PushChannelService } from '../../contexts/push-channel/push-channel-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const createPushChannelSchema = z
  .object({
    appId: z.string().min(1).optional(),
    name: z.string().min(1),
    ak: z.string().optional(),
    sk: z.string().optional(),
    type: z.string().optional(),
    webhookUrl: z.string().url().optional().or(z.literal('')),
    webhookEnabled: z.boolean().optional(),
    endpoint: z.string().optional(),
  })
  .passthrough();

const updatePushChannelSchema = createPushChannelSchema.partial();

export function createAdminPushChannelRoutes(pushSvc: PushChannelService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const channels = await pushSvc.list();
    return c.json({ channels });
  });

  app.get('/:id', async (c) => {
    const channel = await pushSvc.get(c.req.param('id'));
    if (!channel) return c.json({ error: 'channel not found' }, 404);
    return c.json(channel);
  });

  app.post('/', async (c) => {
    const parsed = await parseBody(c, createPushChannelSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const channel = await pushSvc.create(parsed.data);
    return c.json(channel, 201);
  });

  app.put('/:id', async (c) => {
    const parsed = await parseBody(c, updatePushChannelSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const channel = await pushSvc.update(c.req.param('id'), parsed.data);
    if (!channel) return c.json({ error: 'channel not found' }, 404);
    return c.json(channel);
  });

  app.delete('/:id', async (c) => {
    await pushSvc.delete(c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/:id/delete', async (c) => {
    await pushSvc.delete(c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/:id/test', async (c) => {
    const result = await pushSvc.testWebhook(c.req.param('id'));
    return c.json(result);
  });

  return app;
}
