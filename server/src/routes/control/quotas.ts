import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import type { QuotaService } from '../../contexts/quota-management/quota-service.js';
import type { TenantService } from '../../contexts/tenant-management/tenant-service.js';
import type { Principal } from '../../contexts/identity-access/auth-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

function resolveTenantId(c: Context): string | null {
  return (
    c.req.query('tenantId') || (c.get('user') as Principal | undefined)?.tenantId || 'default'
  );
}

const createRuleSchema = z.object({
  resourceType: z.enum(['instance_count', 'token_monthly', 'token_daily', 'storage', 'api_calls']),
  thresholdPct: z.number().int().min(1).max(100),
  severity: z.enum(['warning', 'critical']).optional(),
  notifyChannels: z.array(z.enum(['in_app', 'email', 'webhook'])).optional(),
  enabled: z.boolean().optional(),
});

const updateRuleSchema = z.object({
  thresholdPct: z.number().int().min(1).max(100).optional(),
  severity: z.enum(['warning', 'critical']).optional(),
  notifyChannels: z.array(z.enum(['in_app', 'email', 'webhook'])).optional(),
  enabled: z.boolean().optional(),
});

const CPU_OPTIONS = ['250m', '500m', '1000m', '2000m', '4000m'] as const;
const MEMORY_OPTIONS = ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'] as const;
const STORAGE_OPTIONS = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'] as const;

const updateDefaultsSchema = z.object({
  cpu: z.enum(CPU_OPTIONS).optional(),
  memory: z.enum(MEMORY_OPTIONS).optional(),
  storage: z.enum(STORAGE_OPTIONS).optional(),
  monthlyBudget: z.number().int().min(0).optional(),
  dailyBudget: z.number().int().min(0).optional(),
  maxConcurrency: z.number().int().min(1).optional(),
});

export function createQuotaRoutes(quotaService: QuotaService, tenantService: TenantService) {
  const app = new Hono();

  /* ──── Tenant Defaults ──── */

  app.get('/defaults', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const tenant = await tenantService.getById(tenantId);
    const q = tenant.quotas;
    return c.json({
      success: true,
      data: {
        cpu: q.instanceCpu,
        memory: q.instanceMemory,
        storage: q.instanceStorage,
        monthlyBudget: q.tokenBudgetMonthly,
        dailyBudget: q.tokenBudgetDaily,
        maxConcurrency: q.maxConcurrentInstances,
      },
    });
  });

  app.put('/defaults', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const parsed = await parseBody(c, updateDefaultsSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const d = parsed.data;
    const quotasPatch: Record<string, unknown> = {};
    if (d.cpu !== undefined) quotasPatch.instanceCpu = d.cpu;
    if (d.memory !== undefined) quotasPatch.instanceMemory = d.memory;
    if (d.storage !== undefined) quotasPatch.instanceStorage = d.storage;
    if (d.monthlyBudget !== undefined) quotasPatch.tokenBudgetMonthly = d.monthlyBudget;
    if (d.dailyBudget !== undefined) quotasPatch.tokenBudgetDaily = d.dailyBudget;
    if (d.maxConcurrency !== undefined) quotasPatch.maxConcurrentInstances = d.maxConcurrency;
    const updated = await tenantService.update(tenantId, { quotas: quotasPatch as never });
    const q = updated.quotas;
    return c.json({
      success: true,
      data: {
        cpu: q.instanceCpu,
        memory: q.instanceMemory,
        storage: q.instanceStorage,
        monthlyBudget: q.tokenBudgetMonthly,
        dailyBudget: q.tokenBudgetDaily,
        maxConcurrency: q.maxConcurrentInstances,
      },
    });
  });

  app.get('/dashboard', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const dashboard = await quotaService.getDashboard(tenantId);
    return c.json({ success: true, data: dashboard });
  });

  app.get('/allocation', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const allocation = await quotaService.getAllocation(tenantId);
    return c.json({ success: true, data: allocation });
  });

  app.get('/usage-history', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const days = parseInt(c.req.query('days') ?? '30', 10);
    const history = await quotaService.getUsageHistory(tenantId, days);
    return c.json({ success: true, data: history });
  });

  /* ──── Alert Rules ──── */

  app.get('/alerts/rules', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const rules = await quotaService.listRules(tenantId);
    return c.json({ success: true, data: rules });
  });

  app.post('/alerts/rules', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const parsed = await parseBody(c, createRuleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const rule = await quotaService.createRule(tenantId, parsed.data);
    return c.json({ success: true, data: rule }, 201);
  });

  app.put('/alerts/rules/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const parsed = await parseBody(c, updateRuleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const rule = await quotaService.updateRule(id, parsed.data);
    return c.json({ success: true, data: rule });
  });

  app.delete('/alerts/rules/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    await quotaService.deleteRule(id);
    return c.json({ success: true });
  });

  /* ──── Alert Events ──── */

  app.get('/alerts/events', async (c) => {
    const tenantId = resolveTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const status = c.req.query('status');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
    const events = await quotaService.listEvents(tenantId, { status, limit });
    return c.json({ success: true, data: events });
  });

  app.post('/alerts/events/:id/ack', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const event = await quotaService.acknowledgeEvent(id);
    return c.json({ success: true, data: event });
  });

  return app;
}
