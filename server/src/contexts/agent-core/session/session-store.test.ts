import { describe, it, expect } from 'vitest';
import { SessionStore } from './session-store.js';
import type { Decision } from './domain/decision.js';
import type { TaskArtifact } from '../domain/agent-executor.js';

/**
 * SessionStore 单测聚焦"纯逻辑路径":recordDecision / recordTaskArtifact 写 cache,
 * getDecision / getTaskArtifact / listRecentDecisions 从 cache 读。
 *
 * DB load / rawListByEntityType 依赖真实 drizzle 查询链,在单测里用最小 mock DB 跳过
 * (load 在未调时不会读 DB;rawListByEntityType 不在核心覆盖范围)。
 */
function makeMockDb(): unknown {
  return {
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          execute: () => Promise.resolve(),
          returning: () => Promise.resolve([]),
        }),
      }),
    }),
  };
}

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'dec-1',
    agentId: 'agent-1',
    title: 't',
    context: 'c',
    recommendation: {
      id: 'opt-1',
      label: 'l',
      description: 'd',
      reasoning: 'r',
      estimatedImpact: 'low',
      riskLevel: 'low',
    },
    alternatives: [],
    urgency: 'normal',
    deadline: Date.now() + 60_000,
    responseStatus: 'pending',
    userResponse: null,
    responseAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    impactScope: 1,
    downstreamTaskIds: [],
    downstreamGoalIds: [],
    ...overrides,
  };
}

describe('SessionStore', () => {
  it('recordDecision 写入 cache + 可被 getDecision 取回', () => {
    const store = new SessionStore(makeMockDb() as never);
    const dec = makeDecision();
    store.recordDecision(dec);
    expect(store.getDecision('dec-1')).toBe(dec);
  });

  it('recordTaskArtifact 写入 cache + 可被 getTaskArtifact 取回', () => {
    const store = new SessionStore(makeMockDb() as never);
    const artifact: TaskArtifact = {
      id: 'task-1',
      agentId: 'agent-1',
      todoId: 'todo-1',
      name: 'task',
      status: 'running',
      progress: 0,
      subtasks: [],
      logs: [],
      color: '#000',
      createdAt: 1000,
      updatedAt: 1000,
    };
    store.recordTaskArtifact(artifact);
    expect(store.getTaskArtifact('task-1')).toBe(artifact);
  });

  it('listRecentDecisions 按 createdAt 倒序取前 N 条', () => {
    const store = new SessionStore(makeMockDb() as never);
    store.recordDecision(makeDecision({ id: 'old', createdAt: 1000 }));
    store.recordDecision(makeDecision({ id: 'new', createdAt: 5000 }));
    store.recordDecision(makeDecision({ id: 'mid', createdAt: 3000 }));

    const list = store.listRecentDecisions(2);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe('new');
    expect(list[1]!.id).toBe('mid');
  });

  it('listRecentDecisions 默认 limit=10', () => {
    const store = new SessionStore(makeMockDb() as never);
    for (let i = 0; i < 15; i++) {
      store.recordDecision(makeDecision({ id: `d-${i}`, createdAt: i }));
    }
    const list = store.listRecentDecisions();
    expect(list).toHaveLength(10);
    expect(list[0]!.id).toBe('d-14');
  });

  it('decisionStore / taskArtifactStore 暴露 IMapStore 接口供 executor 复用', () => {
    const store = new SessionStore(makeMockDb() as never);
    expect(typeof store.decisionStore.get).toBe('function');
    expect(typeof store.decisionStore.set).toBe('function');
    expect(typeof store.taskArtifactStore.get).toBe('function');
    expect(typeof store.taskArtifactStore.set).toBe('function');
  });
});
