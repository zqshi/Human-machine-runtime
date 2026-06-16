import { Hono } from 'hono';
import { z } from 'zod';
import type { SystemConfigService } from '../../contexts/system-config/system-config-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const sedimentationPolicySchema = z
  .object({
    mode: z.string().optional(),
    minConfidence: z.number().optional(),
    minRepeated: z.number().optional(),
    fallback: z.string().optional(),
  })
  .passthrough();

const openclawConfigSchema = z.record(z.unknown());

export function createAdminRuntimeRoutes(configSvc: SystemConfigService) {
  const app = new Hono();

  app.get('/skill-sedimentation-policy', async (c) => {
    return c.json(await configSvc.getSedimentationPolicy());
  });

  app.post('/skill-sedimentation-policy', async (c) => {
    const parsed = await parseBody(c, sedimentationPolicySchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    await configSvc.setSedimentationPolicy(parsed.data);
    return c.json({ success: true });
  });

  app.get('/openclaw-config', async (c) => {
    return c.json(await configSvc.getOpenclawConfig());
  });

  app.post('/openclaw-config', async (c) => {
    const parsed = await parseBody(c, openclawConfigSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    await configSvc.setOpenclawConfig(parsed.data);
    return c.json({ success: true });
  });

  app.get('/openclaw-config/snapshots', async (c) => {
    const snapshots = await configSvc.listOpenclawConfigSnapshots();
    return c.json({ snapshots });
  });

  app.post('/openclaw-config/snapshots/:snapshotId/restore', async (c) => {
    const ok = await configSvc.restoreOpenclawConfigSnapshot(c.req.param('snapshotId'));
    if (!ok) return c.json({ error: 'snapshot not found' }, 404);
    return c.json({ success: true });
  });

  return app;
}
