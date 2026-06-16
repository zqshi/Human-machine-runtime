import { describe, it, expect } from 'vitest';
import { describeCron } from './cron.js';

describe('describeCron', () => {
  it('全 * → 每分钟执行', () => {
    expect(describeCron('* * * * *')).toBe('每分钟执行');
  });

  it('*/N 分 → 每 N 分钟执行', () => {
    expect(describeCron('*/5 * * * *')).toBe('每 5 分钟执行');
    expect(describeCron('*/30 * * * *')).toBe('每 30 分钟执行');
  });

  it('每天 H:M', () => {
    expect(describeCron('30 9 * * *')).toBe('每天 09:30 执行');
    expect(describeCron('0 0 * * *')).toBe('每天 00:00 执行');
  });

  it('每周X H:M（dow=1..6）', () => {
    expect(describeCron('0 9 * * 1')).toBe('每周一 09:00 执行');
    expect(describeCron('0 9 * * 5')).toBe('每周五 09:00 执行');
  });

  it('周日（dow=0 或 7）', () => {
    expect(describeCron('0 9 * * 0')).toBe('每周日 09:00 执行');
    expect(describeCron('0 9 * * 7')).toBe('每周日 09:00 执行');
  });

  it('每月 D 日 H:M', () => {
    expect(describeCron('0 0 1 * *')).toBe('每月 1 日 00:00 执行');
    expect(describeCron('30 18 15 * *')).toBe('每月 15 日 18:30 执行');
  });

  it('复杂表达式（列表）→ fallback 原表达式', () => {
    expect(describeCron('0,30 9 * * *')).toBe('0,30 9 * * *');
  });

  it('非 5 段 → fallback 原表达式', () => {
    expect(describeCron('* * *')).toBe('* * *');
    expect(describeCron('')).toBe('');
  });
});
