import { describe, it, expect } from 'vitest';
import { EmergentSignal } from './emergent-signal.js';

describe('EmergentSignal', () => {
  const FIXED_DETECTED = 1_700_000_000_000;

  describe('create', () => {
    it('新建 detected 信号，id emg- 前缀 + detectedAt 设置', () => {
      const sig = EmergentSignal.create({
        pattern: '三方向 Agent 齐遇阻力',
        severity: 'high',
        detectedAt: FIXED_DETECTED,
      });
      expect(sig.id).toMatch(/^emg-/);
      expect(sig.status).toBe('detected');
      expect(sig.detectedAt).toBe(FIXED_DETECTED);
      expect(sig.severity).toBe('high');
      expect(sig.correlatedSignalIds).toEqual([]);
      expect(sig.isActive).toBe(true);
      expect(sig.isHighSeverity).toBe(true);
    });

    it('携带 patternId/correlatedSignalIds/suggestedAction/tenantId', () => {
      const sig = EmergentSignal.create({
        pattern: 'p',
        severity: 'medium',
        patternId: 'pat-1',
        correlatedSignalIds: ['sig-a', 'sig-b'],
        suggestedAction: '人工复核',
        tenantId: 't1',
      });
      expect(sig.patternId).toBe('pat-1');
      expect(sig.correlatedCount).toBe(2);
      expect(sig.suggestedAction).toBe('人工复核');
      expect(sig.tenantId).toBe('t1');
    });

    it('非法 severity 抛错', () => {
      expect(() => EmergentSignal.create({ pattern: 'p', severity: 'urgent' as never })).toThrow(
        /invalid severity/
      );
    });
  });

  describe('fromProps', () => {
    const baseProps = {
      id: 'emg-1',
      pattern: 'p',
      severity: 'critical',
      status: 'acknowledged' as const,
      detectedAt: FIXED_DETECTED,
      correlatedSignalIds: ['s1'],
      createdAt: new Date(FIXED_DETECTED),
      updatedAt: new Date(FIXED_DETECTED),
    };

    it('从持久化 props 重建', () => {
      const sig = EmergentSignal.fromProps(baseProps);
      expect(sig.id).toBe('emg-1');
      expect(sig.status).toBe('acknowledged');
      expect(sig.severity).toBe('critical');
      expect(sig.correlatedCount).toBe(1);
    });

    it('非法 status 脏数据拒建', () => {
      expect(() => EmergentSignal.fromProps({ ...baseProps, status: 'unknown' as never })).toThrow(
        /invalid status/
      );
    });

    it('非法 severity 脏数据拒建', () => {
      expect(() => EmergentSignal.fromProps({ ...baseProps, severity: 'urgent' as never })).toThrow(
        /invalid severity/
      );
    });

    it('toProps 往返等价', () => {
      const sig = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      });
      const roundtrip = EmergentSignal.fromProps(sig.toProps());
      expect(roundtrip.toProps()).toEqual(sig.toProps());
    });
  });

  describe('状态机', () => {
    it('acknowledge: detected→acknowledged，原实例不变(immutable)', () => {
      const sig = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      });
      const ack = sig.acknowledge();
      expect(ack.status).toBe('acknowledged');
      expect(sig.status).toBe('detected'); // immutable：原实例不变
      expect(ack.isActive).toBe(true);
    });

    it('acknowledge 非 detected 抛错', () => {
      const ack = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      }).acknowledge();
      expect(() => ack.acknowledge()).toThrow(/cannot acknowledge/);
    });

    it('resolve: →resolved + resolvedAt 设 + isActive false', () => {
      const sig = EmergentSignal.create({
        pattern: 'p',
        severity: 'high',
        detectedAt: FIXED_DETECTED,
      });
      const res = sig.resolve();
      expect(res.status).toBe('resolved');
      expect(res.resolvedAt).toBeTypeOf('number');
      expect(res.isActive).toBe(false);
    });

    it('dismiss: →dismissed + resolvedAt 设', () => {
      const sig = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      });
      const dis = sig.dismiss();
      expect(dis.status).toBe('dismissed');
      expect(dis.resolvedAt).toBeTypeOf('number');
    });

    it('已终结状态 resolve/dismiss 抛错', () => {
      const resolved = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      }).resolve();
      expect(() => resolved.resolve()).toThrow(/terminal status/);
      expect(() => resolved.dismiss()).toThrow(/terminal status/);
    });

    it('acknowledged 可 resolve（非 detected 也能终结）', () => {
      const ack = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      }).acknowledge();
      const res = ack.resolve();
      expect(res.status).toBe('resolved');
    });
  });

  describe('派生属性', () => {
    it('isHighSeverity: high/critical true, low/medium false', () => {
      expect(
        EmergentSignal.create({ pattern: 'p', severity: 'high', detectedAt: FIXED_DETECTED })
          .isHighSeverity
      ).toBe(true);
      expect(
        EmergentSignal.create({ pattern: 'p', severity: 'critical', detectedAt: FIXED_DETECTED })
          .isHighSeverity
      ).toBe(true);
      expect(
        EmergentSignal.create({ pattern: 'p', severity: 'low', detectedAt: FIXED_DETECTED })
          .isHighSeverity
      ).toBe(false);
      expect(
        EmergentSignal.create({ pattern: 'p', severity: 'medium', detectedAt: FIXED_DETECTED })
          .isHighSeverity
      ).toBe(false);
    });

    it('isActive: resolved/dismissed false', () => {
      const sig = EmergentSignal.create({
        pattern: 'p',
        severity: 'low',
        detectedAt: FIXED_DETECTED,
      });
      expect(sig.isActive).toBe(true);
      expect(sig.resolve().isActive).toBe(false);
      expect(
        EmergentSignal.create({
          pattern: 'p',
          severity: 'low',
          detectedAt: FIXED_DETECTED,
        }).dismiss().isActive
      ).toBe(false);
    });
  });
});
