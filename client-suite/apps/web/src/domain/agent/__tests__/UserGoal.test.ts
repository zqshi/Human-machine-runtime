import { describe, it, expect } from 'vitest';
import { UserGoal } from '../UserGoal';
import type { UserGoalProps, GoalMilestone } from '../UserGoal';

function makeProps(overrides?: Partial<UserGoalProps>): UserGoalProps {
  return {
    id: 'goal-1',
    title: 'Q2 安全加固',
    description: '完成所有高危漏洞修复',
    priority: 'high',
    status: 'active',
    deadline: Date.now() + 86_400_000,
    milestones: [
      { id: 'ms-1', name: '高危修复', status: 'completed', completedAt: 1000, relatedTaskIds: [] },
      { id: 'ms-2', name: '中危修复', status: 'active', relatedTaskIds: ['task-1'] },
      { id: 'ms-3', name: '验证', status: 'pending', relatedTaskIds: [] },
    ],
    progressUpdates: [],
    relatedTaskIds: ['task-1'],
    relatedDecisionIds: [],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('UserGoal', () => {
  it('creates from props', () => {
    const goal = UserGoal.create(makeProps());
    expect(goal.id).toBe('goal-1');
    expect(goal.title).toBe('Q2 安全加固');
    expect(goal.milestones).toHaveLength(3);
  });

  it('overallProgress calculates from milestones', () => {
    const goal = UserGoal.create(makeProps());
    expect(goal.overallProgress).toBe(33);
  });

  it('overallProgress is 0 with no milestones', () => {
    const goal = UserGoal.create(makeProps({ milestones: [] }));
    expect(goal.overallProgress).toBe(0);
  });

  it('isOverdue detects expired deadline', () => {
    const goal = UserGoal.create(makeProps({ deadline: Date.now() - 1000 }));
    expect(goal.isOverdue).toBe(true);
  });

  it('isOverdue is false when no deadline', () => {
    const goal = UserGoal.create(makeProps({ deadline: undefined }));
    expect(goal.isOverdue).toBe(false);
  });

  it('isOverdue is false when completed', () => {
    const goal = UserGoal.create(makeProps({ deadline: Date.now() - 1000, status: 'completed' }));
    expect(goal.isOverdue).toBe(false);
  });

  it('activeMilestone returns the active one', () => {
    const goal = UserGoal.create(makeProps());
    expect(goal.activeMilestone?.id).toBe('ms-2');
  });

  it('addProgressUpdate appends update', () => {
    const goal = UserGoal.create(makeProps());
    const updated = goal.addProgressUpdate('ops-bot', '进度 80%');
    expect(updated.progressUpdates).toHaveLength(1);
    expect(updated.progressUpdates[0].message).toBe('进度 80%');
  });

  it('completeMilestone marks done and activates next', () => {
    const goal = UserGoal.create(makeProps());
    const updated = goal.completeMilestone('ms-2');
    expect(updated.milestones[1].status).toBe('completed');
    expect(updated.milestones[2].status).toBe('active');
  });

  it('completeMilestone auto-completes goal when all done', () => {
    const milestones: GoalMilestone[] = [
      { id: 'ms-1', name: 'A', status: 'completed', completedAt: 1000, relatedTaskIds: [] },
      { id: 'ms-2', name: 'B', status: 'active', relatedTaskIds: [] },
    ];
    const goal = UserGoal.create(makeProps({ milestones }));
    const updated = goal.completeMilestone('ms-2');
    expect(updated.status).toBe('completed');
  });

  it('updateStatus changes status immutably', () => {
    const goal = UserGoal.create(makeProps());
    const paused = goal.updateStatus('paused');
    expect(paused.status).toBe('paused');
    expect(goal.status).toBe('active');
  });

  it('linkTask adds new task id', () => {
    const goal = UserGoal.create(makeProps({ relatedTaskIds: [] }));
    const linked = goal.linkTask('task-x');
    expect(linked.relatedTaskIds).toContain('task-x');
  });

  it('linkTask is idempotent', () => {
    const goal = UserGoal.create(makeProps({ relatedTaskIds: ['task-1'] }));
    const linked = goal.linkTask('task-1');
    expect(linked.relatedTaskIds).toHaveLength(1);
  });

  it('linkDecision adds new decision id', () => {
    const goal = UserGoal.create(makeProps({ relatedDecisionIds: [] }));
    const linked = goal.linkDecision('dec-1');
    expect(linked.relatedDecisionIds).toContain('dec-1');
  });
});
