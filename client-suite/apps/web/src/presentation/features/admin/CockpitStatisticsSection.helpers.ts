export type TrendData = { days: string[]; values: number[] };
export type LatencyData = { days: string[]; p50: number[]; p95: number[]; avg: number[] };
export type SpendUser = {
  userId: string;
  count: number;
  totalTokens: number;
  estimatedCost: number;
};

export type ModalPanel =
  | 'dau'
  | 'messages'
  | 'retention'
  | 'tokens'
  | 'dept'
  | 'users'
  | 'spend'
  | 'latency'
  | 'error'
  | null;

export function fmtTk(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function trendPts(d: TrendData) {
  return d.days.map((day, i) => ({ label: day, value: d.values[i] || 0 }));
}

export function modalConfig(panel: NonNullable<ModalPanel>) {
  const map: Record<NonNullable<ModalPanel>, { title: string; icon: string }> = {
    dau: { title: 'DAU 趋势', icon: 'show_chart' },
    messages: { title: '消息量趋势', icon: 'show_chart' },
    retention: { title: '留存率趋势 (%)', icon: 'show_chart' },
    tokens: { title: 'Token 消耗趋势', icon: 'show_chart' },
    latency: { title: '响应时长 P50 / P95', icon: 'speed' },
    error: { title: '错误率趋势 (%)', icon: 'error_outline' },
    dept: { title: '部门 Token 消耗 Top 20', icon: 'leaderboard' },
    users: { title: '活跃用户 Top 20', icon: 'person' },
    spend: { title: '用户花费 Top 20', icon: 'payments' },
  };
  return map[panel];
}
