import { describe, it, expect } from 'vitest';
import { Escalation, type EscalationProps } from './escalation.js';

const baseProps = (): EscalationProps => ({
  id: 'esc-1',
  status: 'open',
  severity: 'high',
  triggerReason: 'CPU >95%',
  relatedTaskId: 'task-1',
  metadata: { source: 'monitor' },
  tenantId: 'tenant-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('Escalation', () => {
  describe('create', () => {
    it('默认 status=open / metadata 空 / id esc- 前缀', () => {
      const e = Escalation.create({});
      expect(e.id).toMatch(/^esc-\d+-[a-z0-9]+$/);
      expect(e.status).toBe('open');
      expect(e.metadata).toEqual({});
      expect(e.createdAt).toBeInstanceOf(Date);
      expect(e.isOpen).toBe(true);
    });

    it('透传字段 + status 枚举校验', () => {
      const e = Escalation.create({
        status: 'resolved',
        severity: 'critical',
        triggerReason: '超时',
        relatedTaskId: 't1',
        metadata: { k: 'v' },
        tenantId: 't1',
      });
      expect(e.status).toBe('resolved');
      expect(e.severity).toBe('critical');
      expect(e.triggerReason).toBe('超时');
      expect(e.relatedTaskId).toBe('t1');
      expect(e.metadata).toEqual({ k: 'v' });
    });

    it('create 非法 status 抛错', () => {
      expect(() => Escalation.create({ status: 'pending' as never })).toThrow(/invalid status/);
    });

    it('create metadata 非对象规整为 {}', () => {
      const e = Escalation.create({ metadata: 'x' as never });
      expect(e.metadata).toEqual({});
    });
  });

  describe('fromProps', () => {
    it('校验 status 不变式，脏 status 拒建', () => {
      expect(() => Escalation.fromProps({ ...baseProps(), status: 'pending' as never })).toThrow(
        /invalid status/
      );
    });
  });

  describe('rehydrate', () => {
    it('脏 status fallback open（不抛错）', () => {
      const e = Escalation.rehydrate({ ...baseProps(), status: 'garbage', metadata: null });
      expect(e.status).toBe('open');
      expect(e.metadata).toEqual({});
    });

    it('合法 status 保留', () => {
      const e = Escalation.rehydrate({ ...baseProps(), status: 'resolved' });
      expect(e.status).toBe('resolved');
    });
  });

  describe('transition 状态机', () => {
    it('open → acknowledged 合法，返回新实例', () => {
      const e = Escalation.fromProps(baseProps());
      const next = e.acknowledge();
      expect(next.status).toBe('acknowledged');
      expect(next).not.toBe(e);
      expect(e.status).toBe('open'); // immutable
    });

    it('open → resolved 跳级合法', () => {
      const e = Escalation.fromProps(baseProps());
      expect(e.resolve().status).toBe('resolved');
    });

    it('acknowledged → resolved → closed 单向链式推进', () => {
      const e = Escalation.fromProps(baseProps()).acknowledge().resolve().close();
      expect(e.status).toBe('closed');
      expect(e.isTerminal).toBe(true);
    });

    it('resolved → acknowledged 回退抛错', () => {
      const e = Escalation.fromProps({ ...baseProps(), status: 'resolved' });
      expect(() => e.acknowledge()).toThrow(/回退禁止/);
    });

    it('closed → open 回退抛错', () => {
      const e = Escalation.fromProps({ ...baseProps(), status: 'closed' });
      expect(() => e.transition('open')).toThrow(/回退禁止/);
    });

    it('相同 status 幂等允许', () => {
      const e = Escalation.fromProps(baseProps());
      expect(e.transition('open').status).toBe('open');
    });

    it('resolve 合并 metadataPatch', () => {
      const e = Escalation.fromProps(baseProps());
      const next = e.resolve({ resolution: '已处理', handler: 'u1' });
      expect(next.metadata).toEqual({ source: 'monitor', resolution: '已处理', handler: 'u1' });
    });

    it('transition 刷新 updatedAt', () => {
      const e = Escalation.fromProps(baseProps());
      const next = e.acknowledge();
      expect(next.updatedAt.getTime()).toBeGreaterThanOrEqual(e.updatedAt.getTime());
    });
  });

  describe('toProps round-trip', () => {
    it('fromProps(toProps()) 恒等', () => {
      const e = Escalation.fromProps(baseProps());
      expect(Escalation.fromProps(e.toProps()).toProps()).toEqual(e.toProps());
    });
  });
});
