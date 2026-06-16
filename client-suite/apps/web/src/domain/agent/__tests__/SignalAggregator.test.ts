import { describe, it, expect } from 'vitest';
import { SignalAggregator } from '../SignalAggregator';
import { DecisionRequest } from '../DecisionRequest';
import { AgentTask } from '../AgentTask';
import { UserGoal } from '../UserGoal';

describe('SignalAggregator', () => {
  describe('fromDecisionRequest', () => {
    it('converts a pending decision to an active signal', () => {
      const dr = DecisionRequest.create({
        id: 'dr-1',
        agentId: 'ops',
        title: 'API 延迟',
        context: 'P99 升至 500ms',
        recommendation: {
          id: 'r1',
          label: '扩容',
          description: '',
          reasoning: '',
          estimatedImpact: '',
          riskLevel: 'low',
        },
        alternatives: [],
        urgency: 'critical',
        deadline: Date.now() + 3600_000,
        responseStatus: 'pending',
        createdAt: Date.now(),
        impactScope: 3,
      });

      const sig = SignalAggregator.fromDecisionRequest(dr);
      expect(sig.source).toBe('decision');
      expect(sig.urgency).toBe('critical');
      expect(sig.status).toBe('active');
      expect(sig.impactScope).toBe(3);
      expect(sig.payload.entityId).toBe('dr-1');
      expect(sig.payload.title).toBe('API 延迟');
    });

    it('marks resolved decisions as resolved signals', () => {
      const dr = DecisionRequest.create({
        id: 'dr-2',
        agentId: 'ops',
        title: 'Done',
        context: '',
        recommendation: {
          id: 'r1',
          label: 'X',
          description: '',
          reasoning: '',
          estimatedImpact: '',
          riskLevel: 'low',
        },
        alternatives: [],
        urgency: 'normal',
        deadline: Date.now() + 3600_000,
        responseStatus: 'accepted',
        createdAt: Date.now(),
      });

      const sig = SignalAggregator.fromDecisionRequest(dr);
      expect(sig.status).toBe('resolved');
    });
  });

  describe('fromTaskException', () => {
    it('converts a failed task to a high urgency signal', () => {
      const task = AgentTask.create({
        id: 'task-1',
        agentId: 'dev',
        todoId: 'todo-1',
        name: '部署失败',
        status: 'failed',
        progress: 50,
        subtasks: [],
        logs: [],
        color: '#FF3B30',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const sig = SignalAggregator.fromTaskException(task, '超时');
      expect(sig.source).toBe('task-exception');
      expect(sig.urgency).toBe('high');
      expect(sig.payload.title).toContain('部署失败');
      expect(sig.payload.detail).toBe('超时');
    });
  });

  describe('fromGoalOverdue', () => {
    it('converts an overdue goal to a signal', () => {
      const goal = UserGoal.create({
        id: 'g-1',
        title: '营收翻倍',
        description: '',
        priority: 'critical',
        status: 'active',
        deadline: Date.now() - 86400_000,
        milestones: [{ id: 'm1', name: '第一阶段', status: 'completed', relatedTaskIds: [] }],
        progressUpdates: [],
        relatedTaskIds: ['t1', 't2', 't3'],
        relatedDecisionIds: [],
        createdAt: Date.now() - 1000000,
        updatedAt: Date.now(),
      });

      const sig = SignalAggregator.fromGoalOverdue(goal);
      expect(sig.source).toBe('goal-alert');
      expect(sig.urgency).toBe('critical');
      expect(sig.impactScope).toBe(3);
      expect(sig.payload.title).toContain('营收翻倍');
    });
  });

  describe('fromNotification', () => {
    it('converts a raw notification to a signal with defaults', () => {
      const sig = SignalAggregator.fromNotification({ id: 'n-1', title: '新消息' });
      expect(sig.source).toBe('notification');
      expect(sig.urgency).toBe('normal');
      expect(sig.payload.entityType).toBe('Notification');
    });
  });

  describe('aggregate', () => {
    it('combines multiple sources into a flat signal array', () => {
      const dr = DecisionRequest.create({
        id: 'dr-1',
        agentId: 'ops',
        title: 'DR',
        context: '',
        recommendation: {
          id: 'r1',
          label: 'X',
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
      });

      const task = AgentTask.create({
        id: 'task-1',
        agentId: 'dev',
        todoId: 'todo-1',
        name: 'Failed',
        status: 'failed',
        progress: 0,
        subtasks: [],
        logs: [],
        color: '#FF3B30',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const signals = SignalAggregator.aggregate({
        decisions: [dr],
        failedTasks: [{ task, reason: 'timeout' }],
        notifications: [{ id: 'n-1', title: 'Msg' }],
      });

      expect(signals).toHaveLength(3);
      expect(signals.map((s) => s.source)).toContain('decision');
      expect(signals.map((s) => s.source)).toContain('task-exception');
      expect(signals.map((s) => s.source)).toContain('notification');
    });

    it('filters out non-pending decisions', () => {
      const dr = DecisionRequest.create({
        id: 'dr-done',
        agentId: 'ops',
        title: 'Done',
        context: '',
        recommendation: {
          id: 'r1',
          label: 'X',
          description: '',
          reasoning: '',
          estimatedImpact: '',
          riskLevel: 'low',
        },
        alternatives: [],
        urgency: 'normal',
        deadline: Date.now() + 3600_000,
        responseStatus: 'accepted',
        createdAt: Date.now(),
      });

      const signals = SignalAggregator.aggregate({ decisions: [dr] });
      expect(signals).toHaveLength(0);
    });
  });
});
