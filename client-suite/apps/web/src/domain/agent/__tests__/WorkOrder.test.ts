import { describe, it, expect } from 'vitest';
import { WorkOrder } from '../WorkOrder';
import type { WorkOrderProps } from '../WorkOrder';

function makeProps(overrides?: Partial<WorkOrderProps>): WorkOrderProps {
  return {
    id: 'wo-1',
    type: 'review',
    fromUserId: 'user-a',
    toUserId: 'user-b',
    goalId: 'goal-1',
    title: '审查代码变更',
    context: '请审查 PR #42',
    aiSuggestion: 'LGTM, 建议合并',
    confidence: 0.85,
    status: 'pending',
    deadline: Date.now() + 3600_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('WorkOrder', () => {
  it('creates from props', () => {
    const wo = WorkOrder.create(makeProps());
    expect(wo.id).toBe('wo-1');
    expect(wo.type).toBe('review');
    expect(wo.isPending).toBe(true);
  });

  it('defaults confidence to 0 when not provided', () => {
    const wo = WorkOrder.create(makeProps({ confidence: undefined }));
    expect(wo.confidence).toBe(0);
  });

  it('isPending is true only for pending status', () => {
    expect(WorkOrder.create(makeProps({ status: 'pending' })).isPending).toBe(true);
    expect(WorkOrder.create(makeProps({ status: 'completed' })).isPending).toBe(false);
    expect(WorkOrder.create(makeProps({ status: 'expired' })).isPending).toBe(false);
    expect(WorkOrder.create(makeProps({ status: 'auto_resolved' })).isPending).toBe(false);
  });

  it('isHighConfidence threshold is 0.9', () => {
    expect(WorkOrder.create(makeProps({ confidence: 0.89 })).isHighConfidence).toBe(false);
    expect(WorkOrder.create(makeProps({ confidence: 0.9 })).isHighConfidence).toBe(true);
    expect(WorkOrder.create(makeProps({ confidence: 0.95 })).isHighConfidence).toBe(true);
  });

  it('isExpired checks deadline', () => {
    const past = WorkOrder.create(makeProps({ deadline: Date.now() - 1000 }));
    expect(past.isExpired).toBe(true);

    const future = WorkOrder.create(makeProps({ deadline: Date.now() + 10000 }));
    expect(future.isExpired).toBe(false);

    const completed = WorkOrder.create(
      makeProps({ status: 'completed', deadline: Date.now() - 1000 })
    );
    expect(completed.isExpired).toBe(false);
  });

  it('complete() transitions pending → completed with response', () => {
    const wo = WorkOrder.create(makeProps());
    const completed = wo.complete('已审核通过');
    expect(completed.status).toBe('completed');
    expect(completed.response).toBe('已审核通过');
    expect(completed.respondedAt).toBeGreaterThan(0);
  });

  it('complete() is a no-op on non-pending', () => {
    const wo = WorkOrder.create(makeProps({ status: 'expired' }));
    const result = wo.complete('test');
    expect(result).toBe(wo);
  });

  it('autoResolve() works only when pending + highConfidence', () => {
    const highConf = WorkOrder.create(makeProps({ confidence: 0.95 }));
    const resolved = highConf.autoResolve();
    expect(resolved.status).toBe('auto_resolved');
    expect(resolved.response).toBe('LGTM, 建议合并');

    const lowConf = WorkOrder.create(makeProps({ confidence: 0.5 }));
    expect(lowConf.autoResolve()).toBe(lowConf);

    const notPending = WorkOrder.create(makeProps({ status: 'completed', confidence: 0.95 }));
    expect(notPending.autoResolve()).toBe(notPending);
  });

  it('expire() transitions pending → expired', () => {
    const wo = WorkOrder.create(makeProps());
    const expired = wo.expire();
    expect(expired.status).toBe('expired');
  });

  it('expire() is a no-op on non-pending', () => {
    const wo = WorkOrder.create(makeProps({ status: 'completed' }));
    expect(wo.expire()).toBe(wo);
  });

  it('toProps() round-trips', () => {
    const props = makeProps({ taskId: 'task-x', response: 'done', respondedAt: 12345 });
    const wo = WorkOrder.create(props);
    expect(wo.toProps()).toEqual(props);
  });
});
