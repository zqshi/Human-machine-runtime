import { describe, it, expect, beforeEach, vi } from 'vitest';

let mod: typeof import('../adminStore');

beforeEach(async () => {
  vi.resetModules();
  mod = await import('../adminStore');
});

describe('computeThisWeekRange（自然周 周一~周日）', () => {
  // 用 new Date(年, 月-1, 日) 构造本地日期，避免日期串被解析为 UTC 午夜后跨时区解读不一致
  it('周六落在周中段，回到本周一', () => {
    expect(mod.computeThisWeekRange(new Date(2026, 5, 13))).toEqual({
      from: '2026-06-08',
      to: '2026-06-14',
    });
  });

  it('周一当天即为本周起点', () => {
    expect(mod.computeThisWeekRange(new Date(2026, 5, 8))).toEqual({
      from: '2026-06-08',
      to: '2026-06-14',
    });
  });

  it('周中（周三）回到本周一', () => {
    expect(mod.computeThisWeekRange(new Date(2026, 5, 10))).toEqual({
      from: '2026-06-08',
      to: '2026-06-14',
    });
  });

  it('周日归属本周而非下周', () => {
    expect(mod.computeThisWeekRange(new Date(2026, 5, 14))).toEqual({
      from: '2026-06-08',
      to: '2026-06-14',
    });
  });

  it('下周一进入新的自然周', () => {
    expect(mod.computeThisWeekRange(new Date(2026, 5, 15))).toEqual({
      from: '2026-06-15',
      to: '2026-06-21',
    });
  });

  it('跨月周正常计算（6/1 恰为周一）', () => {
    expect(mod.computeThisWeekRange(new Date(2026, 5, 1))).toEqual({
      from: '2026-06-01',
      to: '2026-06-07',
    });
  });
});

describe('computeRecentDaysRange', () => {
  it('近 N 天含今天', () => {
    expect(mod.computeRecentDaysRange(7, new Date(2026, 5, 13))).toEqual({
      from: '2026-06-06',
      to: '2026-06-13',
    });
  });
});

describe('aiGateway 日期范围 store', () => {
  it('初始值默认为本周', () => {
    const s = mod.useAdminStore.getState();
    const week = mod.computeThisWeekRange();
    expect(s.aiGatewayDateFrom).toBe(week.from);
    expect(s.aiGatewayDateTo).toBe(week.to);
  });

  it('setAIGatewayDateAll 清空范围', () => {
    mod.useAdminStore.getState().setAIGatewayDateAll();
    const s = mod.useAdminStore.getState();
    expect(s.aiGatewayDateFrom).toBe('');
    expect(s.aiGatewayDateTo).toBe('');
  });

  it('setAIGatewayDateThisWeek 从清空态回到本周', () => {
    mod.useAdminStore.getState().setAIGatewayDateAll();
    mod.useAdminStore.getState().setAIGatewayDateThisWeek();
    const s = mod.useAdminStore.getState();
    const week = mod.computeThisWeekRange();
    expect(s.aiGatewayDateFrom).toBe(week.from);
    expect(s.aiGatewayDateTo).toBe(week.to);
  });

  it('setAIGatewayDateRecentDays 设置近 N 天', () => {
    mod.useAdminStore.getState().setAIGatewayDateRecentDays(30);
    const s = mod.useAdminStore.getState();
    const range = mod.computeRecentDaysRange(30);
    expect(s.aiGatewayDateFrom).toBe(range.from);
    expect(s.aiGatewayDateTo).toBe(range.to);
  });

  it('setAIGatewayDateRange 设置任意范围', () => {
    mod.useAdminStore.getState().setAIGatewayDateRange('2020-01-01', '2020-12-31');
    const s = mod.useAdminStore.getState();
    expect(s.aiGatewayDateFrom).toBe('2020-01-01');
    expect(s.aiGatewayDateTo).toBe('2020-12-31');
  });
});
