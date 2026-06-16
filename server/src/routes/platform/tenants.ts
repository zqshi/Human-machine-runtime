import { Hono } from 'hono';
import { z } from 'zod';
import { TenantService } from '../../contexts/tenant-management/tenant-service.js';
import type { PlatformBeClient } from '../../contexts/gateway/clients/platform-be-client.js';

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).max(48).optional(),
  plan: z.enum(['free', 'trial', 'standard', 'professional', 'enterprise']).optional(),
  contactEmail: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  description: z.string().optional(),
  quotas: z.record(z.unknown()).optional(),
  features: z.record(z.unknown()).optional(),
  initialAdmin: z
    .object({
      username: z.string().min(1),
      password: z.string().min(6),
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

export function createTenantRoutes(
  tenantService: TenantService,
  platformBeClient?: PlatformBeClient
) {
  const app = new Hono();

  app.get('/', async (c) => {
    const status = c.req.query('status');
    const plan = c.req.query('plan');
    const q = c.req.query('q');
    const tenants = await tenantService.list({ status, plan, q });
    return c.json({ tenants, total: tenants.length });
  });

  app.get('/:id', async (c) => {
    const tenant = await tenantService.getById(c.req.param('id'));
    return c.json({ tenant });
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    const { tenant, adminCreated, initialCredentials } = await tenantService.create(
      parsed.data as Parameters<TenantService['create']>[0]
    );
    return c.json({ tenant, adminCreated, initialCredentials }, 201);
  });

  app.put('/:id', async (c) => {
    const tenant = await tenantService.update(c.req.param('id'), await c.req.json());
    return c.json({ tenant });
  });

  app.post('/:id/suspend', async (c) => {
    const tenant = await tenantService.suspend(c.req.param('id'));
    return c.json({ tenant });
  });

  app.post('/:id/activate', async (c) => {
    const tenant = await tenantService.activate(c.req.param('id'));
    return c.json({ tenant });
  });

  app.post('/:id/archive', async (c) => {
    const tenant = await tenantService.archive(c.req.param('id'));
    return c.json({ tenant });
  });

  app.get('/:id/usage', async (c) => {
    const usage = await tenantService.getUsage(c.req.param('id'));
    return c.json({ usage });
  });

  app.get('/:id/deletable', async (c) => {
    const result = await tenantService.checkDeletable(c.req.param('id'));
    return c.json(result);
  });

  app.delete('/:id', async (c) => {
    await tenantService.delete(c.req.param('id'));
    return c.json({ success: true });
  });

  app.post('/sync', async (c) => {
    if (!platformBeClient?.isConfigured()) {
      return c.json({ error: 'platform-be not configured' }, 503);
    }
    const { organizations } = await platformBeClient.listOrganizations();
    const result = await tenantService.syncFromUpstream(organizations);
    return c.json({ success: true, ...result });
  });

  return app;
}
