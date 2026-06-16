import { useState, useEffect, useCallback } from 'react';
import { openclawStatisticsApi } from '../../../application/services/adminApi';
import { Icon } from '../../components/ui/Icon';

type TrendData = { days: string[]; values: number[] };

interface WeeklyMetrics {
  dau: TrendData;
  messages: TrendData;
  tokens: TrendData;
  retention: TrendData;
}

type Period = 'this-week' | 'last-week' | 'last-2-weeks';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekRange(period: Period): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = getMonday(today);

  if (period === 'this-week') {
    return {
      startDate: thisMonday.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
  }
  if (period === 'last-week') {
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(lastSunday.getDate() - 1);
    return {
      startDate: lastMonday.toISOString().split('T')[0],
      endDate: lastSunday.toISOString().split('T')[0],
    };
  }
  // last-2-weeks
  const twoWeeksAgoMonday = new Date(thisMonday);
  twoWeeksAgoMonday.setDate(twoWeeksAgoMonday.getDate() - 7);
  return {
    startDate: twoWeeksAgoMonday.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  };
}

export function OpsWeeklySection() {
  const [period, setPeriod] = useState<Period>('this-week');
  const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(() => {
    setRefreshing(true);
    const range = getWeekRange(period);
    const opts = { startDate: range.startDate, endDate: range.endDate };
    Promise.all([
      openclawStatisticsApi.dau(opts),
      openclawStatisticsApi.messages(opts),
      openclawStatisticsApi.tokens(opts),
      openclawStatisticsApi.retention(opts),
    ])
      .then(([dau, messages, tokens, retention]) => {
        setMetrics({
          dau: dau as TrendData,
          messages: messages as TrendData,
          tokens: tokens as TrendData,
          retention: retention as TrendData,
        });
      })
      .catch(() => {})
      .finally(() => {
        setInitialLoading(false);
        setRefreshing(false);
      });
  }, [period]);

  useEffect(fetchData, [fetchData]);

  if (initialLoading || !metrics) {
    return <div className="p-6 text-gray-400 text-sm text-center py-8">加载中...</div>;
  }

  const weekDau = metrics.dau.values;
  const weekMsg = metrics.messages.values;
  const weekTokens = metrics.tokens.values;
  const weekRetention = metrics.retention.values;
  const weekDays = metrics.dau.days;

  const avgDau =
    weekDau.length > 0 ? Math.round(weekDau.reduce((a, b) => a + b, 0) / weekDau.length) : 0;
  const totalMsg = weekMsg.reduce((a, b) => a + b, 0);
  const totalTokens = weekTokens.reduce((a, b) => a + b, 0);
  const avgRetention =
    weekRetention.length > 0
      ? (weekRetention.reduce((a, b) => a + b, 0) / weekRetention.length).toFixed(1)
      : '0';
  const peakDau = Math.max(...weekDau, 0);
  const peakDay = weekDau.indexOf(peakDau);
  const peakDayLabel = weekDays[peakDay] || '--';

  const summaryItems = [
    { label: '日均 DAU', value: avgDau, icon: 'group', color: '#007AFF' },
    {
      label: '峰值 DAU',
      value: `${peakDau} (${peakDayLabel})`,
      icon: 'trending_up',
      color: '#34C759',
    },
    { label: '总消息量', value: totalMsg.toLocaleString(), icon: 'chat_bubble', color: '#AF52DE' },
    { label: '总 Token', value: formatTokens(totalTokens), icon: 'token', color: '#FF9500' },
    { label: '平均留存率', value: `${avgRetention}%`, icon: 'autorenew', color: '#5856D6' },
    {
      label: '日均消息',
      value: weekMsg.length > 0 ? Math.round(totalMsg / weekMsg.length) : 0,
      icon: 'mark_chat_read',
      color: '#FF3B30',
    },
  ];

  return (
    <div
      className={`p-6 space-y-5 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">运营周报</h1>
          <p className="text-xs text-gray-400 mt-0.5">AI 辅助生成的运营数据周报摘要</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <Icon name="sync" size={14} className="text-gray-400 animate-spin" />}
          {(
            [
              ['this-week', '本周'],
              ['last-week', '上周'],
              ['last-2-weeks', '近两周'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                period === key
                  ? 'bg-[#007AFF] text-white'
                  : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-6 gap-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${item.color}12` }}
              >
                <Icon name={item.icon} size={16} style={{ color: item.color }} />
              </div>
            </div>
            <div className="text-[11px] text-gray-400">{item.label}</div>
            <div className="text-xl font-bold text-gray-800 tabular-nums">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Daily Sparkline Table */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1.5">
          <Icon name="calendar_month" size={16} className="text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700">每日数据明细</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">日期</th>
              <th className="px-4 py-2 text-right font-medium">DAU</th>
              <th className="px-4 py-2 text-right font-medium">消息</th>
              <th className="px-4 py-2 text-right font-medium">Token</th>
              <th className="px-4 py-2 text-right font-medium">留存率</th>
              <th className="px-4 py-2 text-left font-medium">DAU 走势</th>
            </tr>
          </thead>
          <tbody>
            {weekDays.map((day, i) => {
              const barW = peakDau > 0 ? (weekDau[i] / peakDau) * 100 : 0;
              return (
                <tr key={day} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 text-gray-600">{day}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-800 font-medium">
                    {weekDau[i]}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {weekMsg[i]?.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {formatTokens(weekTokens[i] || 0)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {weekRetention[i]}%
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#007AFF] rounded-full"
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AI Summary Block */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
          <Icon name="auto_awesome" size={16} className="text-purple-500" />
          AI 周报摘要
        </h3>
        <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-4 text-sm text-gray-700 leading-relaxed space-y-2">
          <p>
            <strong>用户活跃度：</strong>
            {avgDau > 0
              ? `本周日均 DAU ${avgDau}，峰值出现在 ${peakDayLabel}（${peakDau} 人）。`
              : '暂无足够数据生成分析。'}
          </p>
          <p>
            <strong>资源消耗：</strong>
            {totalTokens > 0
              ? `累计消耗 ${formatTokens(totalTokens)} Token，日均 ${formatTokens(Math.round(totalTokens / (weekTokens.length || 1)))}。`
              : '暂无 Token 消耗数据。'}
          </p>
          <p>
            <strong>用户留存：</strong>
            {Number(avgRetention) > 0
              ? `平均留存率 ${avgRetention}%，${Number(avgRetention) >= 50 ? '用户粘性良好' : '建议关注留存率下降趋势'}。`
              : '暂无留存数据。'}
          </p>
          <p>
            <strong>消息互动：</strong>
            {totalMsg > 0
              ? `本周产生 ${totalMsg.toLocaleString()} 条消息，日均 ${Math.round(totalMsg / (weekMsg.length || 1))} 条。`
              : '暂无消息数据。'}
          </p>
        </div>
      </div>

      {/* Heatmap-style Activity Grid */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
          <Icon name="grid_view" size={16} className="text-gray-400" />
          活跃度热力图
        </h3>
        <div className="flex gap-1 items-end">
          {weekDays.map((day, i) => {
            const intensity = peakDau > 0 ? weekDau[i] / peakDau : 0;
            const h = 20 + intensity * 80;
            return (
              <div key={day} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${h}px`,
                    background: `rgba(0, 122, 255, ${0.15 + intensity * 0.7})`,
                  }}
                  title={`${day}: ${weekDau[i]} DAU`}
                />
                <span className="text-[10px] text-gray-400">{day.slice(-5)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
