import { Hono } from 'hono';
import { z } from 'zod';
import type { NotificationService } from '../../contexts/notification/notification-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const snoozeSchema = z.object({
  hours: z.number().min(1).max(168),
});

export function createAdminNotificationRoutes(notifSvc: NotificationService) {
  const app = new Hono();

  app.get('/', async (c) => {
    return c.json(await notifSvc.list());
  });

  app.get('/count', async (c) => {
    return c.json(await notifSvc.getUnreadCount());
  });

  app.post('/:id/read', async (c) => {
    await notifSvc.markRead(c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/:id/dismiss', async (c) => {
    await notifSvc.dismiss(c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/:id/snooze', async (c) => {
    const parsed = await parseBody(c, snoozeSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    await notifSvc.snooze(c.req.param('id'), parsed.data.hours);
    return c.json({ success: true });
  });

  app.post('/:id/escalate', async (c) => {
    await notifSvc.escalate(c.req.param('id'));
    return c.json({ success: true });
  });

  return app;
}
