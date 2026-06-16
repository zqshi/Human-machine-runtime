import { describe, it, expect } from 'vitest';
import { ObjectiveAlignmentService } from '../ObjectiveAlignmentService';
import { StrategicObjective } from '../StrategicObjective';
import { JudgmentObjective } from '../JudgmentObjective';
import { ExecutionObjective } from '../ExecutionObjective';

function makeL0(direction: string, linkedL1Ids: string[] = []) {
  const l0 = StrategicObjective.create({
    direction,
    description: '',
    coreConstraints: [],
    timeHorizon: 'quarterly',
  });
  let result = l0;
  for (const id of linkedL1Ids) {
    result = result.linkL1(id);
  }
  return result;
}

function makeL1(l0Id: string, overrides: { id?: string; keyQuestion?: string } = {}) {
  const l1 = JudgmentObjective.create({
    l0Id,
    keyQuestion: overrides.keyQuestion ?? 'Q?',
    description: '',
    cadence: 'weekly',
  });
  if (overrides.id) {
    return JudgmentObjective.fromProps({ ...toL1Props(l1), id: overrides.id });
  }
  return l1;
}

function toL1Props(l1: JudgmentObjective) {
  return {
    id: l1.id,
    l0Id: l1.l0Id,
    keyQuestion: l1.keyQuestion,
    description: l1.description,
    cadence: l1.cadence,
    linkedDecisionIds: [...l1.linkedDecisionIds],
    accuracyRate: l1.accuracyRate,
    targetAccuracyRate: l1.targetAccuracyRate,
    status: l1.status,
    createdAt: l1.createdAt,
    updatedAt: l1.updatedAt,
  };
}

function makeL2(
  l1Id: string,
  overrides: { status?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled' } = {}
) {
  const l2 = ExecutionObjective.create({
    l1Id,
    taskContractId: 'tc-1',
    linkedAgentId: 'agent-1',
    description: 'exec task',
  });
  if (overrides.status) {
    return ExecutionObjective.fromProps({
      id: l2.id,
      l1Id: l2.l1Id,
      taskContractId: l2.taskContractId,
      linkedAgentId: l2.linkedAgentId,
      description: l2.description,
      performanceMetrics: l2.performanceMetrics,
      status: overrides.status,
      createdAt: l2.createdAt,
      updatedAt: l2.updatedAt,
    });
  }
  return l2;
}

describe('ObjectiveAlignmentService', () => {
  it('returns zero coverage for empty inputs', () => {
    const report = ObjectiveAlignmentService.computeAlignment([], [], []);
    expect(report.l0Coverage).toBe(0);
    expect(report.l1Coverage).toBe(0);
    expect(report.l2Coverage).toBe(0);
    expect(report.gaps).toHaveLength(0);
  });

  it('full coverage when all linked', () => {
    const l1 = makeL1('l0-x', { id: 'l1-a' });
    const l0 = makeL0('growth', ['l1-a']);
    const l2 = makeL2('l1-a');
    const report = ObjectiveAlignmentService.computeAlignment([l0], [l1], [l2]);
    expect(report.l0Coverage).toBe(1);
    expect(report.l1Coverage).toBe(1);
    expect(report.l2Coverage).toBe(1);
    expect(report.overallAlignment).toBeCloseTo(1, 5);
  });

  it('detects unlinked L0', () => {
    const l0 = makeL0('growth');
    const report = ObjectiveAlignmentService.computeAlignment([l0], [], []);
    expect(report.l0Coverage).toBe(0);
    const gap = report.gaps.find((g) => g.level === 'L0' && g.gapType === 'unlinked');
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe('high');
  });

  it('detects unlinked L1', () => {
    const l1 = makeL1('l0-x', { id: 'l1-a' });
    const l0 = makeL0('growth', ['l1-a']);
    const report = ObjectiveAlignmentService.computeAlignment([l0], [l1], []);
    expect(report.l1Coverage).toBe(0);
    const gap = report.gaps.find((g) => g.level === 'L1' && g.gapType === 'unlinked');
    expect(gap).toBeDefined();
  });

  it('detects orphaned L2', () => {
    const l2 = makeL2('nonexistent-l1');
    const report = ObjectiveAlignmentService.computeAlignment([], [], [l2]);
    const gap = report.gaps.find((g) => g.level === 'L2' && g.gapType === 'orphaned');
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe('low');
  });

  it('detects orphaned L1 (no parent L0)', () => {
    const l1 = makeL1('l0-x', { id: 'l1-orphan' });
    const report = ObjectiveAlignmentService.computeAlignment([], [l1], []);
    const gap = report.gaps.find((g) => g.level === 'L1' && g.gapType === 'orphaned');
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe('medium');
  });

  it('detects underperforming L1 when >50% L2s failed', () => {
    const l1 = makeL1('l0-x', { id: 'l1-a' });
    const l0 = makeL0('growth', ['l1-a']);
    const l2ok = makeL2('l1-a', { status: 'completed' });
    const l2fail1 = makeL2('l1-a', { status: 'failed' });
    const l2fail2 = makeL2('l1-a', { status: 'failed' });
    const report = ObjectiveAlignmentService.computeAlignment([l0], [l1], [l2ok, l2fail1, l2fail2]);
    const gap = report.gaps.find((g) => g.gapType === 'underperforming');
    expect(gap).toBeDefined();
    expect(gap!.level).toBe('L1');
  });

  it('computes overallAlignment as average of three coverages', () => {
    const l1 = makeL1('l0-x', { id: 'l1-a' });
    const l0 = makeL0('growth', ['l1-a']);
    const report = ObjectiveAlignmentService.computeAlignment([l0], [l1], []);
    expect(report.overallAlignment).toBeCloseTo((1 + 0 + 0) / 3, 5);
  });

  it('includes computedAt timestamp', () => {
    const report = ObjectiveAlignmentService.computeAlignment([], [], []);
    expect(report.computedAt).toBeGreaterThan(0);
  });
});
