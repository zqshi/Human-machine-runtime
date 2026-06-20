import { Hono } from 'hono';
import { z } from 'zod';
import { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { ClusterInstanceClient } from '../../contexts/gateway/clients/cluster-instance-client.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const createInstanceSchema = z.object({
  tenantId: z.string().min(1),
  matrixUserId: z.string().min(1),
  creator: z.string().min(1),
  displayName: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  email: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  departmentId: z.string().optional(),
  permissionTemplateId: z.string().optional(),
  permissionTemplate: z.record(z.unknown()).optional(),
  requestId: z.string().optional(),
});

export function createInstanceRoutes(
  instanceService: InstanceService,
  clusterInstanceClient?: ClusterInstanceClient
) {
  const app = new Hono();

  app.get('/', async (c) => {
    const tenantId = c.req.query('tenantId');
    const instances = await instanceService.list(tenantId);

    if (!instances.length && clusterInstanceClient?.isConfigured()) {
      try {
        const res = await clusterInstanceClient.listInstances();
        if (res.items?.length) {
          const mapped = res.items.map((r) => ({
            id: `cm_${r.employeeNumber}`,
            tenantId: 'default',
            name: r.name || r.podName,
            source: 'cluster-instance',
            state: r.status,
            creator: r.managedBy,
            employeeNo: String(r.employeeNumber),
            employeeId: r.userId,
            createdAt: r.createdAt,
          }));
          return c.json({ success: true, data: mapped, total: res.total });
        }
      } catch {
        /* unavailable */
      }
    }

    return c.json({ success: true, data: instances, total: instances.length });
  });

  app.get('/:id', async (c) => {
    const instance = await instanceService.get(c.req.param('id'));
    return c.json({ success: true, data: instance });
  });

  app.post('/', async (c) => {
    const parsed = await parseBody(c, createInstanceSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const instance = await instanceService.createFromMatrix(parsed.data);
    return c.json({ success: true, data: instance }, 201);
  });

  app.post('/:id/start', async (c) => {
    const instance = await instanceService.start(c.req.param('id'));
    return c.json({ success: true, data: instance });
  });

  app.post('/:id/stop', async (c) => {
    const instance = await instanceService.stop(c.req.param('id'));
    return c.json({ success: true, data: instance });
  });

  app.post('/:id/rebuild', async (c) => {
    const instance = await instanceService.rebuild(c.req.param('id'));
    return c.json({ success: true, data: instance });
  });

  app.delete('/:id', async (c) => {
    const result = await instanceService.remove(c.req.param('id'));
    return c.json({ success: true, data: result });
  });

  return app;
}
