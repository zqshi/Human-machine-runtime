import { describe, it, expect, vi } from 'vitest';
import { CompositeProvisioner } from './composite-provisioner.js';
import type { IInstanceProvisioner, InstanceRemoteStatus } from '../instance-service.js';
import { createInstance, type Instance } from '../domain/instance.js';

function makeInstance(): Instance {
  return createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
}

function makeStub(overrides: Partial<IInstanceProvisioner> = {}): IInstanceProvisioner {
  return {
    provision: vi.fn(async () => ({ a: 1 })),
    teardown: vi.fn(async () => {}),
    reconcile: vi.fn(async () => ({ reconciled: true })),
    getRemoteStatus: vi.fn(async () => null),
    ...overrides,
  };
}

describe('CompositeProvisioner', () => {
  it('provision merges results from all children', async () => {
    const a = makeStub({ provision: vi.fn(async () => ({ a: 1 })) });
    const b = makeStub({ provision: vi.fn(async () => ({ b: 2 })) });
    const c = new CompositeProvisioner([a, b]);
    expect(await c.provision(makeInstance())).toEqual({ a: 1, b: 2 });
  });

  it('provision fails fast if any child fails (no partial RUNNING)', async () => {
    const a = makeStub();
    const b = makeStub({ provision: vi.fn(async () => Promise.reject(new Error('boom'))) });
    const c = new CompositeProvisioner([a, b]);
    await expect(c.provision(makeInstance())).rejects.toThrow('boom');
  });

  it('reconcile merges results from all children', async () => {
    const a = makeStub({ reconcile: vi.fn(async () => ({ a: 'r' })) });
    const b = makeStub({ reconcile: vi.fn(async () => ({ b: 'r' })) });
    const c = new CompositeProvisioner([a, b]);
    expect(await c.reconcile(makeInstance())).toEqual({ a: 'r', b: 'r' });
  });

  it('reconcile fails if any child fails (countable for rebuild fallback)', async () => {
    const a = makeStub();
    const b = makeStub({
      reconcile: vi.fn(async () => Promise.reject(new Error('reconcile-fail'))),
    });
    const c = new CompositeProvisioner([a, b]);
    await expect(c.reconcile(makeInstance())).rejects.toThrow('reconcile-fail');
  });

  it('getRemoteStatus returns first non-null child status', async () => {
    const running: InstanceRemoteStatus = { state: 'running' };
    const a = makeStub({ getRemoteStatus: vi.fn(async () => null) });
    const b = makeStub({ getRemoteStatus: vi.fn(async () => running) });
    const c = new CompositeProvisioner([a, b]);
    expect(await c.getRemoteStatus(makeInstance())).toEqual(running);
  });

  it('getRemoteStatus returns null when all children return null', async () => {
    const a = makeStub({ getRemoteStatus: vi.fn(async () => null) });
    const c = new CompositeProvisioner([a]);
    expect(await c.getRemoteStatus(makeInstance())).toBeNull();
  });

  it('teardown is best-effort: succeeds unless ALL children fail', async () => {
    const a = makeStub({ teardown: vi.fn(async () => Promise.reject(new Error('a'))) });
    const b = makeStub({ teardown: vi.fn(async () => undefined) });
    const c = new CompositeProvisioner([a, b]);
    await expect(c.teardown(makeInstance())).resolves.toBeUndefined();
  });

  it('teardown fails only when every child fails', async () => {
    const a = makeStub({ teardown: vi.fn(async () => Promise.reject(new Error('a'))) });
    const b = makeStub({ teardown: vi.fn(async () => Promise.reject(new Error('b'))) });
    const c = new CompositeProvisioner([a, b]);
    await expect(c.teardown(makeInstance())).rejects.toThrow();
  });
});
