import { describe, it, expect } from 'vitest';
import { MilestoneTrigger } from '../MilestoneTrigger';
import type { DecisionTrigger } from '../../../domain/agent/DecisionHub';

function milestoneTrigger(extra: Record<string, unknown> = {}): DecisionTrigger & {
  extra: Record<string, unknown>;
} {
  return {
    source: 'milestone-arrival',
    sourceId: 'ms-1',
    title: '里程碑完成',
    context: '里程碑已到达',
    urgency: 'normal',
    deadline: Date.now() + 7200_000,
    relatedEntities: { goalId: 'goal-1' },
    extra: {
      goalId: 'goal-1',
      goalTitle: '产品发布',
      milestoneId: 'ms-1',
      milestoneName: 'Alpha 版本',
      milestoneIndex: 2,
      totalMilestones: 5,
      completedMilestones: 3,
      hasBlockingIssue: false,
      estimatedTimeToComplete: 7200000,
      ...extra,
    },
  };
}

describe('MilestoneTrigger', () => {
  const handler = new MilestoneTrigger();

  describe('preprocess', () => {
    it('sets urgency, deadline, and impactScope', async () => {
      const result = await handler.preprocess(milestoneTrigger());
      expect(result.urgency).toBeDefined();
      expect(result.deadline).toBeGreaterThan(Date.now());
      expect(result.impactScope).toBe(3);
    });

    it('blocking issue → critical urgency', async () => {
      const result = await handler.preprocess(milestoneTrigger({ hasBlockingIssue: true }));
      expect(result.urgency).toBe('critical');
    });

    it('few remaining milestones → high urgency', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ totalMilestones: 5, completedMilestones: 4 })
      );
      expect(result.urgency).toBe('high');
    });

    it('progress >= 70% but milestones remaining → normal', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ totalMilestones: 10, completedMilestones: 7 })
      );
      expect(result.urgency).toBe('normal');
    });

    it('early progress → normal', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ totalMilestones: 10, completedMilestones: 3 })
      );
      expect(result.urgency).toBe('normal');
    });

    it('includes downstreamGoalIds from relatedEntities', async () => {
      const result = await handler.preprocess(milestoneTrigger());
      expect(result.downstreamGoalIds).toEqual(['goal-1']);
    });

    it('last milestone recommendation says 确认目标完成', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ totalMilestones: 3, completedMilestones: 3 })
      );
      expect(result.recommendation!.label).toBe('确认目标完成');
    });

    it('non-last milestone recommendation says 继续下一个里程碑', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ totalMilestones: 5, completedMilestones: 2 })
      );
      expect(result.recommendation!.label).toBe('继续下一个里程碑');
    });

    it('blocking issue shows skip alternative', async () => {
      const result = await handler.preprocess(milestoneTrigger({ hasBlockingIssue: true }));
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('记录问题，继续执行');
    });

    it('early milestone shows add-milestone alternative', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ milestoneIndex: 1, totalMilestones: 6, completedMilestones: 2 })
      );
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('添加中间里程碑');
    });

    it('non-last milestone shows adjust alternative', async () => {
      const result = await handler.preprocess(
        milestoneTrigger({ totalMilestones: 5, completedMilestones: 2 })
      );
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('调整目标方向');
    });
  });

  describe('postprocess', () => {
    it('is a no-op', async () => {
      await expect(handler.postprocess({} as never)).resolves.toBeUndefined();
    });
  });
});
