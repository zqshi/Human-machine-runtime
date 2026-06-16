import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { platformMonitoringApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { LineChart } from '../../components/ui/SVGChart';
import { Icon } from '../../components/ui/Icon';

function healthBadge(level: unknown): string {
  if (level === 'healthy') return 'bg-green-50 text-green-700';
  if (level === 'degraded') return 'bg-yellow-50 text-yellow-700';
  return 'bg-red-50 text-red-600';
}

function healthIcon(level: unknown): string {
  if (level === 'healthy') return 'check_circle';
  if (level === 'degraded') return 'warning';
  return 'error';
}

export function PlatformMonitoringSection() {
  const [overview, setOverview] = useState<Record<string, unknown>>({});
  const [resources, setResources] = useState<Record<string, unknown>>({});
  const [health, setHealth] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    const isFirst = !lastRefresh;
    if (isFirst) setLoading(true);
    Promise.all([
      platformMonitoringApi.overview(),
      platformMonitoringApi.resources(),
      platformMonitoringApi.health(),
    ])
      .then(([o, r, h]) => {
        setOverview(o);
        setResources(r);
        setHealth(h);
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lastRefresh]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    loadRef.current();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  const resourceTenants = Array.isArray(resources.tenants)
    ? (resources.tenants as Record<string, unknown>[])
    : [];

  const healthTenants = Array.isArray(health.tenants)
    ? (health.tenants as Record<string, unknown>[])
    : [];

  const cpuHistory = Array.isArray(overview.cpuHistory)
    ? (overview.cpuHistory as { label: string; value: number }[])
    : [];
  const memHistory = Array.isArray(overview.memoryHistory)
    ? (overview.memoryHistory as { label: string; value: number }[])
    : [];

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm text-center py-8">加载中...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">平台监控</h1>
          <p className="text-xs text-gray-400 mt-0.5">资源用量、服务健康与实时告警</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">{lastRefresh.toLocaleTimeString()} 刷新</span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            30s 自动刷新
          </label>
          <button
            onClick={load}
            className="p-1.5 text-gray-400 hover:text-[#007AFF]"
            title="立即刷新"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="租户总数" value={String(overview.totalTenants ?? '—')} icon="apartment" />
        <StatCard
          label="活跃租户"
          value={String(overview.activeTenants ?? '—')}
          icon="group"
          color="#34C759"
        />
        <StatCard
          label="运行实例"
          value={String(overview.runningInstances ?? '—')}
          icon="dns"
          color="#007AFF"
        />
        <StatCard
          label="系统健康"
          value={String(overview.healthLevel ?? '—')}
          icon={healthIcon(overview.healthLevel)}
          color={
            overview.healthLevel === 'healthy'
              ? '#34C759'
              : overview.healthLevel === 'degraded'
                ? '#FF9500'
                : '#FF3B30'
          }
        />
      </div>

      {/* SVG Charts */}
      {(cpuHistory.length > 0 || memHistory.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {cpuHistory.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <h3 className="text-xs text-gray-400 mb-3">CPU 使用率趋势</h3>
              <LineChart data={cpuHistory} height={120} color="#007AFF" />
            </div>
          )}
          {memHistory.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <h3 className="text-xs text-gray-400 mb-3">内存使用率趋势</h3>
              <LineChart data={memHistory} height={120} color="#AF52DE" />
            </div>
          )}
        </div>
      )}

      {/* Resource allocation */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">资源分配</h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">租户</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">实例数</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">CPU</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">内存</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">存储</th>
              </tr>
            </thead>
            <tbody>
              {resourceTenants.map((t) => (
                <tr key={String(t.tenantId)} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {String(t.tenantName || t.tenantId)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{String(t.instanceCount ?? '—')}</td>
                  <td className="px-4 py-2.5 text-gray-600">{String(t.totalCpu ?? '—')}</td>
                  <td className="px-4 py-2.5 text-gray-600">{String(t.totalMemory ?? '—')}</td>
                  <td className="px-4 py-2.5 text-gray-600">{String(t.totalStorage ?? '—')}</td>
                </tr>
              ))}
              {resourceTenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    暂无资源数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Health status with expandable detail */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">健康状态</h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="w-8"></th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">租户</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">健康度</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">检查时间</th>
              </tr>
            </thead>
            <tbody>
              {healthTenants.map((t) => {
                const tid = String(t.tenantId);
                const isExpanded = expandedTenant === tid;
                const services = Array.isArray(t.services)
                  ? (t.services as Record<string, unknown>[])
                  : [];
                return (
                  <Fragment key={tid}>
                    <tr
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedTenant(isExpanded ? null : tid)}
                    >
                      <td className="pl-3">
                        <Icon
                          name={isExpanded ? 'expand_more' : 'chevron_right'}
                          size={16}
                          className="text-gray-400"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {String(t.tenantName || tid)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${healthBadge(t.level)}`}
                        >
                          {String(t.level || '—')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">
                        {String(t.message || '—')}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {String(t.checkedAt || '—')
                          .slice(0, 19)
                          .replace('T', ' ')}
                      </td>
                    </tr>
                    {isExpanded && services.length > 0 && (
                      <tr key={`${tid}-detail`}>
                        <td colSpan={5} className="px-8 py-3 bg-gray-50/50">
                          <div className="text-xs text-gray-500 mb-2 font-medium">服务状态明细</div>
                          <div className="grid grid-cols-2 gap-2">
                            {services.map((svc, i) => {
                              const isUp = svc.status === 'up' || svc.status === 'healthy';
                              const isDegraded = svc.status === 'degraded';
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-100"
                                >
                                  <Icon
                                    name={isUp ? 'check_circle' : isDegraded ? 'warning' : 'cancel'}
                                    size={14}
                                    className={
                                      isUp
                                        ? 'text-green-500'
                                        : isDegraded
                                          ? 'text-yellow-500'
                                          : 'text-red-500'
                                    }
                                  />
                                  <span className="text-xs text-gray-700">
                                    {String(svc.name || `服务 ${i + 1}`)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 ml-auto">
                                    {svc.latency != null ? `${String(svc.latency)}ms` : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {healthTenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    暂无健康数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
