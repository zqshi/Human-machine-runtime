import { Hono } from 'hono';
import { z } from 'zod';
import type { UserManagementService } from '../../contexts/identity-access/user-management-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const createRoleSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  permissions: z.array(z.string()).optional(),
});

const updateRoleSchema = z
  .object({
    displayName: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  })
  .passthrough();

export function createPlatformRoleRoutes(userMgmtSvc: UserManagementService) {
  const app = new Hono();

  app.get('/', async (c) => {
    return c.json(await userMgmtSvc.listRoles());
  });

  app.post('/', async (c) => {
    const parsed = await parseBody(c, createRoleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const role = await userMgmtSvc.createRole(parsed.data);
    return c.json(role, 201);
  });

  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const parsed = await parseBody(c, updateRoleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const role = await userMgmtSvc.updateRole(id, parsed.data);
    if (!role) return c.json({ error: 'role not found' }, 404);
    return c.json(role);
  });

  app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const ok = await userMgmtSvc.deleteRole(id);
    return c.json({ success: ok });
  });

  return app;
}
