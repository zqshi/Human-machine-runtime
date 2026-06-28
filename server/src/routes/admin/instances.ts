import { Hono } from 'hono';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { ContainerOrchestratorClient } from '../../contexts/gateway/clients/container-orchestrator-client.js';
import type { ClusterInstanceClient } from '../../contexts/gateway/clients/cluster-instance-client.js';

export function createAdminInstanceRoutes(
  svc: InstanceService,
  containerOrchestratorClient?: ContainerOrchestratorClient,
  clusterInstanceClient?: ClusterInstanceClient
) {
  const app = new Hono();

  app.get('/', async (c) => {
    // §7.2.1 第2条:列表分页,limit 下推 DB(默认 100,max 100,避免无限制全量)
    const limit = Math.min(100, parseInt(c.req.query('limit') ?? '100', 10) || 100);
    const offset = Math.max(0, parseInt(c.req.query('skip') ?? '0', 10) || 0);
    const instances = await svc.list(undefined, undefined, { limit, offset });

    if (!instances.length && clusterInstanceClient?.isConfigured()) {
      try {
        const res = await clusterInstanceClient.listInstances();
        if (res.items?.length) {
          return c.json({
            instances: res.items.map((r) => ({
              id: `cm_${r.employeeNumber}`,
              name: r.name || r.podName,
              state: r.status,
              tenantId: 'default',
              source: 'cluster-instance',
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
    if (clusterInstanceClient?.isConfigured()) {
      try {
        const res = await clusterInstanceClient.listInstances();
        remoteInstances = res.items ?? null;
      } catch {
        /* cluster-instance unavailable */
      }
    }
    if (!remoteInstances && containerOrchestratorClient?.isConfigured()) {
      try {
        const res = await containerOrchestratorClient.listInstances();
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
    if (containerOrchestratorClient?.isConfigured()) {
      try {
        remoteStatus = await containerOrchestratorClient.getInstanceStatus(inst.id);
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
