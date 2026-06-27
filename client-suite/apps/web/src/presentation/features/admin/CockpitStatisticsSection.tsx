import { useState, useEffect, useCallback } from 'react';
import { cockpitStatisticsApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { LineChart } from '../../components/ui/SVGChart';
import { Icon } from '../../components/ui/Icon';
import {
  type TrendData,
  type LatencyData,
  type SpendUser,
  type ModalPanel,
  fmtTk,
  trendPts,
} from './CockpitStatisticsSection.helpers';
import {
  ChartCard,
  MiniDeptRank,
  MiniUserRank,
  MiniSpendRank,
  DataModal,
} from './CockpitStatisticsSection.parts';

export function CockpitStatisticsSection() {
  const [dau, setDau] = useState<TrendData>({ days: [], values: [] });
  const [messages, setMessages] = useState<TrendData>({ days: [], values: [] });
  const [retention, setRetention] = useState<TrendData>({ days: [], values: [] });
  const [deptTokens, setDeptTokens] = useState<Record<string, unknown>[]>([]);
  const [topUsers, setTopUsers] = useState<Record<string, unknown>[]>([]);
  const [topSpend, setTopSpend] = useState<SpendUser[]>([]);
  const [tokens, setTokens] = useState<TrendData>({ days: [], values: [] });
  const [latency, setLatency] = useState<LatencyData>({ days: [], p50: [], p95: [], avg: [] });
  const [errorRate, setErrorRate] = useState<TrendData>({ days: [], values: [] });
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(7);
  const [modal, setModal] = useState<ModalPanel>(null);

  const fetchData = useCallback(() => {
    Promise.all([
      cockpitStatisticsApi.dau(days),
      cockpitStatisticsApi.messages(days),
      cockpitStatisticsApi.retention(days),
      cockpitStatisticsApi.deptTokens(),
      cockpitStatisticsApi.topUsers(20),
      cockpitStatisticsApi.topUserSpend(20),
      cockpitStatisticsApi.tokens(days),
      cockpitStatisticsApi.latency(days).catch(() => ({ days: [], p50: [], p95: [], avg: [] })),
      cockpitStatisticsApi.errorRate(days).catch(() => ({ days: [], values: [] })),
    ])
      .then(([d, m, r, dt, tu, ts, t, lat, err]) => {
        setDau(d as TrendData);
        setMessages(m as TrendData);
        setRetention(r as TrendData);
        setDeptTokens((dt.departments || []).slice(0, 20));
        setTopUsers((tu.users || []).slice(0, 20));
        setTopSpend(ts.users || []);
        setTokens(t as TrendData);
        setLatency(lat as LatencyData);
        setErrorRate(err as TrendData);
      })
      .catch(() => {})
      .finally(() => {
        setInitialLoading(false);
        setRefreshing(false);
      });
  }, [days]);

  useEffect(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal]);

  if (initialLoading)
    return <div className="p-6 text-gray-400 text-sm text-center py-8">加载中...</div>;

  const lastDau = dau.values[dau.values.length - 1] || 0;
  const lastMsg = messages.values[messages.values.length - 1] || 0;
  const lastRetention = retention.values[retention.values.length - 1] || 0;
  const totalTokens = tokens.values.reduce((a, b) => a + b, 0);

  return (
    <div
      className={`p-6 space-y-4 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">数据统计</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            DAU、消息量、Token 消耗等核心运营指标与趋势分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <Icon name="sync" size={14} className="text-gray-400 animate-spin" />}
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-lg ${days === d ? 'bg-[#007AFF] text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <StatCard label="今日 DAU" value={lastDau} icon="group" color="#007AFF" />
        <StatCard
          label="今日消息"
          value={lastMsg.toLocaleString()}
          icon="chat_bubble"
          color="#34C759"
        />
        <StatCard label="留存率" value={`${lastRetention}%`} icon="autorenew" color="#AF52DE" />
        <StatCard
          label={`${days}日 Token`}
          value={fmtTk(totalTokens)}
          icon="token"
          color="#FF9500"
        />
        <StatCard
          label="日均活跃度"
          value={
            dau.values.length
              ? (dau.values.reduce((a, b) => a + b, 0) / dau.values.length).toFixed(0)
              : '—'
          }
          icon="bolt"
          color="#FF3B30"
        />
        <StatCard
          label="日均消耗"
          value={tokens.values.length ? fmtTk(Math.round(totalTokens / tokens.values.length)) : '—'}
          icon="payments"
          color="#5856D6"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard icon="show_chart" title="DAU 趋势" onExpand={() => setModal('dau')}>
          <LineChart data={trendPts(dau)} height={140} color="#007AFF" />
        </ChartCard>
        <ChartCard icon="show_chart" title="消息量趋势" onExpand={() => setModal('messages')}>
          <LineChart data={trendPts(messages)} height={140} color="#34C759" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard icon="show_chart" title="留存率趋势 (%)" onExpand={() => setModal('retention')}>
          <LineChart data={trendPts(retention)} height={140} color="#AF52DE" />
        </ChartCard>
        <ChartCard icon="show_chart" title="Token 消耗趋势" onExpand={() => setModal('tokens')}>
          <LineChart data={trendPts(tokens)} height={140} color="#FF9500" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ChartCard
          icon="leaderboard"
          title="部门 Token 消耗 Top 20"
          onExpand={() => setModal('dept')}
        >
          <MiniDeptRank items={deptTokens} />
        </ChartCard>
        <ChartCard icon="person" title="活跃用户 Top 20" onExpand={() => setModal('users')}>
          <MiniUserRank items={topUsers} />
        </ChartCard>
        <ChartCard icon="payments" title="用户花费 Top 20" onExpand={() => setModal('spend')}>
          <MiniSpendRank items={topSpend} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard icon="speed" title="响应时长 P50 / P95" onExpand={() => setModal('latency')}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-gray-300 mb-1">P50 (ms)</div>
              <LineChart
                data={latency.days.map((d, i) => ({ label: d, value: latency.p50[i] || 0 }))}
                height={100}
                color="#007AFF"
              />
            </div>
            <div>
              <div className="text-[11px] text-gray-300 mb-1">P95 (ms)</div>
              <LineChart
                data={latency.days.map((d, i) => ({ label: d, value: latency.p95[i] || 0 }))}
                height={100}
                color="#FF9500"
              />
            </div>
          </div>
        </ChartCard>
        <ChartCard icon="error_outline" title="错误率趋势 (%)" onExpand={() => setModal('error')}>
          <LineChart data={trendPts(errorRate)} height={120} color="#FF3B30" />
        </ChartCard>
      </div>

      {modal && (
        <DataModal
          panel={modal}
          onClose={() => setModal(null)}
          dau={dau}
          messages={messages}
          retention={retention}
          tokens={tokens}
          latency={latency}
          errorRate={errorRate}
          deptTokens={deptTokens}
          topUsers={topUsers}
          topSpend={topSpend}
        />
      )}
    </div>
  );
}
