import {
  AgentRuntimeAdapterRegistry,
  type IAgentRuntimeAdapter,
  type AgentTaskInput,
  type AgentTaskStatus,
  type AgentTaskResult,
  type AgentCapability,
} from './agent-runtime-adapter.js';

function makeTask(overrides: Partial<AgentTaskInput> = {}): AgentTaskInput {
  return {
    id: 'task-1',
    tenantId: 'tn_demo',
    name: 'do-work',
    description: 'test',
    priority: 'normal',
    input: {},
    ...overrides,
  };
}

/** 构造一个可控的 stub adapter，按 framework 区分 */
function makeAdapter(
  framework: IAgentRuntimeAdapter['framework'],
  opts: {
    submitTask?: (t: AgentTaskInput) => Promise<{ taskId: string; accepted: boolean }>;
    health?: () => Promise<{ healthy: boolean; latencyMs: number }>;
    healthThrows?: boolean;
  } = {},
): IAgentRuntimeAdapter {
  const version = '1.0.0';
  return {
    framework,
    version,
    submitTask:
      opts.submitTask ??
      (async (t) => ({ taskId: `${framework}-${t.id}`, accepted: true })),
    async getTaskStatus(taskId: string): Promise<AgentTaskStatus> {
      return {
        taskId,
        state: 'completed',
        progress: 100,
        lastUpdatedAt: new Date('2025-01-01T00:00:00Z'),
      };
    },
    async cancelTask(): Promise<{ cancelled: boolean }> {
      return { cancelled: true };
    },
    onTaskComplete(_cb: (result: AgentTaskResult) => void): () => void {
      return () => {};
    },
    async listCapabilities(): Promise<AgentCapability[]> {
      return [];
    },
    healthCheck:
      opts.health ??
      (async () => {
        if (opts.healthThrows) throw new Error('boom');
        return { healthy: true, latencyMs: 10 };
      }),
  };
}

describe('AgentRuntimeAdapterRegistry - register/unregister/get/listRegistered', () => {
  it('register + get returns the same adapter instance', () => {
    const reg = new AgentRuntimeAdapterRegistry();
    const a = makeAdapter('dify');
    reg.register(a);
    expect(reg.get('dify')).toBe(a);
  });

  it('get returns undefined for unregistered framework', () => {
    const reg = new AgentRuntimeAdapterRegistry();
    expect(reg.get('openclaw')).toBeUndefined();
  });

  it('register overwrites previous adapter of same framework', () => {
    const reg = new AgentRuntimeAdapterRegistry();
    const a1 = makeAdapter('coze');
    const a2 = makeAdapter('coze');
    reg.register(a1);
    reg.register(a2);
    expect(reg.get('coze')).toBe(a2);
  });

  it('unregister removes adapter', () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(makeAdapter('langchain'));
    reg.unregister('langchain');
    expect(reg.get('langchain')).toBeUndefined();
    expect(reg.listRegistered()).toEqual([]);
  });

  it('unregister on missing framework is a no-op', () => {
    const reg = new AgentRuntimeAdapterRegistry();
    expect(() => reg.unregister('custom')).not.toThrow();
  });

  it('listRegistered returns registered frameworks', () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(makeAdapter('dify'));
    reg.register(makeAdapter('coze'));
    expect(reg.listRegistered().sort()).toEqual(['coze', 'dify']);
  });

  it('listRegistered empty by default', () => {
    expect(new AgentRuntimeAdapterRegistry().listRegistered()).toEqual([]);
  });
});

describe('AgentRuntimeAdapterRegistry - dispatchTask', () => {
  it('dispatches via preferred framework when registered', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    const dify = makeAdapter('dify');
    const coze = makeAdapter('coze');
    reg.register(dify);
    reg.register(coze);
    const res = await reg.dispatchTask(makeTask(), 'dify');
    expect(res.framework).toBe('dify');
    expect(res.taskId).toBe('dify-task-1');
  });

  it('falls back to selectBestAdapter when no preference', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    const submitted: string[] = [];
    const dify = makeAdapter('dify', {
      submitTask: async (t) => {
        submitted.push(t.id);
        return { taskId: 'x', accepted: true };
      },
    });
    reg.register(dify);
    const res = await reg.dispatchTask(makeTask({ id: 'abc' }));
    expect(res.framework).toBe('dify');
    expect(submitted).toEqual(['abc']);
  });

  it('selectBestAdapter picks first registered when multiple present (insertion order)', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(makeAdapter('dify'));
    reg.register(makeAdapter('coze'));
    const res = await reg.dispatchTask(makeTask());
    expect(res.framework).toBe('dify');
  });

  it('throws when preferred framework not registered', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    await expect(reg.dispatchTask(makeTask(), 'dify')).rejects.toThrow(
      'Agent framework "dify" not registered',
    );
  });

  it('throws when no adapters registered and no preference', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    await expect(reg.dispatchTask(makeTask())).rejects.toThrow(
      'No agent runtime adapter available',
    );
  });

  it('passes task through to adapter.submitTask unchanged', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    let captured: AgentTaskInput | null = null;
    reg.register(
      makeAdapter('dify', {
        submitTask: async (t) => {
          captured = t;
          return { taskId: 'tid', accepted: true };
        },
      }),
    );
    const task = makeTask({ id: 't9', name: 'special' });
    await reg.dispatchTask(task);
    expect(captured).toEqual(task);
  });

  it('returns taskId from adapter result (not derived)', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(
      makeAdapter('dify', {
        submitTask: async () => ({ taskId: 'custom-id', accepted: true }),
      }),
    );
    const res = await reg.dispatchTask(makeTask());
    expect(res.taskId).toBe('custom-id');
  });
});

describe('AgentRuntimeAdapterRegistry - healthCheckAll', () => {
  it('returns empty when no adapters', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    expect(await reg.healthCheckAll()).toEqual([]);
  });

  it('aggregates healthy status across adapters', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(makeAdapter('dify', { health: async () => ({ healthy: true, latencyMs: 5 }) }));
    reg.register(makeAdapter('coze', { health: async () => ({ healthy: false, latencyMs: 99 }) }));
    const res = await reg.healthCheckAll();
    expect(res).toHaveLength(2);
    const byFw = Object.fromEntries(res.map((r) => [r.framework, r]));
    expect(byFw.dify).toEqual({ framework: 'dify', healthy: true, latencyMs: 5 });
    expect(byFw.coze).toEqual({ framework: 'coze', healthy: false, latencyMs: 99 });
  });

  it('reports unhealthy with latencyMs -1 when adapter throws', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(makeAdapter('langchain', { healthThrows: true }));
    const res = await reg.healthCheckAll();
    expect(res).toEqual([{ framework: 'langchain', healthy: false, latencyMs: -1 }]);
  });

  it('continues even when one adapter throws', async () => {
    const reg = new AgentRuntimeAdapterRegistry();
    reg.register(makeAdapter('dify', { healthThrows: true }));
    reg.register(makeAdapter('coze', { health: async () => ({ healthy: true, latencyMs: 1 }) }));
    const res = await reg.healthCheckAll();
    expect(res).toHaveLength(2);
    expect(res.find((r) => r.framework === 'dify')?.healthy).toBe(false);
    expect(res.find((r) => r.framework === 'coze')?.healthy).toBe(true);
  });
});
