import { describe, it, expect } from 'vitest';
import { PushPolicy } from '../PushPolicy';

describe('PushPolicy', () => {
  describe('createDefault', () => {
    it('creates with standard matrix', () => {
      const policy = PushPolicy.createDefault();
      expect(policy.matrix.critical).toContain('toast');
      expect(policy.matrix.critical).toContain('sound');
      expect(policy.matrix.critical).toContain('desktop');
      expect(policy.matrix.low).toEqual(['badge']);
    });

    it('has quiet hours disabled by default', () => {
      const policy = PushPolicy.createDefault();
      expect(policy.quietHours.enabled).toBe(false);
    });
  });

  describe('getChannels', () => {
    it('returns channels for urgency when not in quiet hours', () => {
      const policy = PushPolicy.createDefault();
      const channels = policy.getChannels('critical');
      expect(channels).toContain('toast');
      expect(channels).toContain('sound');
    });

    it('returns empty when in quiet hours (non-critical)', () => {
      const policy = PushPolicy.createDefault().withQuietHours({
        enabled: true,
        startHour: 22,
        endHour: 8,
      });
      const lateNight = new Date('2026-05-07T23:00:00');
      expect(policy.getChannels('high', lateNight)).toEqual([]);
    });

    it('still pushes critical during quiet hours if override enabled', () => {
      const policy = PushPolicy.createDefault().withQuietHours({
        enabled: true,
        startHour: 22,
        endHour: 8,
        overrideForCritical: true,
      });
      const lateNight = new Date('2026-05-07T23:00:00');
      const channels = policy.getChannels('critical', lateNight);
      expect(channels.length).toBeGreaterThan(0);
    });

    it('blocks critical during quiet hours if override disabled', () => {
      const policy = PushPolicy.createDefault().withQuietHours({
        enabled: true,
        startHour: 22,
        endHour: 8,
        overrideForCritical: false,
      });
      const lateNight = new Date('2026-05-07T23:00:00');
      expect(policy.getChannels('critical', lateNight)).toEqual([]);
    });
  });

  describe('isInQuietHours', () => {
    it('returns false when disabled', () => {
      const policy = PushPolicy.createDefault();
      expect(policy.isInQuietHours(new Date('2026-05-07T23:00:00'))).toBe(false);
    });

    it('handles overnight range (22:00 - 08:00)', () => {
      const policy = PushPolicy.createDefault().withQuietHours({
        enabled: true,
        startHour: 22,
        endHour: 8,
      });
      expect(policy.isInQuietHours(new Date('2026-05-07T23:00:00'))).toBe(true);
      expect(policy.isInQuietHours(new Date('2026-05-08T02:00:00'))).toBe(true);
      expect(policy.isInQuietHours(new Date('2026-05-07T10:00:00'))).toBe(false);
    });

    it('handles same-day range (12:00 - 14:00)', () => {
      const policy = PushPolicy.createDefault().withQuietHours({
        enabled: true,
        startHour: 12,
        endHour: 14,
      });
      expect(policy.isInQuietHours(new Date('2026-05-07T13:00:00'))).toBe(true);
      expect(policy.isInQuietHours(new Date('2026-05-07T15:00:00'))).toBe(false);
    });
  });

  describe('shouldBatch', () => {
    it('never batches critical', () => {
      const policy = PushPolicy.createDefault();
      expect(policy.shouldBatch('critical')).toBe(false);
    });

    it('batches high/normal/low', () => {
      const policy = PushPolicy.createDefault();
      expect(policy.shouldBatch('high')).toBe(true);
      expect(policy.shouldBatch('normal')).toBe(true);
      expect(policy.shouldBatch('low')).toBe(true);
    });
  });

  describe('immutability', () => {
    it('withMatrix returns new instance', () => {
      const policy = PushPolicy.createDefault();
      const updated = policy.withMatrix({ low: ['toast'] });
      expect(updated.matrix.low).toEqual(['toast']);
      expect(policy.matrix.low).toEqual(['badge']);
    });

    it('round-trips via toProps/fromProps', () => {
      const policy = PushPolicy.createDefault().withBatchWindow(10000);
      const restored = PushPolicy.fromProps(policy.toProps());
      expect(restored.batchWindowMs).toBe(10000);
      expect(restored.matrix).toEqual(policy.matrix);
    });
  });
});
