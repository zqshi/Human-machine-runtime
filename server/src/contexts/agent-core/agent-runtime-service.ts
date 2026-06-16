import {
  AgentSimulator,
  type AgentSimulatorStores,
  type IMapStore,
  type Decision,
  type SimTask,
  type Goal,
} from './domain/agent-simulator.js';
import {
  AgentExecutor,
  type AgentExecutorStores,
  type ILLMClient,
  type TaskArtifact,
} from './domain/agent-executor.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { Database } from '../../db/client.js';
import { DbMapStore } from '../../db/repositories/agent-runtime-repository.js';

function createMapStore<V>(): IMapStore<V> {
  const map = new Map<string, V>();
  return {
    get: (k: string) => map.get(k),
    set: (k: string, v: V) => {
      map.set(k, v);
    },
    values: () => map.values(),
    entries: () => map.entries(),
  };
}

export class AgentRuntimeService {
  private simulator: AgentSimulator;
  private executor: AgentExecutor;
  private started = false;
  private dbStores: DbMapStore<unknown>[] = [];
  private simulatorEnabled: boolean;

  constructor(llmClient: ILLMClient | null, db?: Database, opts?: { simulatorEnabled?: boolean }) {
    this.simulatorEnabled = opts?.simulatorEnabled ?? false;
    const broadcast = (event: string, data: unknown) => {
      appEventBus.publish(event, data as Record<string, unknown>);
    };

    let simStores: AgentSimulatorStores;
    let execStores: AgentExecutorStores;

    if (db) {
      const decisions = new DbMapStore<Decision>(db, 'agent_decision');
      const tasks = new DbMapStore<SimTask>(db, 'agent_task');
      const goals = new DbMapStore<Goal>(db, 'agent_goal');
      const judgments = new DbMapStore<unknown>(db, 'agent_judgment');
      const workOrders = new DbMapStore<unknown>(db, 'agent_work_order');
      const execTasks = new DbMapStore<TaskArtifact>(db, 'agent_exec_task');

      this.dbStores = [decisions, tasks, goals, judgments, workOrders, execTasks];
      simStores = { decisions, tasks, goals, judgments, workOrders };
      execStores = { tasks: execTasks };
    } else {
      const taskStore = createMapStore<TaskArtifact>();
      simStores = {
        decisions: createMapStore(),
        tasks: createMapStore(),
        goals: createMapStore(),
        judgments: createMapStore(),
        workOrders: createMapStore(),
      };
      execStores = { tasks: taskStore };
    }

    this.simulator = new AgentSimulator(simStores, broadcast);
    this.executor = new AgentExecutor(llmClient, execStores, broadcast);
  }

  async start(): Promise<void> {
    if (this.started) return;
    await Promise.all(this.dbStores.map((s) => s.load()));
    this.started = true;
    if (this.simulatorEnabled) {
      this.simulator.start();
    }
  }

  stop(): void {
    this.simulator.stop();
    this.started = false;
  }

  async execute(userText: string, responseText: string, sessionId: string) {
    return this.executor.execute(userText, responseText, sessionId);
  }

  isRunning(): boolean {
    return this.started;
  }
}
