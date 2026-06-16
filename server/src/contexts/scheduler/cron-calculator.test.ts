import { describe, it, expect } from 'vitest';
import { CronExpressionCalculator } from './cron-calculator.js';

const calc = new CronExpressionCalculator();
const TZ = 'Asia/Shanghai';
// 固定基准时间，避免依赖当前时间（宪章：测试禁止依赖执行时刻）
const FROM = new Date('2026-06-15T00:00:00Z');

describe('CronExpressionCalculator', () => {
  it('validate 合法表达式 → valid:true', () => {
    expect(calc.validate('0 9 * * 1', TZ)).toEqual({ valid: true });
    expect(calc.validate('*/5 * * * *')).toEqual({ valid: true });
  });

  it('validate 非法表达式 → valid:false + error', () => {
    const r = calc.validate('not a cron', TZ);
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('nextRunAt 返回基准之后的未来时间', () => {
    const d = calc.nextRunAt('*/5 * * * *', TZ, FROM);
    expect(d.getTime()).toBeGreaterThan(FROM.getTime());
  });

  it('nextRunAt 周一 9:00 CST（=01:00 UTC）', () => {
    const d = calc.nextRunAt('0 9 * * 1', TZ, FROM);
    expect(d.getTime()).toBeGreaterThan(FROM.getTime());
    expect(d.getUTCHours()).toBe(1); // 09:00 CST == 01:00 UTC
  });

  it('nextOccurrences 返回 N 个严格递增时间', () => {
    const arr = calc.nextOccurrences('*/5 * * * *', TZ, 3, FROM);
    expect(arr).toHaveLength(3);
    expect(arr[1].getTime()).toBeGreaterThan(arr[0].getTime());
    expect(arr[2].getTime()).toBeGreaterThan(arr[1].getTime());
  });

  it('nextOccurrences 间隔任务相邻 5 分钟', () => {
    const [a, b] = calc.nextOccurrences('*/5 * * * *', TZ, 2, FROM);
    expect(b.getTime() - a.getTime()).toBe(5 * 60_000);
  });
});
