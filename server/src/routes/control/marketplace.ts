import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { MarketplaceService } from '../../contexts/marketplace/marketplace-service.js';
import type { Principal } from '../../middleware/auth.js';

const installSchema = z.object({
  skillId: z.string().min(1),
  version: z.string().optional(),
});

const publishSchema = z.object({
  skillSlug: z.string().min(1),
  version: z.string().optional(),
  changelog: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().optional(),
});

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createControlMarketplaceRoutes(marketplaceService: MarketplaceService) {
  const app = new Hono();

  app.get('/skills', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId || 'default';
    const keyword = c.req.query('keyword');
    const page = Number(c.req.query('page')) || 1;
    const pageSize = Number(c.req.query('pageSize')) || 20;

    const skills = await marketplaceService.listSkillsForTenant(tenantId, {
      keyword,
      page,
      pageSize,
    });
    return c.json({ success: true, data: skills });
  });

  app.get('/skills/:id', async (c) => {
    const skill = await marketplaceService.getSkill(c.req.param('id'));
    return c.json({ success: true, data: skill });
  });

  app.get('/skills/:id/stats', async (c) => {
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const stats = await marketplaceService.getSkillStats(c.req.param('id'), authToken);
    return c.json({ success: true, data: stats });
  });

  app.post('/skills/install', async (c) => {
    const body = await c.req.json();
    const parsed = installSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const result = await marketplaceService.downloadSkill(
      parsed.data.skillId,
      parsed.data.version,
      authToken
    );
    return c.json({ success: true, data: result });
  });

  app.post('/skills/publish', async (c) => {
    const body = await c.req.json();
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const user = getUser(c);
    const tenantId = user.tenantId || 'default';
    const result = await marketplaceService.requestPublish(
      parsed.data.skillSlug,
      { version: parsed.data.version, changelog: parsed.data.changelog },
      user.username,
      tenantId
    );
    return c.json({ success: true, data: result });
  });

  app.get('/approvals', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId || 'default';
    const approvals = await marketplaceService.listPendingApprovals(tenantId);
    return c.json({ success: true, data: approvals, total: approvals.length });
  });

  app.post('/approve/:id', async (c) => {
    const user = getUser(c);
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const result = await marketplaceService.approvePublish(
      c.req.param('id'),
      user.username,
      authToken
    );
    if (!result) {
      return c.json({ error: 'approval not found or already processed' }, 404);
    }
    return c.json({ success: true, data: result });
  });

  app.post('/reject/:id', async (c) => {
    const user = getUser(c);
    const body = await c.req.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason : undefined;
    const result = await marketplaceService.rejectPublish(c.req.param('id'), user.username, reason);
    if (!result) {
      return c.json({ error: 'approval not found or already processed' }, 404);
    }
    return c.json({ success: true, data: result });
  });

  app.get('/agents', async (c) => {
    const keyword = c.req.query('keyword');
    const page = Number(c.req.query('page')) || 1;
    const pageSize = Number(c.req.query('pageSize')) || 20;
    const agents = await marketplaceService.listAgents({ keyword, page, pageSize });
    return c.json({ success: true, data: agents });
  });

  app.get('/agents/:id', async (c) => {
    const agent = await marketplaceService.getAgent(c.req.param('id'));
    return c.json({ success: true, data: agent });
  });

  app.get('/moderation', async (c) => {
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const type = c.req.query('type');
    const page = Number(c.req.query('page')) || 1;
    const pageSize = Number(c.req.query('pageSize')) || 20;
    const queue = await marketplaceService.getModerationQueue({ type, page, pageSize }, authToken);
    return c.json({ success: true, data: queue });
  });

  return app;
}
