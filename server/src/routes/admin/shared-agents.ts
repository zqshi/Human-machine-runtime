import { Hono } from 'hono';
import { z } from 'zod';
import type { SharedAgentService } from '../../contexts/shared-agent/shared-agent-service.js';

const registerSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export function createAdminSharedAgentRoutes(sharedAgentSvc: SharedAgentService) {
  const app = new Hono();

  app.get('/', async (c) => {
    return c.json(await sharedAgentSvc.listAll());
  });

  app.post('/recommend', async (c) => {
    const body = await c.req.json<{ requirement?: string }>();
    return c.json(await sharedAgentSvc.recommend(body.requirement));
  });

  app.post('/register', async (c) => {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const result = await sharedAgentSvc.register(parsed.data);
    return c.json({ success: true, ...result }, 201);
  });

  app.delete('/:id', async (c) => {
    const ok = await sharedAgentSvc.unregister(c.req.param('id'));
    return c.json({ success: ok });
  });

  return app;
}
