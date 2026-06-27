import { useState, useEffect, useRef } from 'react';
import { cockpitMonitorApi, analyticsApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { LineChart, BarChart } from '../../components/ui/SVGChart';
import { Icon } from '../../components/ui/Icon';

const ALERT_COLORS: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
};

interface HeroCard {
  label: string;
  value: string | number;
  desc: string;
  icon: string;
  color: string;
}

interface HealthMetric {
  label: string;
  value: string;
  status: 'good' | 'warn' | 'bad';
}

const STATUS_COLORS: Record<string, string> = {
  good: 'text-green-600',
  warn: 'text-yellow-600',
  bad: 'text-red-600',
};

export function CockpitMonitorSection() {
  const [cost, setCost] = useState<Record<string, unknown>>({});
  const [sla, setSla] = useState<Record<string, unknown>>({});
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [perf, setPerf] = useState<Record<string, unknown>>({});
  const [topAgents, setTopAgents] = useState<
    { name: string; calls: number; successRate: string }[]
  >([]);
  const [health, setHealth] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 拉取数据（不含 setLoading，避免 effect 中同步 setState）
  const fetchData = () => {
    Promise.all([
      cockpitMonitorApi.costOverview(),
      cockpitMonitorApi.sla(),
      cockpitMonitorApi.alerts().catch(() => ({ alerts: [] })),
      cockpitMonitorApi.performance(),
      analyticsApi.agentPerformance().catch(() => ({ topAgents: [] })),
      cockpitMonitorApi.health().catch(() => ({ metrics: [] })),
    ])
      .then(([c, s, a, p, ap, h]) => {
        setCost(c);
        setSla(s);
        setAlerts(a.alerts || []);
        setPerf(p);
        setTopAgents(
          (ap.topAgents || []) as { name: string; calls: number; successRate: string }[]
        );
        setHealth((h.metrics || []) as HealthMetric[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 供手动刷新用（带 loading 态）
  const load = () => {
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    if (autoRefresh) intervalRef.current = setInterval(fetchData, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  if (loading) return <div className="p-6 text-gray-400 text-sm text-center py-8">加载中...</div>;

  const costModels = Array.isArray(cost.byModel)
    ? (cost.byModel as { model: string; cost: number; share: number }[])
    : [];
  const reqVolume = Array.isArray(perf.requestVolume)
    ? (perf.requestVolume as { label: string; value: number }[])
    : [];
  const latTrend = Array.isArray(perf.latencyTrend)
    ? (perf.latencyTrend as { label: string; value: number }[])
    : [];
  const errTrend = Array.isArray(perf.errorRateTrend)
    ? (perf.errorRateTrend as { label: string; value: number }[])
    : [];

  const heroCards: HeroCard[] = [
    {
      label: '今日会话数',
      value: String(sla.todayConversations ?? '—'),
      desc: '今日累计',
      icon: 'forum',
      color: '#007AFF',
    },
    {
      label: '活跃用户',
      value: String(sla.activeUsers ?? '—'),
      desc: '当前在线',
      icon: 'group',
      color: '#34C759',
    },
    {
      label: '平均交互轮次',
      value: String(sla.avgRounds ?? '—'),
      desc: '每会话平均',
      icon: 'insights',
      color: '#AF52DE',
    },
    {
      label: '活跃告警',
      value: alerts.length,
      desc:
        alerts.length === 0
          ? '一切正常'
          : `${alerts.filter((a) => a.level === 'critical').length} 条严重`,
      icon: 'warning',
      color: '#FF9500',
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">运营监控</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            数字员工平台运行健康度、Agent 效能监控与异常告警
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            30s 自动刷新
          </label>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-4 gap-3">
        {heroCards.map((c) => (
          <div
            key={c.label}
            className="border border-gray-200 rounded-xl p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${c.color}12` }}
              >
                <Icon name={c.icon} size={18} style={{ color: c.color }} />
              </div>
            </div>
            <div className="text-[11px] text-gray-400">{c.label}</div>
            <div className="text-2xl font-bold text-gray-800 tabular-nums">{c.value}</div>
            <div className="text-[11px] text-gray-300 mt-1">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* SLA Dashboard */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard label="可用率" value={`${sla.uptime ?? '—'}%`} icon="verified" color="#34C759" />
        <StatCard
          label="平均延迟"
          value={`${sla.avgLatency ?? '—'}ms`}
          icon="speed"
          color="#007AFF"
        />
        <StatCard
          label="P95 延迟"
          value={`${sla.p95Latency ?? '—'}ms`}
          icon="timer"
          color="#AF52DE"
        />
        <StatCard
          label="错误率"
          value={`${sla.errorRate ?? '—'}%`}
          icon="error_outline"
          color="#FF3B30"
        />
        <StatCard
          label="成功率"
          value={`${sla.successRate ?? '—'}%`}
          icon="check_circle"
          color="#34C759"
        />
        <StatCard
          label="请求/分钟"
          value={String(sla.requestsPerMinute ?? '—')}
          icon="query_stats"
          color="#FF9500"
        />
      </div>

      {/* Cost + Health */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-gray-400">
              <Icon name="payments" size={14} className="mr-1 align-[-2px]" />
              成本概览
            </h3>
            <span className="text-lg font-semibold text-gray-800">
              ${Number(cost.totalCost || 0).toFixed(2)}
            </span>
          </div>
          <BarChart
            data={costModels.map((m) => ({
              label: m.model.split('-').slice(-1)[0],
              value: m.cost,
            }))}
            width={320}
            height={100}
          />
          <div className="mt-3 space-y-1.5">
            {costModels.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{m.model}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-800 font-medium">${m.cost.toFixed(2)}</span>
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#007AFF] rounded-full"
                      style={{ width: `${m.share}%` }}
                    />
                  </div>
                  <span className="text-gray-400 w-10 text-right">{m.share}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Metrics */}
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">
            <Icon name="monitor_heart" size={14} className="mr-1 align-[-2px]" />
            平台健康指标
          </h3>
          {health.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-gray-400">
              <Icon name="check_circle" size={16} className="mr-1 text-green-500" />
              健康数据加载中
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {health.map((m, i) => (
                <div
                  key={i}
                  className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center"
                >
                  <div
                    className={`text-xl font-bold tabular-nums ${STATUS_COLORS[m.status] || 'text-gray-800'}`}
                  >
                    {m.value}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts + Model Distribution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">
            <Icon name="notifications_active" size={14} className="mr-1 align-[-2px]" />
            实时告警
            {alerts.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-50 text-red-600 rounded-full">
                {alerts.length}
              </span>
            )}
          </h3>
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-gray-400">
              <Icon name="check_circle" size={16} className="mr-1 text-green-500" />
              暂无告警
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-lg border text-xs ${ALERT_COLORS[String(a.level)] || ALERT_COLORS.info}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{String(a.message)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 opacity-70">
                    <span>{String(a.source)}</span>
                    <span>{String(a.timestamp || '').slice(11, 19)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model Distribution */}
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">
            <Icon name="hub" size={14} className="mr-1 align-[-2px]" />
            模型调用分布
          </h3>
          {costModels.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-gray-400">
              暂无数据
            </div>
          ) : (
            <div className="space-y-3">
              {costModels.map((m, i) => {
                const maxCost = Math.max(...costModels.map((cm) => cm.cost), 1);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{m.model}</span>
                      <span className="text-gray-400">{m.share}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(m.cost / maxCost) * 100}%`,
                          background: `hsl(${(i * 60) % 360}, 65%, 55%)`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">请求量趋势</h3>
          <LineChart data={reqVolume} height={120} color="#007AFF" />
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">延迟趋势 (ms)</h3>
          <LineChart data={latTrend} height={120} color="#FF9500" />
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">错误率趋势 (%)</h3>
          <LineChart data={errTrend} height={120} color="#FF3B30" />
        </div>
      </div>

      {/* Agent Ranking */}
      {topAgents.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h3 className="text-xs text-gray-400 mb-3">
            <Icon name="leaderboard" size={14} className="mr-1 align-[-2px]" />
            Agent 排行榜
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <BarChart
              data={topAgents.map((a) => ({ label: a.name, value: a.calls }))}
              width={300}
              height={120}
            />
            <div className="space-y-2">
              {topAgents.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{a.name}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span>{a.calls} 次</span>
                    <span className="ml-2 text-green-600">{a.successRate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
