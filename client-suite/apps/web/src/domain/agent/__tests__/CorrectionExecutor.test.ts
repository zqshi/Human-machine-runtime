import { describe, it, expect } from 'vitest';
import { CorrectionExecutor } from '../CorrectionExecutor';
import { AgentTask } from '../AgentTask';
import { UserGoal } from '../UserGoal';
import { CollaborationChain } from '../CollaborationChain';
import type { CorrectionPlan } from '../CorrectionPropagator';

function makeTask(
  id: string,
  status: 'running' | 'completed' | 'failed' | 'queued' | 'paused' = 'running'
) {
  return AgentTask.create({
    id,
    agentId: 'agent-1',
    todoId: `todo-${id}`,
    name: `Task ${id}`,
    status,
    progress: 50,
    subtasks: [],
    logs: [],
    color: '#007AFF',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function makeGoal(id: string, status: 'active' | 'paused' = 'active') {
  return UserGoal.create({
    id,
    title: `Goal ${id}`,
    description: '',
    priority: 'normal',
    status,
    milestones: [],
    progressUpdates: [],
    relatedTaskIds: [],
    relatedDecisionIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function makeChain(id: string, nodeIds: string[]) {
  return CollaborationChain.create({
    id,
    name: `Chain ${id}`,
    description: '',
    nodes: nodeIds.map((nid, i) => ({
      id: nid,
      agentId: `agent-${i}`,
      agentName: `Agent ${i}`,
      agentCategory: 'dev',
      taskSummary: `Node ${nid}`,
      status: i === 0 ? 'active' : 'pending',
      startedAt: Date.now(),
    })),
    edges: [],
    triggeredAt: Date.now(),
    status: 'running',
  });
}

describe('CorrectionExecutor', () => {
  describe('applyToTask', () => {
    it('pauses a running task on "pause" action', () => {
      const task = makeTask('t1', 'running');
      const { task: updated, log } = CorrectionExecutor.applyToTask(task, 'pause');
      expect(updated.status).toBe('paused');
      expect(log.previousStatus).toBe('running');
      expect(log.newStatus).toBe('paused');
    });

    it('keeps task unchanged on "continue" action', () => {
      const task = makeTask('t1', 'running');
      const { task: updated } = CorrectionExecutor.applyToTask(task, 'continue');
      expect(updated.status).toBe('running');
    });

    it('does not change already paused task', () => {
      const task = makeTask('t1', 'paused');
      const { task: updated } = CorrectionExecutor.applyToTask(task, 'pause');
      expect(updated.status).toBe('paused');
    });
  });

  describe('applyToGoal', () => {
    it('pauses an active goal on "pause" action', () => {
      const goal = makeGoal('g1', 'active');
      const { goal: updated, log } = CorrectionExecutor.applyToGoal(goal, 'pause');
      expect(updated.status).toBe('paused');
      expect(log.previousStatus).toBe('active');
    });

    it('pauses goal on "re-evaluate" action', () => {
      const goal = makeGoal('g1', 'active');
      const { goal: updated } = CorrectionExecutor.applyToGoal(goal, 're-evaluate');
      expect(updated.status).toBe('paused');
    });

    it('keeps goal unchanged on "continue"', () => {
      const goal = makeGoal('g1', 'active');
      const { goal: updated } = CorrectionExecutor.applyToGoal(goal, 'continue');
      expect(updated.status).toBe('active');
    });
  });

  describe('applyToChainNode', () => {
    it('sets active node to pending on "pause"', () => {
      const chain = makeChain('c1', ['n1', 'n2']);
      const { chain: updated, log } = CorrectionExecutor.applyToChainNode(chain, 'n1', 'pause');
      const node = updated.nodes.find((n) => n.id === 'n1');
      expect(node?.status).toBe('pending');
      expect(log.previousStatus).toBe('active');
      expect(log.newStatus).toBe('pending');
    });
  });

  describe('execute', () => {
    it('applies full correction plan to all affected entities', () => {
      const tasks = [makeTask('t1'), makeTask('t2')];
      const goals = [makeGoal('g1')];
      const chains = [makeChain('c1', ['n1', 'n2'])];

      const plan: CorrectionPlan = {
        decisionId: 'dr-1',
        affectedTasks: [{ taskId: 't1', taskName: 'Task t1', suggestedAction: 'pause' }],
        affectedGoals: [{ goalId: 'g1', goalTitle: 'Goal g1', suggestedAction: 're-evaluate' }],
        affectedChainNodes: [
          { chainId: 'c1', chainName: 'Chain c1', nodeId: 'n1', suggestedAction: 'pause' },
        ],
      };

      const { result, updatedTasks, updatedGoals, updatedChains } = CorrectionExecutor.execute(
        plan,
        tasks,
        goals,
        chains
      );

      expect(result.planId).toBe('dr-1');
      expect(result.tasksUpdated).toBe(1);
      expect(result.goalsUpdated).toBe(1);
      expect(result.chainsUpdated).toBe(1);
      expect(result.actions).toHaveLength(3);

      expect(updatedTasks[0].status).toBe('paused');
      expect(updatedTasks[1].status).toBe('running');
      expect(updatedGoals[0].status).toBe('paused');
      const node = updatedChains[0].nodes.find((n) => n.id === 'n1');
      expect(node?.status).toBe('pending');
    });

    it('skips missing entities without crashing', () => {
      const plan: CorrectionPlan = {
        decisionId: 'dr-2',
        affectedTasks: [{ taskId: 'nonexist', taskName: 'X', suggestedAction: 'pause' }],
        affectedGoals: [],
        affectedChainNodes: [],
      };

      const { result } = CorrectionExecutor.execute(plan, [], [], []);
      expect(result.actions).toHaveLength(0);
    });
  });
});
