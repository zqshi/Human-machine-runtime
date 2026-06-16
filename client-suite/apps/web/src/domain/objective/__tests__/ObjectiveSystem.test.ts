import { describe, it, expect } from 'vitest';
import { StrategicObjective } from '../StrategicObjective';
import { JudgmentObjective } from '../JudgmentObjective';
import { ExecutionObjective } from '../ExecutionObjective';
import { ConfidenceCalculator } from '../ConfidenceCalculator';
import { ObjectiveAlignmentService } from '../ObjectiveAlignmentService';
import { HumanAgentDivisionEngine, type DivisionContext } from '../HumanAgentDivisionEngine';

describe('StrategicObjective (L0)', () => {
  it('creates with draft status', () => {
    const l0 = StrategicObjective.create({
      direction: '成为行业领先的 AI 协作平台',
      description: '通过 AI Native 协作提升组织效率 50%',
      coreConstraints: [
        { id: 'c1', description: '年度预算 100 万', type: 'budget', isMandatory: true },
      ],
      timeHorizon: 'annual',
    });
    expect(l0.status).toBe('draft');
    expect(l0.confidenceScore).toBe(0);
    expect(l0.mandatoryConstraints).toHaveLength(1);
  });

  it('links and unlinks L1s', () => {
    const l0 = StrategicObjective.create({
      direction: 'test',
      description: 'test',
      coreConstraints: [],
      timeHorizon: 'quarterly',
    }).activate();

    const linked = l0.linkL1('l1-1').linkL1('l1-2');
    expect(linked.linkedL1Ids).toHaveLength(2);

    const unlinked = linked.unlinkL1('l1-1');
    expect(unlinked.linkedL1Ids).toHaveLength(1);
  });
});

describe('JudgmentObjective (L1)', () => {
  it('creates and tracks accuracy', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: '客户满意度是否在提升？',
      description: '每月评估 NPS 变化',
      cadence: 'monthly',
      targetAccuracyRate: 0.85,
    });

    expect(l1.isOnTarget).toBe(false);
    expect(l1.gap).toBe(0.85);

    const updated = l1.updateAccuracy(0.9);
    expect(updated.isOnTarget).toBe(true);
    expect(updated.gap).toBe(0);
  });
});

describe('ExecutionObjective (L2)', () => {
  it('transitions through lifecycle', () => {
    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'agent-a',
      description: '每周运行 NPS 分析',
    });

    expect(l2.status).toBe('pending');
    const started = l2.start();
    expect(started.status).toBe('in-progress');
    const completed = started.complete({
      completionRate: 1,
      acceptanceRate: 0.95,
      avgDurationMs: 5000,
      tokensCost: 1000,
    });
    expect(completed.isCompleted).toBe(true);
    expect(completed.performanceMetrics.completionRate).toBe(1);
  });
});

describe('ConfidenceCalculator', () => {
  it('computes L0 confidence from L1+L2', () => {
    const l0 = StrategicObjective.create({
      direction: 'test',
      description: 'test',
      coreConstraints: [],
      timeHorizon: 'annual',
    }).linkL1('l1-1');

    const l1 = JudgmentObjective.fromProps({
      id: 'l1-1',
      l0Id: l0.id,
      keyQuestion: 'test',
      description: 'test',
      cadence: 'monthly',
      linkedDecisionIds: [],
      accuracyRate: 0.8,
      targetAccuracyRate: 0.8,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a1',
      description: 'test',
    })
      .start()
      .complete({ completionRate: 1, acceptanceRate: 1, avgDurationMs: 1000, tokensCost: 100 });

    const breakdown = ConfidenceCalculator.computeForL0(l0, [l1], [l2]);
    expect(breakdown.completionScore).toBe(100);
    expect(breakdown.accuracyScore).toBe(80);
    expect(breakdown.overallConfidence).toBeGreaterThan(0);
  });

  it('returns timeliness-only score for empty L1/L2', () => {
    const l0 = StrategicObjective.create({
      direction: 'test',
      description: 'test',
      coreConstraints: [],
      timeHorizon: 'quarterly',
    });

    const breakdown = ConfidenceCalculator.computeForL0(l0, [], []);
    expect(breakdown.completionScore).toBe(0);
    expect(breakdown.accuracyScore).toBe(0);
    expect(breakdown.timelinessScore).toBeGreaterThan(0);
    expect(breakdown.overallConfidence).toBe(breakdown.timelinessScore * 0.25);
  });
});

describe('ObjectiveAlignmentService', () => {
  it('detects unlinked L0', () => {
    const l0 = StrategicObjective.create({
      direction: 'test',
      description: 'test',
      coreConstraints: [],
      timeHorizon: 'quarterly',
    });

    const report = ObjectiveAlignmentService.computeAlignment([l0], [], []);
    expect(report.gaps.some((g) => g.gapType === 'unlinked' && g.level === 'L0')).toBe(true);
    expect(report.l0Coverage).toBe(0);
  });

  it('reports full alignment when properly linked', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'test',
      description: 'test',
      cadence: 'monthly',
    });

    const l0 = StrategicObjective.create({
      direction: 'test',
      description: 'test',
      coreConstraints: [],
      timeHorizon: 'quarterly',
    }).linkL1(l1.id);

    const l2 = ExecutionObjective.create({
      l1Id: l1.id,
      taskContractId: 'tc-1',
      linkedAgentId: 'a1',
      description: 'test',
    });

    const report = ObjectiveAlignmentService.computeAlignment([l0], [l1], [l2]);
    expect(report.l0Coverage).toBe(1);
    expect(report.l1Coverage).toBe(1);
    expect(report.l2Coverage).toBe(1);
  });
});

describe('HumanAgentDivisionEngine', () => {
  const engine = new HumanAgentDivisionEngine();

  it('returns auto for high determinism + low risk', () => {
    const ctx: DivisionContext = {
      determinism: 0.9,
      riskLevel: 0.2,
      historicalSuccessRate: 0.95,
      impactScope: 2,
      isReversible: true,
      dataCompleteness: 0.9,
    };
    const result = engine.evaluate(ctx);
    expect(result.mode).toBe('auto');
  });

  it('returns human-approve for high determinism + high risk', () => {
    const ctx: DivisionContext = {
      determinism: 0.85,
      riskLevel: 0.7,
      historicalSuccessRate: 0.9,
      impactScope: 3,
      isReversible: true,
      dataCompleteness: 0.8,
    };
    const result = engine.evaluate(ctx);
    expect(result.mode).toBe('human-approve');
  });

  it('returns human-review for low determinism + low risk', () => {
    const ctx: DivisionContext = {
      determinism: 0.5,
      riskLevel: 0.2,
      historicalSuccessRate: 0.9,
      impactScope: 1,
      isReversible: true,
      dataCompleteness: 0.8,
    };
    const result = engine.evaluate(ctx);
    expect(result.mode).toBe('human-review');
  });

  it('returns human-lead for low determinism + high risk', () => {
    const ctx: DivisionContext = {
      determinism: 0.4,
      riskLevel: 0.6,
      historicalSuccessRate: 0.7,
      impactScope: 8,
      isReversible: false,
      dataCompleteness: 0.5,
    };
    const result = engine.evaluate(ctx);
    expect(result.mode).toBe('human-lead');
  });

  it('penalizes low data completeness', () => {
    const ctx: DivisionContext = {
      determinism: 0.75,
      riskLevel: 0.2,
      historicalSuccessRate: 0.9,
      impactScope: 1,
      isReversible: true,
      dataCompleteness: 0.2,
    };
    const result = engine.evaluate(ctx);
    expect(result.mode).not.toBe('auto');
  });
});
