import { describe, it, expect } from 'vitest';
import { buildTimeRange } from './logsFilters';

describe('buildTimeRange', () => {
  it('起止均为空时不传 timeRange', () => {
    expect(buildTimeRange('', '')).toBeUndefined();
  });

  it('仅开始日期：from 补 00:00:00，to 留空', () => {
    expect(buildTimeRange('2026-06-17', '')).toBe('2026-06-17T00:00:00,');
  });

  it('仅结束日期：to 补 23:59:59，from 留空', () => {
    expect(buildTimeRange('', '2026-06-17')).toBe(',2026-06-17T23:59:59');
  });

  it('起止都有：from 取当天起点、to 取当天终点（避免漏结束日当天数据）', () => {
    expect(buildTimeRange('2026-06-01', '2026-06-17')).toBe(
      '2026-06-01T00:00:00,2026-06-17T23:59:59'
    );
  });
});
