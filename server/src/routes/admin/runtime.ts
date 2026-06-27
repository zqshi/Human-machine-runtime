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

const cockpitConfigSchema = z.record(z.unknown());

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

  app.get('/cockpit-config', async (c) => {
    return c.json(await configSvc.getCockpitConfig());
  });

  app.post('/cockpit-config', async (c) => {
    const parsed = await parseBody(c, cockpitConfigSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    await configSvc.setCockpitConfig(parsed.data);
    return c.json({ success: true });
  });

  app.get('/cockpit-config/snapshots', async (c) => {
    const snapshots = await configSvc.listCockpitConfigSnapshots();
    return c.json({ snapshots });
  });

  app.post('/cockpit-config/snapshots/:snapshotId/restore', async (c) => {
    const ok = await configSvc.restoreCockpitConfigSnapshot(c.req.param('snapshotId'));
    if (!ok) return c.json({ error: 'snapshot not found' }, 404);
    return c.json({ success: true });
  });

  return app;
}
