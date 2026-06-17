import { buildTimeRange } from './logsFilters';

/**
 * ⚠️ 临时 MOCK：后端（:3002）未启动时用于查看日志页 UI。
 * 验证完成后请删除本文件，并把 LogsSection 中的 USE_MOCK 改回 false。
 */

export interface MockLog {
  id: string;
  type: string;
  action: string;
  at: string;
  actor: { username: string; role: string } | null;
  where: { ip: string; userAgent: string };
  target: { type: string; name: string; id: string } | null;
  result: { success: boolean; reason?: string } | null;
  requestId: string;
  traceId: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

// 按 at 倒序（最新在前），时间集中在 2026-06-15 ~ 2026-06-17，便于验证日期筛选
export const MOCK_LOGS: MockLog[] = [
  {
    id: 'audit-013',
    type: 'login',
    action: 'login',
    at: '2026-06-17T09:12:33.000Z',
    actor: { username: 'admin', role: 'platform_admin' },
    where: { ip: '10.0.1.5', userAgent: 'Chrome 121 / macOS' },
    target: null,
    result: { success: true },
    requestId: 'req-013',
    traceId: 'trace-013',
    payload: {},
  },
  {
    id: 'audit-012',
    type: 'employee.create',
    action: 'employee.create',
    at: '2026-06-17T10:30:08.000Z',
    actor: { username: 'admin', role: 'platform_admin' },
    where: { ip: '10.0.1.5', userAgent: 'Chrome 121 / macOS' },
    target: { type: '员工', name: '客服小蜜', id: 'emp-101' },
    result: { success: true },
    requestId: 'req-012',
    traceId: 'trace-012',
    payload: { employeeId: 'emp-101' },
  },
  {
    id: 'audit-011',
    type: 'skill.update',
    action: 'skill.update',
    at: '2026-06-17T11:45:51.000Z',
    actor: { username: 'zhangsan', role: 'tenant_admin' },
    where: { ip: '10.0.2.18', userAgent: 'Safari 17 / macOS' },
    target: { type: '技能', name: '工单分类', id: 'skill-22' },
    result: { success: true },
    requestId: 'req-011',
    traceId: 'trace-011',
    payload: { skillId: 'skill-22' },
  },
  {
    id: 'audit-010',
    type: 'auth.user.delete',
    action: 'auth.user.delete',
    at: '2026-06-17T14:20:14.000Z',
    actor: { username: 'admin', role: 'platform_admin' },
    where: { ip: '10.0.1.5', userAgent: 'Chrome 121 / macOS' },
    target: { type: '用户', name: 'wangwu', id: 'usr-7' },
    result: { success: false, reason: '该用户存在进行中的任务，无法删除' },
    requestId: 'req-010',
    traceId: 'trace-010',
    payload: {},
  },
  {
    id: 'audit-009',
    type: 'gateway.config.update',
    action: 'gateway.config.update',
    at: '2026-06-17T16:05:40.000Z',
    actor: { username: 'lisi', role: 'operator' },
    where: { ip: '10.0.3.9', userAgent: 'Firefox 124 / Windows' },
    target: { type: '网关', name: '默认网关', id: 'gw-1' },
    result: { success: true },
    requestId: 'req-009',
    traceId: 'trace-009',
    payload: {},
  },
  {
    id: 'audit-008',
    type: 'config.update',
    action: 'config.update',
    at: '2026-06-16T09:00:22.000Z',
    actor: { username: 'admin', role: 'platform_admin' },
    where: { ip: '10.0.1.5', userAgent: 'Chrome 121 / macOS' },
    target: { type: '配置', name: 'SSO 开关', id: 'cfg-sso' },
    result: { success: true },
    requestId: 'req-008',
    traceId: 'trace-008',
    payload: {},
  },
  {
    id: 'audit-007',
    type: 'tenant.suspend',
    action: 'tenant.suspend',
    at: '2026-06-16T13:30:55.000Z',
    actor: { username: 'admin', role: 'platform_admin' },
    where: { ip: '10.0.1.5', userAgent: 'Chrome 121 / macOS' },
    target: { type: '租户', name: '某企业A', id: 'tnt-2' },
    result: { success: true },
    requestId: 'req-007',
    traceId: 'trace-007',
    payload: { tenantId: 'tnt-2' },
  },
  {
    id: 'audit-006',
    type: 'login',
    action: 'login',
    at: '2026-06-16T17:50:10.000Z',
    actor: { username: 'unknown', role: '-' },
    where: { ip: '203.0.113.7', userAgent: 'curl/8.4.0' },
    target: null,
    result: { success: false, reason: '密码错误，连续第 3 次' },
    requestId: 'req-006',
    traceId: 'trace-006',
    payload: {},
  },
  {
    id: 'audit-005',
    type: 'skill.publish',
    action: 'skill.publish',
    at: '2026-06-15T10:15:30.000Z',
    actor: { username: 'zhangsan', role: 'tenant_admin' },
    where: { ip: '10.0.2.18', userAgent: 'Safari 17 / macOS' },
    target: { type: '技能', name: '邮件起草', id: 'skill-31' },
    result: { success: true },
    requestId: 'req-005',
    traceId: 'trace-005',
    payload: { skillId: 'skill-31' },
  },
  {
    id: 'audit-004',
    type: 'tool.approve',
    action: 'tool.approve',
    at: '2026-06-15T15:40:12.000Z',
    actor: { username: 'admin', role: 'platform_admin' },
    where: { ip: '10.0.1.5', userAgent: 'Chrome 121 / macOS' },
    target: { type: '工具', name: '网页抓取', id: 'tool-9' },
    result: { success: true },
    requestId: 'req-004',
    traceId: 'trace-004',
    payload: {},
  },
];

/** 前端模拟"操作人模糊 + 时间范围"筛选，便于验证交互效果。 */
export function mockFilterLogs(logs: MockLog[], filters: Record<string, string>): MockLog[] {
  let r = logs;
  const actor = (filters.actor || '').trim().toLowerCase();
  if (actor) {
    r = r.filter((l) => (l.actor?.username || '').toLowerCase().includes(actor));
  }
  const tr = buildTimeRange(filters.dateFrom || '', filters.dateTo || '');
  if (tr) {
    const [from, to] = tr.split(',');
    const fromTs = from ? Date.parse(from) : null;
    const toTs = to ? Date.parse(to) : null;
    r = r.filter((l) => {
      const t = Date.parse(l.at);
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      return true;
    });
  }
  return r;
}
