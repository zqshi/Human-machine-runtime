/**
 * AgentAnalyticsPage — 运营监控
 *
 * 时间范围选择器 / 指标卡片 / 对话趋势图 / 热门查询 Top 5
 */
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';

type TimeRange = '7d' | '30d' | '90d';

const MOCK_METRICS = {
  '7d': { conversations: 342, activeUsers: 89, avgResponseMs: 1200, satisfaction: 4.5 },
  '30d': { conversations: 1580, activeUsers: 210, avgResponseMs: 1100, satisfaction: 4.3 },
  '90d': { conversations: 4260, activeUsers: 385, avgResponseMs: 1250, satisfaction: 4.2 },
};

const MOCK_TOP_QUERIES = [
  { query: '帮我优化这条 SQL', count: 67 },
  { query: '为什么这个查询慢？', count: 45 },
  { query: '添加索引的最佳实践', count: 38 },
  { query: '解释执行计划', count: 31 },
  { query: '如何减少全表扫描', count: 24 },
];

// 模拟趋势数据
function mockTrend(range: TimeRange): number[] {
  const len = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return Array.from({ length: len }, () => Math.floor(Math.random() * 80) + 20);
}

export function AgentAnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const metrics = MOCK_METRICS[range];
  const trend = mockTrend(range);
  const maxTrend = Math.max(...trend);

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
              value: `${metrics.avgResponseMs}ms`,
              icon: 'timer',
              color: 'text-amber-400',
            },
            {
              label: '满意度',
              value: `${metrics.satisfaction}/5`,
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
              <div className={`text-[20px] font-bold ${m.color}`}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* 对话趋势 */}
        <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4 mb-6">
          <div className="text-[12px] font-semibold text-slate-100 mb-4">对话趋势</div>
          <div className="flex items-end gap-[2px] h-[120px]">
            {trend.map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/40 hover:bg-primary/70 rounded-t-sm transition-colors cursor-pointer"
                style={{ height: `${(v / maxTrend) * 100}%` }}
                title={`${v} 次对话`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-slate-500">
            <span>{range === '7d' ? '7 天前' : range === '30d' ? '30 天前' : '90 天前'}</span>
            <span>今天</span>
          </div>
        </div>

        {/* 热门查询 Top 5 */}
        <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4 w-full max-w-3xl">
          <div className="text-[12px] font-semibold text-slate-100 mb-3">热门查询 Top 5</div>
          <div className="space-y-2">
            {MOCK_TOP_QUERIES.map((q, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-200 truncate">{q.query}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(q.count / MOCK_TOP_QUERIES[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 w-6 text-right">{q.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
