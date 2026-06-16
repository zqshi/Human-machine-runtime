import { Hono } from 'hono';
import { z } from 'zod';
import type { UserManagementService } from '../../contexts/identity-access/user-management-service.js';
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

const roleAssignmentSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export function createAdminAuthMgmtRoutes(userMgmtSvc: UserManagementService) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

  app.get('/users', async (c) => {
    const users = await userMgmtSvc.listUsers();
    return c.json({ users });
  });

  app.post('/users', async (c) => {
    const parsed = await parseBody(c, createUserSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const user = await userMgmtSvc.createUserForAdmin(parsed.data);
    return c.json(user, 201);
  });

  app.post('/users/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const parsed = await parseBody(c, updateUserSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const user = await userMgmtSvc.updateUser(id, parsed.data);
    if (!user) return c.json({ error: 'user not found' }, 404);
    return c.json(user);
  });

  app.post('/users/:id/delete', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const ok = await userMgmtSvc.deleteUser(id);
    return c.json({ success: ok });
  });

  app.get('/roles', async (c) => {
    const { roles } = await userMgmtSvc.listRoles();
    return c.json({ roles });
  });

  app.post('/roles', async (c) => {
    const parsed = await parseBody(c, createRoleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const role = await userMgmtSvc.createRole(parsed.data);
    return c.json(role, 201);
  });

  app.post('/roles/:role', async (c) => {
    const id = parseInt(c.req.param('role'), 10);
    const parsed = await parseBody(c, updateRoleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const role = await userMgmtSvc.updateRole(id, parsed.data);
    if (!role) return c.json({ error: 'role not found' }, 404);
    return c.json(role);
  });

  app.post('/roles/:role/delete', async (c) => {
    const id = parseInt(c.req.param('role'), 10);
    const ok = await userMgmtSvc.deleteRole(id);
    return c.json({ success: ok });
  });

  app.post('/role-assignments', async (c) => {
    const parsed = await parseBody(c, roleAssignmentSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const result = await userMgmtSvc.assignRole(parseInt(parsed.data.userId, 10), parseInt(parsed.data.roleId, 10));
    return c.json(result ?? { success: true });
  });

  app.delete('/role-assignments', async (c) => {
    const parsed = await parseBody(c, roleAssignmentSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const ok = await userMgmtSvc.removeRoleAssignment(parseInt(parsed.data.userId, 10), parseInt(parsed.data.roleId, 10));
    return c.json({ success: ok });
  });

  return app;
}
