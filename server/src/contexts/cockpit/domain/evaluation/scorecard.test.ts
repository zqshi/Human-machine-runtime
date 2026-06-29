import { describe, it, expect } from 'vitest';
import { Scorecard, type ScorecardProps } from './scorecard.js';

const baseProps = (): ScorecardProps => ({
  id: 'sc-1',
  scores: [{ value: 80 }, { value: 60 }],
  overallScore: 70,
  metadata: { evaluator: 'u1' },
  tenantId: 'tenant-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('Scorecard', () => {
  describe('create', () => {
    it('默认 scores=[] / overallScore=0 / metadata 空 / id sc- 前缀', () => {
      const s = Scorecard.create({});
      expect(s.id).toMatch(/^sc-\d+-[a-z0-9]+$/);
      expect(s.scores).toEqual([]);
      expect(s.overallScore).toBe(0);
      expect(s.metadata).toEqual({});
      expect(s.isEmpty).toBe(true);
    });

    it('overallScore = round(avg(value))', () => {
      const s = Scorecard.create({ scores: [{ value: 80 }, { value: 60 }] });
      expect(s.overallScore).toBe(70);
    });

    it('空 scores → overallScore 0', () => {
      const s = Scorecard.create({ scores: [] });
      expect(s.overallScore).toBe(0);
    });

    it('scores 元素 value 非 number 当 0（防 NaN，保留占位维持分母）', () => {
      const s = Scorecard.create({
        scores: [{ value: 90 }, { value: 'x' as never }, { value: 60 }] as never,
      });
      // [90, 0, 60] → sum 150 / 3 = 50
      expect(s.scores).toHaveLength(3);
      expect(s.scores[1].value).toBe(0);
      expect(s.overallScore).toBe(50);
    });

    it('scores 非数组 → []', () => {
      const s = Scorecard.create({ scores: 'nope' as never });
      expect(s.scores).toEqual([]);
      expect(s.overallScore).toBe(0);
    });

    it('scores 元素非对象当 {value:0}', () => {
      const s = Scorecard.create({ scores: [null, 42, { value: 80 }] as never });
      expect(s.scores).toEqual([{ value: 0 }, { value: 0 }, { value: 80 }]);
      // (0+0+80)/3 = 26.67 → round 27
      expect(s.overallScore).toBe(27);
    });

    it('value 负数 clamp 0 / 浮点取整', () => {
      const s = Scorecard.create({ scores: [{ value: -5 }, { value: 90.9 }] });
      // (0+90)/2 = 45
      expect(s.scores[0].value).toBe(0);
      expect(s.scores[1].value).toBe(90);
      expect(s.overallScore).toBe(45);
    });

    it('create metadata 非对象规整为 {}', () => {
      expect(Scorecard.create({ metadata: 'x' as never }).metadata).toEqual({});
    });
  });

  describe('fromProps', () => {
    it('信任 DB overallScore（只 clamp，不重算）', () => {
      // DB overallScore=99 与 scores 算的 70 不一致，fromProps 信任 DB
      const s = Scorecard.fromProps({ ...baseProps(), overallScore: 99 });
      expect(s.overallScore).toBe(99);
    });

    it('overallScore 非数字当 0', () => {
      const s = Scorecard.fromProps({ ...baseProps(), overallScore: 'x' as never });
      expect(s.overallScore).toBe(0);
    });
  });

  describe('rehydrate', () => {
    it('脏 scores/overallScore 容错（不抛错）', () => {
      const s = Scorecard.rehydrate({
        ...baseProps(),
        scores: 'nope',
        overallScore: null,
        metadata: null,
      });
      expect(s.scores).toEqual([]);
      expect(s.overallScore).toBe(0);
      expect(s.metadata).toEqual({});
    });
  });

  describe('toProps round-trip', () => {
    it('fromProps(toProps()) 恒等', () => {
      const s = Scorecard.fromProps(baseProps());
      expect(Scorecard.fromProps(s.toProps()).toProps()).toEqual(s.toProps());
    });
  });
});
