import { describe, it, expect } from 'vitest';
import { createCollaborationTrigger, createMilestoneTrigger } from '../DecisionTriggerFactories';
import type { CollaborationNodeContext, MilestoneContext } from '../DecisionTriggerFactories';

const collabCtx: CollaborationNodeContext = {
  collaborationId: 'collab-1',
  collaborationName: '代码审查链',
  nodeId: 'node-1',
  nodeName: '技术评审',
  requesterId: 'user-a',
  requesterName: 'Alice',
  nodeType: 'approval',
  changeSummary: '修改了认证模块',
  requiresApproval: true,
  approvers: ['user-b'],
  currentApprover: 'user-b',
  estimatedDelayIfRejected: 3600000,
  hasConflictingChanges: false,
};

const milestoneCtx: MilestoneContext = {
  goalId: 'goal-1',
  goalTitle: 'Q2 交付',
  milestoneId: 'ms-1',
  milestoneName: 'Alpha 发布',
  milestoneIndex: 1,
  totalMilestones: 4,
  completedMilestones: 2,
  hasBlockingIssue: false,
  estimatedTimeToComplete: 86400000,
};

describe('DecisionTriggerFactories', () => {
  it('createCollaborationTrigger produces correct trigger', () => {
    const trigger = createCollaborationTrigger(collabCtx);
    expect(trigger.source).toBe('collaboration-node');
    expect(trigger.sourceId).toBe('collab-1-node-1');
    expect(trigger.title).toContain('技术评审');
    expect(trigger.context).toContain('Alice');
    expect(trigger.context).toContain('修改了认证模块');
    expect(trigger.urgency).toBe('normal');
    expect(trigger.deadline).toBeGreaterThan(Date.now() - 1000);
  });

  it('createCollaborationTrigger includes extra data', () => {
    const trigger = createCollaborationTrigger(collabCtx, { taskId: 't1', goalId: 'g1' });
    expect(trigger.relatedEntities.collaborationId).toBe('collab-1');
    expect(trigger.relatedEntities.taskId).toBe('t1');
    expect(trigger.relatedEntities.goalId).toBe('g1');
  });

  it('createMilestoneTrigger produces correct trigger', () => {
    const trigger = createMilestoneTrigger(milestoneCtx);
    expect(trigger.source).toBe('milestone-arrival');
    expect(trigger.sourceId).toBe('goal-1-ms-1');
    expect(trigger.title).toContain('Alpha 发布');
    expect(trigger.context).toContain('50%');
    expect(trigger.context).toContain('2/4');
    expect(trigger.urgency).toBe('normal');
  });

  it('createMilestoneTrigger includes blocking issue note', () => {
    const ctx = { ...milestoneCtx, hasBlockingIssue: true };
    const trigger = createMilestoneTrigger(ctx);
    expect(trigger.context).toContain('阻塞');
  });

  it('createMilestoneTrigger includes extra data', () => {
    const trigger = createMilestoneTrigger(milestoneCtx, { taskId: 't2', decisionId: 'd1' });
    expect(trigger.relatedEntities.goalId).toBe('goal-1');
    expect(trigger.relatedEntities.taskId).toBe('t2');
    expect(trigger.relatedEntities.decisionId).toBe('d1');
  });
});
