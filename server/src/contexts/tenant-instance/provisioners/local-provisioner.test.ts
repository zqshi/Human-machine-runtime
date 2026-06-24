import { describe, it, expect } from 'vitest';
import { LocalProvisioner } from './local-provisioner.js';
import { createInstance, type Instance } from '../domain/instance.js';

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  const base = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
  return { ...base, ...overrides };
}

describe('LocalProvisioner', () => {
  describe('provision / teardown', () => {
    it('provision registers a running entry and returns runtime', async () => {
      const p = new LocalProvisioner();
      const inst = makeInstance();
      const rt = await p.provision(inst);
      expect(rt.engine).toBe('local');
      expect(rt.pid).toBeTypeOf('number');
      expect(rt.endpoint).toContain(inst.id);
      expect(p.getRunning().has(inst.id)).toBe(true);
    });

    it('teardown removes the running entry', async () => {
      const p = new LocalProvisioner();
      const inst = makeInstance();
      await p.provision(inst);
      await p.teardown(inst);
      expect(p.getRunning().has(inst.id)).toBe(false);
    });
  });

  describe('getRemoteStatus', () => {
    it('returns running when provisioned', async () => {
      const p = new LocalProvisioner();
      const inst = makeInstance();
      await p.provision(inst);
      const status = await p.getRemoteStatus(inst);
      expect(status?.state).toBe('running');
      expect(status?.detail?.pid).toBeTypeOf('number');
    });

    it('returns stopped when not provisioned', async () => {
      const p = new LocalProvisioner();
      const status = await p.getRemoteStatus(makeInstance());
      expect(status?.state).toBe('stopped');
    });
  });

  describe('reconcile', () => {
    it('returns full runtime with reconciledAt when running', async () => {
      const p = new LocalProvisioner();
      const inst = makeInstance();
      await p.provision(inst);
      const rt = await p.reconcile(inst);
      expect(rt.engine).toBe('local');
      expect(rt.pid).toBeTypeOf('number');
      expect(rt.reconciledAt).toBeTypeOf('string');
    });

    it('does not cold-start: returns only reconciledAt when not running', async () => {
      const p = new LocalProvisioner();
      const inst = makeInstance();
      const rt = await p.reconcile(inst);
      expect(rt.reconciledAt).toBeTypeOf('string');
      expect(rt.engine).toBeUndefined();
      expect(p.getRunning().has(inst.id)).toBe(false); // 未被 provision
    });
  });
});
