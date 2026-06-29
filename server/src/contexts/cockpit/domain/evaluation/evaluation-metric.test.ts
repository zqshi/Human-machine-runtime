import { describe, it, expect } from 'vitest';
import { EvaluationMetric, type EvaluationMetricProps } from './evaluation-metric.js';

const baseProps = (): EvaluationMetricProps => ({
  id: 'evm-1',
  dimension: 'agent',
  score: 85,
  metadata: { source: 'eval-job' },
  tenantId: 'tenant-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('EvaluationMetric', () => {
  describe('create', () => {
    it('默认 dimension=human / score=0 / metadata 空 / id evm- 前缀', () => {
      const m = EvaluationMetric.create({});
      expect(m.id).toMatch(/^evm-\d+-[a-z0-9]+$/);
      expect(m.dimension).toBe('human');
      expect(m.score).toBe(0);
      expect(m.metadata).toEqual({});
      expect(m.createdAt).toBeInstanceOf(Date);
      expect(m.isHumanTrack).toBe(true);
    });

    it('透传字段 + dimension 枚举校验', () => {
      const m = EvaluationMetric.create({
        dimension: 'agent',
        score: 90,
        metadata: { k: 'v' },
        tenantId: 't1',
      });
      expect(m.dimension).toBe('agent');
      expect(m.score).toBe(90);
      expect(m.metadata).toEqual({ k: 'v' });
      expect(m.isAgentTrack).toBe(true);
    });

    it('create 非法 dimension 抛错', () => {
      expect(() => EvaluationMetric.create({ dimension: 'bot' as never })).toThrow(
        /invalid dimension/
      );
    });

    it('create score 非数字当 0 / 负数 clamp 0 / 浮点取整', () => {
      expect(EvaluationMetric.create({ score: 'x' as never }).score).toBe(0);
      expect(EvaluationMetric.create({ score: -10 }).score).toBe(0);
      expect(EvaluationMetric.create({ score: 85.9 }).score).toBe(85);
    });

    it('create metadata 非对象规整为 {}', () => {
      expect(EvaluationMetric.create({ metadata: 'x' as never }).metadata).toEqual({});
      expect(EvaluationMetric.create({ metadata: [1, 2] as never }).metadata).toEqual({});
    });
  });

  describe('fromProps', () => {
    it('校验 dimension 不变式，脏 dimension 拒建', () => {
      expect(() =>
        EvaluationMetric.fromProps({ ...baseProps(), dimension: 'bot' as never })
      ).toThrow(/invalid dimension/);
    });
  });

  describe('rehydrate', () => {
    it('脏 dimension fallback human（不抛错）', () => {
      const m = EvaluationMetric.rehydrate({
        ...baseProps(),
        dimension: 'garbage',
        score: null,
        metadata: null,
      });
      expect(m.dimension).toBe('human');
      expect(m.score).toBe(0);
      expect(m.metadata).toEqual({});
    });

    it('合法 dimension 保留 + score clamp', () => {
      const m = EvaluationMetric.rehydrate({ ...baseProps(), dimension: 'agent', score: 92.7 });
      expect(m.dimension).toBe('agent');
      expect(m.score).toBe(92);
    });
  });

  describe('avgOf 聚合', () => {
    it('空数组 → 0', () => {
      expect(EvaluationMetric.avgOf([])).toBe(0);
    });

    it('多值 round(sum/length)', () => {
      const ms = [
        EvaluationMetric.fromProps({ ...baseProps(), score: 80 }),
        EvaluationMetric.fromProps({ ...baseProps(), score: 70 }),
        EvaluationMetric.fromProps({ ...baseProps(), score: 90 }),
      ];
      expect(EvaluationMetric.avgOf(ms)).toBe(80);
    });

    it('小数 round（非截断）', () => {
      const ms = [
        EvaluationMetric.fromProps({ ...baseProps(), score: 70 }),
        EvaluationMetric.fromProps({ ...baseProps(), score: 75 }),
      ];
      // (70+75)/2 = 72.5 → round 73（Math.round 半数进位）
      expect(EvaluationMetric.avgOf(ms)).toBe(73);
    });
  });

  describe('toProps round-trip', () => {
    it('fromProps(toProps()) 恒等', () => {
      const m = EvaluationMetric.fromProps(baseProps());
      expect(EvaluationMetric.fromProps(m.toProps()).toProps()).toEqual(m.toProps());
    });
  });
});
