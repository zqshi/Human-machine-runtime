import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '../formatTime';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatRelativeTime(0)).toBe('');
  });

  it('returns 刚刚 for < 60s ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 30_000)).toBe('刚刚');
  });

  it('returns N分钟前 for < 60 min', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5分钟前');
    expect(formatRelativeTime(now - 59 * 60_000)).toBe('59分钟前');
  });

  it('returns N小时前 for < 24h', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 3 * 3600_000)).toBe('3小时前');
    expect(formatRelativeTime(now - 23 * 3600_000)).toBe('23小时前');
  });

  it('returns N天前 for < 7 days', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 2 * 86_400_000)).toBe('2天前');
    expect(formatRelativeTime(now - 6 * 86_400_000)).toBe('6天前');
  });

  it('returns M/D for >= 7 days', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const ts = now - 10 * 86_400_000;
    const d = new Date(ts);
    expect(formatRelativeTime(ts)).toBe(`${d.getMonth() + 1}/${d.getDate()}`);
  });
});
