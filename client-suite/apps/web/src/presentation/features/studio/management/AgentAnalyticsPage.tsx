/**
 * AgentAnalyticsPage — 运营监控
 *
 * 时间范围选择器 / 指标卡片 / 对话趋势图 / 热门查询
 *
 * 去mock:接 analyticsApi 真接口(logStats 调用统计 + dauTrend 对话趋势)。
 * 热门查询无真接口(analytics 无 top-queries 端点)→ 空态,接真接口后恢复。
 */
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { analyticsApi } from '../../../../application/services/adminApi';

type TimeRange = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

interface Metrics {
  conversations: number;
  activeUsers: number;
  avgResponseMs: number;
  satisfaction: number;
}

interface TrendData {
  days: string[];
  values: number[];
}

const EMPTY_TREND: TrendData = { days: [], values: [] };

export function AgentAnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [metrics, setMetrics] = useState<Metrics>({
    conversations: 0,
    activeUsers: 0,
    avgResponseMs: 0,
    satisfaction: 0,
  });
  const [trend, setTrend] = useState<TrendData>(EMPTY_TREND);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: TimeRange) => {
    const days = RANGE_DAYS[r];
    setLoading(true);
    try {
      const [stats, dau] = await Promise.all([
        analyticsApi.logStats({ days }).catch(() => ({})),
        analyticsApi.dauTrend(days).catch(() => EMPTY_TREND),
      ]);
      // logStats 后端返 { totalCalls, successCalls, avgDurationMs, ... }
      const s = stats as Record<string, unknown>;
      setMetrics({
        conversations: Number(s.totalCalls ?? 0),
        activeUsers: Number(s.activeUsers ?? 0),
        avgResponseMs: Number(s.avgDurationMs ?? 0),
        satisfaction: 0, // 无满意度指标,0 表示未采集
      });
      setTrend((dau as TrendData) ?? EMPTY_TREND);
    } catch {
      // 容错:保持空态
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  const maxTrend = trend.values.length > 0 ? Math.max(...trend.values) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center justify-between px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <h2 className="text-[14px] font-semibold text-slate-100">运营监控</h2>
        <div className="flex items-center gap-1">
          {(['7d', '30d', '90d'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                range === r
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              {r === '7d' ? '7 天' : r === '30d' ? '30 天' : '90 天'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 hmr-scrollbar">
        {/* 指标卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: '对话总数',
              value: metrics.conversations.toLocaleString(),
              icon: 'chat',
              color: 'text-sky-400',
            },
            {
              label: '活跃用户',
              value: metrics.activeUsers.toLocaleString(),
              icon: 'people',
              color: 'text-emerald-400',
            },
            {
              label: '平均响应',
              value: metrics.avgResponseMs > 0 ? `${metrics.avgResponseMs}ms` : '—',
              icon: 'timer',
              color: 'text-amber-400',
            },
            {
              label: '满意度',
              value: metrics.satisfaction > 0 ? `${metrics.satisfaction}/5` : '未采集',
              icon: 'star',
              color: 'text-purple-400',
            },
          ].map((m) => (
            <div
              key={m.label}
              className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon name={m.icon} size={14} className="text-slate-500" />
                <span className="text-[10px] text-slate-400">{m.label}</span>
              </div>
              <div className={`text-[20px] font-bold ${m.color}`}>{loading ? '—' : m.value}</div>
            </div>
          ))}
        </div>

        {/* 对话趋势(DAU) */}
        <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4 mb-6">
          <div className="text-[12px] font-semibold text-slate-100 mb-4">对话趋势(DAU)</div>
          {trend.values.length > 0 ? (
            <div className="flex items-end gap-[2px] h-[120px]">
              {trend.values.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/40 hover:bg-primary/70 rounded-t-sm transition-colors cursor-pointer"
                  style={{ height: maxTrend > 0 ? `${(v / maxTrend) * 100}%` : '0%' }}
                  title={`${trend.days[i] ?? ''}: ${v} 次对话`}
                />
              ))}
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-slate-500 text-sm">
              {loading ? '加载中...' : '暂无趋势数据'}
            </div>
          )}
        </div>

        {/* 热门查询:无真接口(analytics 无 top-queries 端点),空态 */}
        <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4 w-full max-w-3xl">
          <div className="text-[12px] font-semibold text-slate-100 mb-3">热门查询</div>
          <div className="py-8 text-center text-slate-500 text-sm">
            暂无热门查询数据(待接 top-queries 端点)
          </div>
        </div>
      </div>
    </div>
  );
}
