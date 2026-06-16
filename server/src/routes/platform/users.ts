import { Hono } from 'hono';
import { z } from 'zod';
import type { UserManagementService } from '../../contexts/identity-access/user-management-service.js';
import type { PlatformBeClient } from '../../contexts/gateway/clients/platform-be-client.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.string().optional(),
  scope: z.string().optional(),
  tenantId: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
});

const updateUserSchema = z
  .object({
    role: z.string().optional(),
    scope: z.string().optional(),
    displayName: z.string().optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export function createPlatformUserRoutes(
  userMgmtSvc: UserManagementService,
  platformBeClient?: PlatformBeClient
) {
  const app = new Hono();

  app.get('/', async (c) => {
    const { scope, role } = c.req.query();
    const users = await userMgmtSvc.listUsers({ scope, role });
    return c.json({ users });
  });

  app.post('/', async (c) => {
    const parsed = await parseBody(c, createUserSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const user = await userMgmtSvc.createUser(parsed.data);
    return c.json(user, 201);
  });

  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const parsed = await parseBody(c, updateUserSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const user = await userMgmtSvc.updateUser(id, parsed.data);
    if (!user) return c.json({ error: 'user not found' }, 404);
    return c.json(user);
  });

  app.post('/:id/reset-password', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const result = await userMgmtSvc.resetPassword(id);
    if (!result) return c.json({ error: 'user not found' }, 404);
    return c.json({ success: true, temporaryPassword: result.temporaryPassword });
  });

  app.post('/:id/toggle-disable', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const user = await userMgmtSvc.toggleDisable(id);
    if (!user) return c.json({ error: 'user not found' }, 404);
    return c.json(user);
  });

  app.post('/sync', async (c) => {
    if (!platformBeClient?.isConfigured()) {
      return c.json({ error: 'platform-be not configured' }, 503);
    }
    const { users: upstreamUsers } = await platformBeClient.listUsers();
    const result = await userMgmtSvc.syncUsersFromUpstream(upstreamUsers, 'platform-be');
    return c.json({ success: true, ...result });
  });

  return app;
}
