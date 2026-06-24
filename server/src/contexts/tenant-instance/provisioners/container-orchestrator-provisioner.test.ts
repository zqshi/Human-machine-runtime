import { describe, it, expect, vi } from 'vitest';
import { ContainerOrchestratorProvisioner } from './container-orchestrator-provisioner.js';
import type {
  ContainerOrchestratorClient,
  FarmInstance,
} from '../../gateway/clients/container-orchestrator-client.js';
import { createInstance, type Instance } from '../domain/instance.js';

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  const base = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
  return { ...base, ...overrides };
}

interface ClientMock {
  client: ContainerOrchestratorClient;
  getInstanceStatus: ReturnType<typeof vi.fn>;
  startInstance: ReturnType<typeof vi.fn>;
  createInstance: ReturnType<typeof vi.fn>;
  deleteInstance: ReturnType<typeof vi.fn>;
}

function makeClient(
  opts: {
    configured?: boolean;
    active?: boolean;
    failStatus?: boolean;
    failStart?: boolean;
  } = {}
): ClientMock {
  const farm: FarmInstance = {
    appKey: 't',
    userID: 'u',
    empKey: 'e',
    podName: 'p',
    status: 'OK',
    lastActive: 'now',
    employeeNumber: 1,
    name: 'n',
    isActive: opts.active ?? true,
  };
  const getInstanceStatus = vi.fn(async () => {
    if (opts.failStatus) throw new Error('status-fail');
    return farm;
  });
  const startInstance = vi.fn(async () => {
    if (opts.failStart) throw new Error('start-fail');
    return {};
  });
  const createInstance = vi.fn(async () => farm);
  const deleteInstance = vi.fn(async () => undefined);
  const client = {
    isConfigured: () => opts.configured ?? true,
    getInstanceStatus,
    startInstance,
    createInstance,
    deleteInstance,
  } as unknown as ContainerOrchestratorClient;
  return { client, getInstanceStatus, startInstance, createInstance, deleteInstance };
}

describe('ContainerOrchestratorProvisioner', () => {
  describe('getRemoteStatus', () => {
    it('returns null when gateway not configured', async () => {
      const { client } = makeClient({ configured: false });
      expect(
        await new ContainerOrchestratorProvisioner(client).getRemoteStatus(makeInstance())
      ).toBeNull();
    });

    it('maps isActive=true → running', async () => {
      const { client } = makeClient({ active: true });
      const s = await new ContainerOrchestratorProvisioner(client).getRemoteStatus(makeInstance());
      expect(s?.state).toBe('running');
    });

    it('maps isActive=false → stopped', async () => {
      const { client } = makeClient({ active: false });
      const s = await new ContainerOrchestratorProvisioner(client).getRemoteStatus(makeInstance());
      expect(s?.state).toBe('stopped');
    });

    it('returns unknown on query failure (no throw)', async () => {
      const { client } = makeClient({ failStatus: true });
      const s = await new ContainerOrchestratorProvisioner(client).getRemoteStatus(makeInstance());
      expect(s?.state).toBe('unknown');
    });
  });

  describe('reconcile', () => {
    it('throws when gateway not configured', async () => {
      const { client } = makeClient({ configured: false });
      await expect(
        new ContainerOrchestratorProvisioner(client).reconcile(makeInstance())
      ).rejects.toThrow('not configured');
    });

    it('starts instance when remote inactive', async () => {
      const mock = makeClient({ active: false });
      await new ContainerOrchestratorProvisioner(mock.client).reconcile(makeInstance());
      expect(mock.startInstance).toHaveBeenCalledTimes(1);
    });

    it('skips start when remote already running', async () => {
      const mock = makeClient({ active: true });
      await new ContainerOrchestratorProvisioner(mock.client).reconcile(makeInstance());
      expect(mock.startInstance).not.toHaveBeenCalled();
    });

    it('propagates start failure (countable for rebuild fallback)', async () => {
      const { client } = makeClient({ active: false, failStart: true });
      await expect(
        new ContainerOrchestratorProvisioner(client).reconcile(makeInstance())
      ).rejects.toThrow('start-fail');
    });

    it('returns runtime stamped with reconciledAt', async () => {
      const { client } = makeClient({ active: true });
      const inst = makeInstance({ runtime: { existing: 1 } });
      const rt = await new ContainerOrchestratorProvisioner(client).reconcile(inst);
      expect(rt.existing).toBe(1);
      expect(rt.reconciledAt).toBeTypeOf('string');
    });
  });
});
