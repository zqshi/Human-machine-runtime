import { describe, it, expect, vi } from 'vitest';
import { SystemJobHandler } from './system-handler.js';
import { registerInstanceReconciler } from './instance-reconciler.js';
import type { InstanceService } from '../../tenant-instance/instance-service.js';
import { createInstance, STATE, type Instance } from '../../tenant-instance/domain/instance.js';

function makeInstance(over: Partial<Instance> = {}): Instance {
  return { ...createInstance({ tenantId: 'tnt_1', name: 'n', creator: 'system' }), ...over };
}

function makeService(
  instances: Instance[],
  reconcileImpl?: (id: string) => Promise<Instance>
): InstanceService {
  return {
    list: vi.fn(async () => instances),
    reconcile: vi.fn(reconcileImpl ?? (async () => makeInstance())),
  } as unknown as InstanceService;
}

function runReconciler(handler: SystemJobHandler, payload: Record<string, unknown> = {}) {
  return handler.run({
    taskId: 't',
    jobType: 'system',
    jobPayload: { handlerKey: 'instance-reconciler', ...payload },
    triggerType: 'scheduled',
    runId: 'r',
  });
}

describe('instance-reconciler', () => {
  it('skips no-drift instances without calling reconcile', async () => {
    const inst = makeInstance({
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 0,
      runtime: { reconciledSpecGeneration: 0 },
    });
    const svc = makeService([inst]);
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    const r = await runReconciler(h);
    expect(svc.reconcile).not.toHaveBeenCalled();
    expect((r.metadata as { noop: number }).noop).toBe(1);
    expect((r.metadata as { reconciled: number }).reconciled).toBe(0);
  });

  it('reconciles spec-drifted instances', async () => {
    const drifted = makeInstance({
      id: 'inst_1',
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 2,
      runtime: { reconciledSpecGeneration: 1 },
    });
    const svc = makeService([drifted]);
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    const r = await runReconciler(h);
    expect(svc.reconcile).toHaveBeenCalledWith('inst_1', { failureThreshold: 3 });
    expect((r.metadata as { reconciled: number }).reconciled).toBe(1);
  });

  it('reconciles state drift (desired=stopped, actual running)', async () => {
    const inst = makeInstance({ id: 'inst_2', state: STATE.RUNNING, desiredState: STATE.STOPPED });
    const svc = makeService([inst]);
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    await runReconciler(h);
    expect(svc.reconcile).toHaveBeenCalledWith('inst_2', { failureThreshold: 3 });
  });

  it('records failure when reconcile throws (rebuild fallback also failed)', async () => {
    const drifted = makeInstance({
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 2,
      runtime: { reconciledSpecGeneration: 1 },
    });
    const svc = makeService([drifted], async () => {
      throw new Error('boom');
    });
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    const r = await runReconciler(h);
    expect((r.metadata as { failed: number }).failed).toBe(1);
    const out = r.outputPayload as { errors: { instanceId: string; error: string }[] };
    expect(out.errors[0].error).toBe('boom');
  });

  it('passes tenantId filter to list', async () => {
    const svc = makeService([]);
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    await runReconciler(h, { tenantId: 'tnt_9' });
    expect(svc.list).toHaveBeenCalledWith('tnt_9');
  });

  it('honors failureThreshold param', async () => {
    const drifted = makeInstance({
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 2,
      runtime: { reconciledSpecGeneration: 1 },
    });
    const svc = makeService([drifted]);
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    await runReconciler(h, { failureThreshold: 5 });
    expect(svc.reconcile).toHaveBeenCalledWith(expect.any(String), { failureThreshold: 5 });
  });

  it('processes mixed batch: noop + reconciled + failed', async () => {
    const a = makeInstance({
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      runtime: { reconciledSpecGeneration: 0 },
    });
    const b = makeInstance({
      id: 'b',
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 1,
      runtime: { reconciledSpecGeneration: 0 },
    });
    const c = makeInstance({
      id: 'c',
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 1,
      runtime: { reconciledSpecGeneration: 0 },
    });
    const svc = makeService([a, b, c], async (id) => {
      if (id === 'c') throw new Error('c-fail');
      return makeInstance();
    });
    const h = new SystemJobHandler();
    registerInstanceReconciler(h, svc);
    const r = await runReconciler(h);
    expect((r.metadata as { noop: number }).noop).toBe(1);
    expect((r.metadata as { reconciled: number }).reconciled).toBe(1);
    expect((r.metadata as { failed: number }).failed).toBe(1);
  });
});
