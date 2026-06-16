import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import AdmZip from 'adm-zip';
import type { SkillService } from '../../contexts/shared-assets/skill-service.js';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import type { ClawHubClient } from '../../contexts/gateway/clients/clawhub-client.js';
import type { Principal } from '../../middleware/auth.js';

const createSkillSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  contentRef: z.string().optional(),
  version: z.string().optional(),
});

const updateSkillSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  contentRef: z.string().optional(),
  version: z.string().optional(),
  status: z.string().optional(),
});

const policySchema = z.object({
  mode: z.string().optional(),
  minConfidence: z.number().optional(),
  minRepeated: z.number().optional(),
  fallback: z.string().optional(),
  overrides: z.array(z.unknown()).optional(),
});

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createAdminSkillRoutes(
  skillSvc: SkillService,
  instanceSvc: InstanceService,
  opRepo: OperationalRepository,
  clawHubClient?: ClawHubClient
) {
  const app = new Hono();

  app.get('/employees', async (c) => {
    const instances = await instanceSvc.list();
    const employees = instances.map((inst) => ({
      id: inst.id,
      name: inst.name,
      department: inst.department,
      jobTitle: inst.jobTitle,
      state: inst.state,
    }));
    return c.json(employees);
  });

  app.get('/export', async (c) => {
    const assets = await skillSvc.listSharedAssets();
    return c.json({ skills: assets, exportedAt: new Date().toISOString() });
  });

  app.post('/import', async (c) => {
    const body = await c.req.json<{
      skills?: { name: string; description?: string; tags?: string[] }[];
    }>();
    const skills = body.skills ?? [];
    let imported = 0;
    for (const s of skills) {
      if (!s.name) continue;
      await skillSvc.report({
        sourceTenantId: 'default',
        sourceInstanceId: 'import',
        name: s.name,
        description: s.description,
        tags: s.tags,
        assetType: 'skill',
      });
      imported++;
    }
    return c.json({ success: true, imported });
  });

  app.get('/', async (c) => {
    const category = c.req.query('category');
    const status = c.req.query('status');
    const keyword = c.req.query('keyword');
    const name = c.req.query('name');
    const source = c.req.query('source');
    let skills = await skillSvc.listSharedAssets(category);
    if (status) skills = skills.filter((s) => s.status === status);
    if (keyword || name) {
      const q = (keyword || name || '').toLowerCase();
      skills = skills.filter((s) => s.name.toLowerCase().includes(q));
    }

    const localSkills = skills.map((s) => ({ ...s, source: 'local' }));

    let hubSkills: Record<string, unknown>[] = [];
    if (source !== 'local' && clawHubClient?.isConfigured()) {
      try {
        const hubRes = await clawHubClient.listSkills({
          keyword: keyword || name,
          page: 1,
          pageSize: 50,
        });
        const items = Array.isArray(hubRes) ? hubRes : (hubRes as Record<string, unknown>)?.items;
        if (Array.isArray(items)) {
          hubSkills = items.map((s: Record<string, unknown>) => ({ ...s, source: 'hub' }));
        }
      } catch {
        /* clawhub unavailable */
      }
    }

    const results = source === 'hub' ? hubSkills : [...localSkills, ...hubSkills];
    return c.json({ skills: results, total: results.length });
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const skill = await skillSvc.getSharedAsset(id);
    if (skill) {
      const bindings = await skillSvc.findBindingsByAsset(id);
      const linkedEmployeeIds = bindings.map((b) => b.tenantId);
      return c.json({
        ...skill,
        source: 'shared',
        linkedEmployeeIds,
        metadata: { author: skill.publishedBy, runtime: 'v2' },
        versions: [{ version: skill.version || '1.0', date: skill.updatedAt, changes: '当前版本' }],
      });
    }

    if (clawHubClient?.isConfigured()) {
      try {
        const hubSkill = await clawHubClient.getSkill(id);
        if (hubSkill) return c.json({ ...hubSkill, source: 'hub' });
      } catch {
        /* clawhub unavailable */
      }
    }

    return c.json({ error: 'skill not found' }, 404);
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    const report = await skillSvc.report({
      sourceTenantId: 'default',
      sourceInstanceId: 'system',
      name: data.name,
      description: data.description,
      tags: data.tags,
      contentRef: data.contentRef,
      version: data.version,
      assetType: 'skill',
    });
    return c.json(report, 201);
  });

  app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const updated = await skillSvc.updateSharedAsset(id, parsed.data);
    return c.json(updated);
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const ok = await skillSvc.deleteSharedAsset(id);
    return c.json({ success: ok });
  });

  app.post('/:id/link', async (c) => {
    const assetId = c.req.param('id');
    const body = await c.req.json<{ employeeId?: string; tenantId?: string }>();
    const user = getUser(c);
    const tenantId = body.tenantId || user.tenantId || 'default';
    const binding = await skillSvc.linkAssetToInstance(
      assetId,
      body.employeeId || '',
      tenantId,
      user.username
    );
    return c.json({ success: true, binding });
  });

  app.post('/:id/unlink', async (c) => {
    const assetId = c.req.param('id');
    const body = await c.req.json<{ tenantId?: string }>();
    const user = getUser(c);
    const tenantId = body.tenantId || user.tenantId || 'default';
    const ok = await skillSvc.unlinkAsset(assetId, tenantId);
    return c.json({ success: ok });
  });

  app.get('/:id/policy', async (c) => {
    const id = c.req.param('id');
    const record = await opRepo.get('tool_config', `skill_policy_${id}`);
    if (record) return c.json(record);
    return c.json({
      mode: 'auto',
      minConfidence: 0.8,
      minRepeated: 3,
      fallback: 'ignore',
      overrides: [],
    });
  });

  app.put('/:id/policy', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = policySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid policy', details: parsed.error.flatten() }, 400);
    }
    await opRepo.upsert('tool_config', `skill_policy_${id}`, {
      ...parsed.data,
      category: 'skill_policy',
      name: `Skill ${id} Policy`,
    });
    return c.json({ success: true, policy: parsed.data });
  });

  app.get('/:id/file', async (c) => {
    const id = c.req.param('id');
    const filename = c.req.query('filename');
    const version = c.req.query('version');
    if (!filename) {
      return c.json({ error: 'filename query parameter is required' }, 400);
    }
    if (!clawHubClient?.isConfigured()) {
      return c.json({ error: 'clawhub not configured' }, 503);
    }
    try {
      const baseUrl = (clawHubClient as unknown as { baseUrl: string }).baseUrl;
      const params = new URLSearchParams({ slug: id });
      if (version) params.set('version', version);
      const res = await fetch(`${baseUrl}/api/v1/download?${params}`);
      if (!res.ok) {
        return c.json({ error: 'skill package not found upstream' }, 404);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const zip = new AdmZip(buffer);
      const entry = zip.getEntry(filename);
      if (!entry) {
        return c.json({ error: 'file not found in skill package' }, 404);
      }
      const content = entry.getData().toString('utf-8');
      return c.json({ filename, content, size: content.length });
    } catch {
      return c.json({ error: 'failed to fetch skill package from upstream' }, 502);
    }
  });

  return app;
}
