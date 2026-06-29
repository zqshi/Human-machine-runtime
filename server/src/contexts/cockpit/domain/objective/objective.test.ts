import { describe, it, expect } from 'vitest';
import { Objective, type ObjectiveProps, type PerformanceMetrics } from './objective.js';

const baseProps = (): ObjectiveProps => ({
  id: 'obj-1',
  level: 'L0',
  parentId: undefined,
  tenantId: 'tenant-1',
  title: '战略目标',
  description: 'desc',
  confidence: 0.5,
  status: 'active',
  metrics: { completionRate: 0.6, acceptanceRate: 0.4, avgDurationMs: 1000, tokensCost: 200 },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('Objective', () => {
  describe('create', () => {
    it('默认 status=active / confidence=0 / metrics 零值 / id obj- 前缀', () => {
      const o = Objective.create({ level: 'L0', title: 'G' });
      expect(o.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
      expect(o.level).toBe('L0');
      expect(o.status).toBe('active');
      expect(o.confidence).toBe(0);
      expect(o.metrics).toEqual({
        completionRate: 0,
        acceptanceRate: 0,
        avgDurationMs: 0,
        tokensCost: 0,
      });
      expect(o.createdAt).toBeInstanceOf(Date);
      expect(o.updatedAt).toBeInstanceOf(Date);
    });

    it('透传 parentId/tenantId/title/description，confidence clamp 0-1', () => {
      const o = Objective.create({
        level: 'L1',
        parentId: 'obj-0',
        tenantId: 't1',
        title: '判断目标',
        description: 'd',
        confidence: 1.5,
        metrics: { completionRate: 0.9 },
      });
      expect(o.parentId).toBe('obj-0');
      expect(o.tenantId).toBe('t1');
      expect(o.title).toBe('判断目标');
      expect(o.confidence).toBe(1); // clamp
      expect(o.metrics.completionRate).toBe(0.9);
      expect(o.metrics.acceptanceRate).toBe(0); // 缺失补 0
    });

    it('显式 status 透传', () => {
      const o = Objective.create({ level: 'L2', status: 'paused' });
      expect(o.status).toBe('paused');
    });

    it('非法 level 抛错', () => {
      expect(() => Objective.create({ level: 'L9' as never })).toThrow(/invalid level/);
    });

    it('非法 status 抛错', () => {
      expect(() => Objective.create({ level: 'L0', status: 'draft' as never })).toThrow(
        /invalid status/
      );
    });
  });

  describe('fromProps', () => {
    it('校验 level 枚举，脏数据拒建', () => {
      expect(() => Objective.fromProps({ ...baseProps(), level: 'L9' as never })).toThrow(
        /invalid level/
      );
    });

    it('校验 status 枚举，脏数据拒建', () => {
      expect(() => Objective.fromProps({ ...baseProps(), status: 'draft' as never })).toThrow(
        /invalid status/
      );
    });

    it('confidence clamp 0-1 + metrics 规整', () => {
      const o = Objective.fromProps({
        ...baseProps(),
        confidence: -0.5,
        metrics: { completionRate: 2, acceptanceRate: -1, avgDurationMs: -50, tokensCost: 100 },
      });
      expect(o.confidence).toBe(0);
      expect(o.metrics.completionRate).toBe(1);
      expect(o.metrics.acceptanceRate).toBe(0);
      expect(o.metrics.avgDurationMs).toBe(0);
      expect(o.metrics.tokensCost).toBe(100);
    });

    it('metrics 缺失字段补 0', () => {
      const o = Objective.fromProps({ ...baseProps(), metrics: {} as PerformanceMetrics });
      expect(o.metrics).toEqual({
        completionRate: 0,
        acceptanceRate: 0,
        avgDurationMs: 0,
        tokensCost: 0,
      });
    });

    it('保留传入 id/createdAt/updatedAt（DB 重建语义）', () => {
      const created = new Date('2025-06-01T00:00:00Z');
      const updated = new Date('2025-06-02T00:00:00Z');
      const o = Objective.fromProps({ ...baseProps(), createdAt: created, updatedAt: updated });
      expect(o.id).toBe('obj-1');
      expect(o.createdAt).toBe(created);
      expect(o.updatedAt).toBe(updated);
    });
  });

  describe('状态机（返回新实例，原实例 immutable）', () => {
    it('activate → active，updatedAt 刷新', () => {
      const o = Objective.fromProps({ ...baseProps(), status: 'paused' });
      const next = o.activate();
      expect(next.status).toBe('active');
      expect(next.updatedAt.getTime()).toBeGreaterThanOrEqual(o.updatedAt.getTime());
      expect(o.status).toBe('paused'); // 原实例不变
      expect(next).not.toBe(o);
    });

    it('pause → paused', () => {
      expect(Objective.fromProps(baseProps()).pause().status).toBe('paused');
    });

    it('complete → completed，合并传入 metrics', () => {
      const o = Objective.fromProps(baseProps());
      const next = o.complete({ completionRate: 0.95, tokensCost: 500 });
      expect(next.status).toBe('completed');
      expect(next.metrics.completionRate).toBe(0.95);
      expect(next.metrics.tokensCost).toBe(500);
      expect(next.metrics.acceptanceRate).toBe(0.4); // 未传字段保留原值
    });

    it('complete 无 metrics 参数时保留原 metrics', () => {
      const o = Objective.fromProps(baseProps());
      expect(o.complete().metrics).toEqual(o.metrics);
    });

    it('abandon → abandoned', () => {
      expect(Objective.fromProps(baseProps()).abandon().status).toBe('abandoned');
    });
  });

  describe('不变式更新', () => {
    it('updateConfidence clamp 到 [0,1]', () => {
      const o = Objective.fromProps(baseProps());
      expect(o.updateConfidence(1.2).confidence).toBe(1);
      expect(o.updateConfidence(-0.3).confidence).toBe(0);
      expect(o.updateConfidence(0.7).confidence).toBe(0.7);
    });

    it('updateMetrics 合并 + 率值 clamp', () => {
      const o = Objective.fromProps(baseProps());
      const next = o.updateMetrics({ completionRate: 1.5, avgDurationMs: 2000 });
      expect(next.metrics.completionRate).toBe(1); // clamp
      expect(next.metrics.avgDurationMs).toBe(2000);
      expect(next.metrics.acceptanceRate).toBe(0.4); // 保留
    });
  });

  describe('派生查询', () => {
    it('isActive / isTerminal', () => {
      expect(Objective.fromProps({ ...baseProps(), status: 'active' }).isActive).toBe(true);
      expect(Objective.fromProps({ ...baseProps(), status: 'paused' }).isActive).toBe(false);
      expect(Objective.fromProps({ ...baseProps(), status: 'completed' }).isTerminal).toBe(true);
      expect(Objective.fromProps({ ...baseProps(), status: 'abandoned' }).isTerminal).toBe(true);
      expect(Objective.fromProps({ ...baseProps(), status: 'active' }).isTerminal).toBe(false);
    });
  });

  describe('toProps', () => {
    it('完整序列化（metrics 浅拷贝，非同一引用）', () => {
      const o = Objective.fromProps(baseProps());
      const p = o.toProps();
      expect(p.id).toBe('obj-1');
      expect(p.level).toBe('L0');
      expect(p.confidence).toBe(0.5);
      expect(p.metrics).toEqual(o.metrics);
      expect(p.metrics).not.toBe(o.metrics); // 浅拷贝
    });
  });
});
