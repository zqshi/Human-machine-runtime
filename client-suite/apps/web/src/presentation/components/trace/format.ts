/**
 * Trace 格式化辅助 — 与 SpanWaterfall 组件分离，保证组件文件仅导出组件
 * （满足 react-refresh/only-export-components，支持 Fast Refresh）。
 */

const CHAIN_COLOR: Record<string, string> = {
  success: 'bg-green-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  error: 'bg-red-500',
  blocked: 'bg-yellow-500',
  skipped: 'bg-gray-300',
  unknown: 'bg-gray-400',
};

export function fmtDuration(ms: unknown): string {
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${Math.max(0, Math.round(n))}ms`;
}

export function fmtTime(t: unknown): string {
  if (!t) return '—';
  const d = new Date(String(t));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function stageColor(status: unknown): string {
  return CHAIN_COLOR[String(status)] || CHAIN_COLOR.unknown;
}
