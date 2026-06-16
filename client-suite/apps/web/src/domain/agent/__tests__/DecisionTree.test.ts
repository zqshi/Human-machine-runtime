import { describe, it, expect } from 'vitest';
import { DecisionTree, type DecisionNode, type UserFollowUpAction } from '../DecisionTree';

const nodes: DecisionNode[] = [
  { id: 'n1', type: 'trigger', label: 'Alert', detail: 'CPU spike', status: 'completed' },
  { id: 'n2', type: 'reasoning', label: 'Analyze', detail: 'Check metrics', status: 'completed' },
  { id: 'n3', type: 'action', label: 'Scale', detail: 'Add replicas', status: 'active' },
  { id: 'n4', type: 'outcome', label: 'Result', detail: 'Pending', status: 'pending' },
];

const actions: UserFollowUpAction[] = [
  { id: 'a1', label: '批准', icon: 'check', actionType: 'approve' },
  { id: 'a2', label: '驳回', icon: 'close', actionType: 'reject' },
];

describe('DecisionTree', () => {
  it('creates from props', () => {
    const tree = DecisionTree.create({
      activityId: 'act-1',
      nodes,
      followUpActions: actions,
      confidence: 0.85,
    });
    expect(tree.activityId).toBe('act-1');
    expect(tree.nodes).toHaveLength(4);
    expect(tree.followUpActions).toHaveLength(2);
    expect(tree.confidence).toBe(0.85);
  });

  it('trigger getter returns trigger node', () => {
    const tree = DecisionTree.create({
      activityId: 'act-1',
      nodes,
      followUpActions: [],
      confidence: 0.9,
    });
    expect(tree.trigger?.type).toBe('trigger');
    expect(tree.trigger?.label).toBe('Alert');
  });

  it('outcome getter returns outcome node', () => {
    const tree = DecisionTree.create({
      activityId: 'act-1',
      nodes,
      followUpActions: [],
      confidence: 0.9,
    });
    expect(tree.outcome?.type).toBe('outcome');
    expect(tree.outcome?.label).toBe('Result');
  });

  it('isFullyResolved is false when any node not completed', () => {
    const tree = DecisionTree.create({
      activityId: 'act-1',
      nodes,
      followUpActions: [],
      confidence: 0.9,
    });
    expect(tree.isFullyResolved).toBe(false);
  });

  it('isFullyResolved is true when all completed', () => {
    const allDone = nodes.map((n) => ({ ...n, status: 'completed' as const }));
    const tree = DecisionTree.create({
      activityId: 'act-1',
      nodes: allDone,
      followUpActions: [],
      confidence: 1,
    });
    expect(tree.isFullyResolved).toBe(true);
  });

  it('returns undefined for missing trigger/outcome', () => {
    const tree = DecisionTree.create({
      activityId: 'act-1',
      nodes: [],
      followUpActions: [],
      confidence: 0,
    });
    expect(tree.trigger).toBeUndefined();
    expect(tree.outcome).toBeUndefined();
  });
});
