import { Hono } from 'hono';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { ClawFarmClient } from '../../contexts/gateway/clients/claw-farm-client.js';
import type { ClawManagerClient } from '../../contexts/gateway/clients/claw-manager-client.js';

export function createAdminInstanceRoutes(
  svc: InstanceService,
  clawFarmClient?: ClawFarmClient,
  clawManagerClient?: ClawManagerClient
) {
  const app = new Hono();

  app.get('/', async (c) => {
    const instances = await svc.list();

    if (!instances.length && clawManagerClient?.isConfigured()) {
      try {
        const res = await clawManagerClient.listInstances();
        if (res.items?.length) {
          return c.json({
            instances: res.items.map((r) => ({
              id: `cm_${r.employeeNumber}`,
              name: r.name || r.podName,
              state: r.status,
              tenantId: 'default',
              source: 'claw-manager',
              remote: {
                podName: r.podName,
                nodeName: r.nodeName ?? null,
                restarts: r.restarts ?? 0,
              },
              createdAt: r.createdAt,
            })),
            total: res.total,
            remote: res.items,
          });
        }
      } catch {
        /* unavailable */
      }
    }

    let remoteInstances: unknown[] | null = null;
    if (clawManagerClient?.isConfigured()) {
      try {
        const res = await clawManagerClient.listInstances();
        remoteInstances = res.items ?? null;
      } catch {
        /* claw-manager unavailable */
      }
    }
    if (!remoteInstances && clawFarmClient?.isConfigured()) {
      try {
        const res = await clawFarmClient.listInstances();
        const arr = Array.isArray(res) ? res : (res as Record<string, unknown>)?.instances;
        remoteInstances = Array.isArray(arr) ? arr : null;
      } catch {
        /* gateway unavailable */
      }
    }

    return c.json({
      instances,
      total: instances.length,
      remote: remoteInstances,
    });
  });

  app.get('/:id', async (c) => {
    const inst = await svc.get(c.req.param('id'));

    let remoteStatus: unknown = null;
    if (clawFarmClient?.isConfigured()) {
      try {
        remoteStatus = await clawFarmClient.getInstanceStatus(inst.id);
      } catch {
        /* gateway unavailable */
      }
    }

    return c.json({ ...inst, remoteStatus });
  });

  app.post('/:id/start', async (c) => {
    const inst = await svc.start(c.req.param('id'));
    return c.json(inst);
  });

  app.post('/:id/stop', async (c) => {
    const inst = await svc.stop(c.req.param('id'));
    return c.json(inst);
  });

  app.post('/:id/rebuild', async (c) => {
    const inst = await svc.rebuild(c.req.param('id'));
    return c.json(inst);
  });

  return app;
}
