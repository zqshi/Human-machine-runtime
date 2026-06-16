import { describe, it, expect, vi } from 'vitest';
import { CollaborationTrigger } from '../CollaborationTrigger';
import type { DecisionTrigger } from '../../../domain/agent/DecisionHub';

function baseTrigger(extra: Record<string, unknown> = {}): DecisionTrigger & {
  extra: Record<string, unknown>;
} {
  return {
    source: 'collaboration-node',
    sourceId: 'collab-1-node-1',
    title: '协作节点需要确认',
    context: '协作链中的变更',
    urgency: 'normal',
    deadline: Date.now() + 30 * 60_000,
    relatedEntities: { taskId: 'task-1' },
    extra: {
      collaborationId: 'collab-1',
      collaborationName: '功能评审',
      nodeId: 'node-1',
      nodeName: '代码审查',
      requesterId: 'user-1',
      requesterName: 'Alice',
      nodeType: 'review',
      changeSummary: '更新了 API 接口',
      requiresApproval: true,
      approvers: ['user-2', 'user-3'],
      currentApprover: 'user-2',
      estimatedDelayIfRejected: 3600000,
      hasConflictingChanges: false,
      ...extra,
    },
  };
}

describe('CollaborationTrigger', () => {
  const trigger = new CollaborationTrigger();

  describe('preprocess', () => {
    it('sets urgency and deadline on result', async () => {
      const result = await trigger.preprocess(baseTrigger());
      expect(result.urgency).toBeDefined();
      expect(result.deadline).toBeGreaterThan(Date.now());
      expect(result.impactScope).toBe(2);
    });

    it('blocking nodeType → critical urgency', async () => {
      const result = await trigger.preprocess(baseTrigger({ nodeType: 'blocking' }));
      expect(result.urgency).toBe('critical');
    });

    it('conflicting changes → high urgency', async () => {
      const result = await trigger.preprocess(
        baseTrigger({ nodeType: 'review', hasConflictingChanges: true })
      );
      expect(result.urgency).toBe('high');
    });

    it('approval nodeType → high urgency', async () => {
      const result = await trigger.preprocess(baseTrigger({ nodeType: 'approval' }));
      expect(result.urgency).toBe('high');
    });

    it('large delay if rejected → high urgency', async () => {
      const result = await trigger.preprocess(
        baseTrigger({
          nodeType: 'modification',
          hasConflictingChanges: false,
          estimatedDelayIfRejected: 48 * 3600000,
        })
      );
      expect(result.urgency).toBe('high');
    });

    it('normal review → normal urgency', async () => {
      const result = await trigger.preprocess(
        baseTrigger({
          nodeType: 'review',
          hasConflictingChanges: false,
          estimatedDelayIfRejected: 0,
        })
      );
      expect(result.urgency).toBe('normal');
    });

    it('generates recommendation and alternatives', async () => {
      const result = await trigger.preprocess(baseTrigger());
      expect(result.recommendation).toBeDefined();
      expect(result.recommendation!.label).toBeTruthy();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it('includes downstreamTaskIds from relatedEntities', async () => {
      const result = await trigger.preprocess(baseTrigger());
      expect(result.downstreamTaskIds).toEqual(['task-1']);
    });

    it('approval type includes conditional-approve alternative', async () => {
      const result = await trigger.preprocess(baseTrigger({ nodeType: 'approval' }));
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('有条件批准');
    });

    it('non-approval type includes modify alternative', async () => {
      const result = await trigger.preprocess(baseTrigger({ nodeType: 'review' }));
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('请求修改');
    });

    it('multiple approvers includes transfer alternative', async () => {
      const result = await trigger.preprocess(
        baseTrigger({ approvers: ['user-2', 'user-3'], currentApprover: 'user-2' })
      );
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('转给他人审批');
    });
  });

  describe('postprocess', () => {
    it('is a no-op', async () => {
      await expect(trigger.postprocess({} as never)).resolves.toBeUndefined();
    });
  });
});
