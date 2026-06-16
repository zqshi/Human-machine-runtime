import { describe, it, expect } from 'vitest';
import { CorrectionPropagator, type CorrectionPlan } from '../CorrectionPropagator';
import { DecisionRequest } from '../DecisionRequest';
import { AgentTask } from '../AgentTask';
import { UserGoal } from '../UserGoal';
import { CollaborationChain } from '../CollaborationChain';

function makeDecision(overrides: Partial<Parameters<typeof DecisionRequest.create>[0]> = {}) {
  return DecisionRequest.create({
    id: 'dr-001',
    agentId: 'agent-alpha',
    title: '紧急扩容',
    context: 'CPU 超标',
    recommendation: {
      id: 'opt-1',
      label: '扩容',
      description: '',
      reasoning: '',
      estimatedImpact: '',
      riskLevel: 'low',
    },
    alternatives: [],
    urgency: 'high',
    deadline: Date.now() + 3600_000,
    responseStatus: 'pending',
    createdAt: Date.now(),
    relatedTaskIds: ['task-1'],
    downstreamTaskIds: ['task-2', 'task-3'],
    downstreamGoalIds: ['goal-1'],
    ...overrides,
  });
}

function makeTask(id: string, agentId = 'agent-alpha') {
  return AgentTask.create({
    id,
    agentId,
    todoId: `todo-${id}`,
    name: `Task ${id}`,
    status: 'running',
    progress: 50,
    subtasks: [],
    logs: [],
    color: '#007AFF',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function makeGoal(id: string, relatedTaskIds: string[] = []) {
  return UserGoal.create({
    id,
    title: `Goal ${id}`,
    description: 'Test goal',
    priority: 'normal',
    status: 'active',
    milestones: [],
    progressUpdates: [],
    relatedTaskIds,
    relatedDecisionIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function makeChain(id: string, nodeAgentIds: string[] = ['agent-alpha']) {
  return CollaborationChain.create({
    id,
    name: `Chain ${id}`,
    description: 'Test chain',
    nodes: nodeAgentIds.map((agentId, i) => ({
      id: `node-${i}`,
      agentId,
      agentName: agentId,
      agentCategory: 'general',
      taskSummary: 'Some task',
      status: i === 0 ? ('active' as const) : ('pending' as const),
      startedAt: Date.now(),
    })),
    edges:
      nodeAgentIds.length > 1
        ? [{ fromNodeId: 'node-0', toNodeId: 'node-1', label: 'handoff' }]
        : [],
    triggeredAt: Date.now(),
    status: 'running',
  });
}

describe('CorrectionPropagator', () => {
  it('computes correction plan for accepted decision with downstream tasks', () => {
    const decision = makeDecision().accept();
    const tasks = [makeTask('task-1'), makeTask('task-2'), makeTask('task-3')];
    const goals = [makeGoal('goal-1', ['task-2'])];
    const chains: CollaborationChain[] = [];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    expect(plan.decisionId).toBe('dr-001');
    expect(plan.affectedTasks).toHaveLength(2);
    expect(plan.affectedTasks.map((t) => t.taskId)).toContain('task-2');
    expect(plan.affectedTasks.map((t) => t.taskId)).toContain('task-3');
    expect(plan.affectedGoals).toHaveLength(1);
    expect(plan.affectedGoals[0].goalId).toBe('goal-1');
  });

  it('suggests re-evaluate for modified decisions', () => {
    const decision = makeDecision().modify('opt-1', '需要调整方案');
    const tasks = [makeTask('task-2')];
    const goals: UserGoal[] = [];
    const chains: CollaborationChain[] = [];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    expect(plan.affectedTasks[0].suggestedAction).toBe('re-evaluate');
  });

  it('suggests pause for declined decisions', () => {
    const decision = makeDecision().decline('不需要');
    const tasks = [makeTask('task-2')];
    const goals: UserGoal[] = [];
    const chains: CollaborationChain[] = [];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    expect(plan.affectedTasks[0].suggestedAction).toBe('pause');
  });

  it('suggests continue for accepted decisions', () => {
    const decision = makeDecision().accept();
    const tasks = [makeTask('task-2')];
    const goals: UserGoal[] = [];
    const chains: CollaborationChain[] = [];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    expect(plan.affectedTasks[0].suggestedAction).toBe('continue');
  });

  it('returns empty plan when no downstream entities exist', () => {
    const decision = makeDecision({
      downstreamTaskIds: [],
      downstreamGoalIds: [],
      relatedTaskIds: [],
    }).accept();

    const plan = CorrectionPropagator.computePlan(decision, [], [], []);

    expect(plan.affectedTasks).toHaveLength(0);
    expect(plan.affectedGoals).toHaveLength(0);
    expect(plan.affectedChainNodes).toHaveLength(0);
  });

  it('finds affected chain nodes by agent ID', () => {
    const decision = makeDecision({ agentId: 'agent-alpha' }).accept();
    const tasks: AgentTask[] = [];
    const goals: UserGoal[] = [];
    const chains = [makeChain('chain-1', ['agent-alpha', 'agent-beta'])];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    expect(plan.affectedChainNodes.length).toBeGreaterThanOrEqual(1);
    expect(plan.affectedChainNodes[0].chainId).toBe('chain-1');
  });

  it('discovers goals linked to downstream tasks', () => {
    const decision = makeDecision({
      downstreamTaskIds: ['task-5'],
      downstreamGoalIds: [],
    }).accept();
    const tasks = [makeTask('task-5')];
    const goals = [makeGoal('goal-linked', ['task-5'])];
    const chains: CollaborationChain[] = [];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    expect(plan.affectedGoals).toHaveLength(1);
    expect(plan.affectedGoals[0].goalId).toBe('goal-linked');
  });

  it('does not produce duplicates in affected goals', () => {
    const decision = makeDecision({
      downstreamTaskIds: ['task-2'],
      downstreamGoalIds: ['goal-1'],
    }).accept();
    const tasks = [makeTask('task-2')];
    const goals = [makeGoal('goal-1', ['task-2'])];
    const chains: CollaborationChain[] = [];

    const plan = CorrectionPropagator.computePlan(decision, tasks, goals, chains);

    const goalIds = plan.affectedGoals.map((g) => g.goalId);
    expect(new Set(goalIds).size).toBe(goalIds.length);
  });
});
