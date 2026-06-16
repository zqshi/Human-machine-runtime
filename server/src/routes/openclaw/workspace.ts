import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { WorkspaceService } from '../../contexts/workspace/workspace-service.js';
import type { Principal } from '../../middleware/auth.js';

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['APP', 'SKILL', 'NORMAL', 'AGENT']).default('AGENT'),
  description: z.string().optional(),
});

const createFromChatSchema = z.object({
  channelType: z.string().min(1),
  conversationId: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(['APP', 'SKILL', 'NORMAL', 'AGENT']).optional(),
});

const generateSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  conversationId: z.string().optional(),
  agentId: z.string().optional(),
});

const installSkillSchema = z.object({
  skillId: z.string().min(1),
});

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createOpenclawWorkspaceRoutes(workspaceService: WorkspaceService) {
  const app = new Hono();

  app.get('/workspace/list', async (c) => {
    const user = getUser(c);
    const workspaces = await workspaceService.listByOwner(user.username);
    return c.json({ workspaces, total: workspaces.length });
  });

  app.get('/workspace/agents', async (c) => {
    const user = getUser(c);
    try {
      const agents = await workspaceService.listAgents(user.username);
      return c.json({ agents, total: agents.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upstream unavailable';
      return c.json({ error: message, service: 'claw-manager' }, 502);
    }
  });

  app.get('/workspace/:id', async (c) => {
    const ws = await workspaceService.get(c.req.param('id'));
    return c.json(ws);
  });

  app.get('/workspace/:id/status', async (c) => {
    const ws = await workspaceService.get(c.req.param('id'));
    return c.json({ id: ws.id, status: ws.status, updatedAt: ws.updatedAt });
  });

  app.post('/workspace/create', async (c) => {
    const body = await c.req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const user = getUser(c);
    const ws = await workspaceService.create({
      ...parsed.data,
      ownerId: user.username,
      tenantId: user.tenantId || 'default',
    });
    return c.json(ws, 201);
  });

  app.post('/workspace/create-from-chat', async (c) => {
    const body = await c.req.json();
    const parsed = createFromChatSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const user = getUser(c);
    const ws = await workspaceService.createFromChat({
      ...parsed.data,
      ownerId: user.username,
      tenantId: user.tenantId || 'default',
    });
    return c.json(ws, 201);
  });

  app.post('/workspace/:id/generate', async (c) => {
    const workspaceId = c.req.param('id');
    const body = await c.req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }

    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const { prompt, ...options } = parsed.data;
    const response = await workspaceService.generateStream(workspaceId, prompt, options, authToken);

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    return new Response(response.body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  });

  app.get('/workspace/:id/conversations', async (c) => {
    const conversations = await workspaceService.listConversations(c.req.param('id'));
    return c.json({ conversations, total: conversations.length });
  });

  app.get('/workspace/:id/apps', async (c) => {
    const apps = await workspaceService.listApps(c.req.param('id'));
    return c.json({ apps, total: apps.length });
  });

  app.post('/workspace/:id/apps/:appId/deploy', async (c) => {
    const result = await workspaceService.deployApp(c.req.param('id'), c.req.param('appId'));
    return c.json({ success: true, deployment: result });
  });

  app.post('/workspace/:id/skills', async (c) => {
    const body = await c.req.json();
    const parsed = installSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const result = await workspaceService.installSkill(
      c.req.param('id'),
      parsed.data.skillId,
      authToken
    );
    return c.json({ success: true, result });
  });

  return app;
}
