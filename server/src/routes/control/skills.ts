import { Hono } from 'hono';
import { SkillService } from '../../contexts/shared-assets/skill-service.js';

export function createSkillRoutes(skillService: SkillService) {
  const app = new Hono();

  app.get('/reports', async (c) => {
    const assetType = c.req.query('assetType');
    const status = c.req.query('status');
    const rows = status
      ? await skillService.listReportsByStatus(status)
      : await skillService.listReportsByType(assetType || undefined);
    return c.json({ success: true, data: rows, total: rows.length });
  });

  app.post('/reports', async (c) => {
    const body = await c.req.json();
    const report = await skillService.reportAsset(body);
    return c.json({ success: true, data: report }, 201);
  });

  app.post('/reports/:id/review', async (c) => {
    const { reviewer, decision, opinion } = await c.req.json();
    const result = await skillService.reviewReport(c.req.param('id'), reviewer, decision, opinion);
    return c.json({ success: true, data: result });
  });

  app.get('/shared', async (c) => {
    const assetType = c.req.query('assetType');
    const assets = await skillService.listSharedAssets(assetType || undefined);
    return c.json({ success: true, data: assets, total: assets.length });
  });

  app.post('/shared/:id/bind', async (c) => {
    const { tenantId, assetType, actor } = await c.req.json();
    const binding = await skillService.bindSharedAsset(
      tenantId,
      c.req.param('id'),
      assetType,
      actor
    );
    return c.json({ success: true, data: binding });
  });

  app.get('/bindings', async (c) => {
    const assetType = c.req.query('assetType');
    const bindings = await skillService.listAssetBindings(assetType || undefined);
    return c.json({ success: true, data: bindings, total: bindings.length });
  });

  return app;
}
