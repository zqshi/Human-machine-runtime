import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentSimulator, type AgentSimulatorStores, type IMapStore } from './agent-simulator.js';

function createMapStore<V>(): IMapStore<V> & { size(): number } {
  const map = new Map<string, V>();
  return {
    get: (k: string) => map.get(k),
    set: (k: string, v: V) => {
      map.set(k, v);
    },
    values: () => map.values(),
    entries: () => map.entries(),
    size: () => map.size,
  };
}

function makeStores(): AgentSimulatorStores & {
  decisions: ReturnType<typeof createMapStore>;
  tasks: ReturnType<typeof createMapStore>;
  goals: ReturnType<typeof createMapStore>;
} {
  return {
    decisions: createMapStore(),
    tasks: createMapStore(),
    goals: createMapStore(),
    judgments: createMapStore(),
    workOrders: createMapStore(),
  };
}

describe('AgentSimulator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('seeds tasks on start', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    expect(stores.tasks.size()).toBe(5);
    const secScan = stores.tasks.get('task-sec-scan');
    expect(secScan).toBeDefined();
    expect(secScan!.name).toBe('安全漏洞巡检');
    expect(secScan!.status).toBe('running');
    sim.stop();
  });

  it('seeds goals on start', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    expect(stores.goals.size()).toBe(2);
    const secGoal = stores.goals.get('goal-security');
    expect(secGoal).toBeDefined();
    expect(secGoal!.title).toBe('完成 Q2 安全加固');
    expect(secGoal!.milestones.length).toBe(3);
    sim.stop();
  });

  it('seeds at least one pending decision on start', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    expect(stores.decisions.size()).toBeGreaterThanOrEqual(1);
    const decisions = Array.from(stores.decisions.values());
    expect(decisions[0].responseStatus).toBe('pending');
    sim.stop();
  });

  it('seeded decision has required fields', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    const dec = Array.from(stores.decisions.values())[0];
    expect(dec.id).toBeDefined();
    expect(dec.agentId).toBeDefined();
    expect(dec.title).toBeDefined();
    expect(dec.recommendation).toBeDefined();
    expect(dec.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(dec.deadline).toBeGreaterThan(Date.now() - 1000);
    sim.stop();
  });

  it('stop clears all timers', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    sim.stop();
  });

  it('exposes judgmentStore and workOrderStore accessors', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    expect(sim.judgmentStore).toBeDefined();
    expect(sim.workOrderStore).toBeDefined();
  });

  it('creates workOrderStore when not provided', () => {
    const stores = {
      decisions: createMapStore(),
      tasks: createMapStore(),
      goals: createMapStore(),
      judgments: createMapStore(),
    };
    const sim = new AgentSimulator(stores, vi.fn());
    expect(sim.workOrderStore).toBeDefined();
  });

  it('seeded tasks cover expected agent ids', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    const agents = new Set(Array.from(stores.tasks.values()).map((t: any) => t.agentId));
    expect(agents.has('security-agent')).toBe(true);
    expect(agents.has('data-analyst')).toBe(true);
    expect(agents.has('ops-assistant')).toBe(true);
    expect(agents.has('dev-assistant')).toBe(true);
    sim.stop();
  });

  it('seeded goals have constraints and authorization', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    const perfGoal = stores.goals.get('goal-performance');
    expect(perfGoal).toBeDefined();
    expect(perfGoal!.constraints.length).toBeGreaterThan(0);
    expect(perfGoal!.authorization.autoExecute.length).toBeGreaterThan(0);
    expect(perfGoal!.successCriteria.length).toBeGreaterThan(0);
    sim.stop();
  });

  it('seeded goals have success criteria with currentValue', () => {
    const stores = makeStores();
    const sim = new AgentSimulator(stores, vi.fn());
    sim.start();
    const secGoal = stores.goals.get('goal-security');
    expect(secGoal!.successCriteria.every((sc: any) => sc.currentValue !== undefined)).toBe(true);
    sim.stop();
  });
});
