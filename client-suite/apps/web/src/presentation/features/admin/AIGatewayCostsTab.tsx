import { useState, useEffect, useCallback } from 'react';
import { aiGatewayApi } from '../../../application/services/adminApi';
import { useAdminStore } from '../../../application/stores/adminStore';
import { StatCard } from '../../components/ui/StatCard';

function fmtCost(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? '—' : `¥${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function CostsTab() {
  const [data, setData] = useState<Record<string, unknown>>({});
  const dateFrom = useAdminStore((s) => s.aiGatewayDateFrom);
  const dateTo = useAdminStore((s) => s.aiGatewayDateTo);
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userSort, setUserSort] = useState('cost');

  const load = useCallback(() => {
    aiGatewayApi
      .getCosts({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      .then((r) => setData(r || {}))
      .catch(() => {});
  }, [dateFrom, dateTo]);
  useEffect(load, [load]);

  const deptSummary = (data.deptSummary || []) as Record<string, unknown>[];
  const modelSummary = (data.modelSummary || []) as Record<string, unknown>[];
  const dailyTrend = (data.dailyTrend || []) as Record<string, unknown>[];
  const totalCost = Number(data.totalEstimatedCost) || 1;

  let userRows = [...((data.userSummary || []) as Record<string, unknown>[])];
  if (userDeptFilter) userRows = userRows.filter((u) => u.department === userDeptFilter);
  userRows.sort((a, b) => {
    const key =
      userSort === 'tokens' ? 'totalTokens' : userSort === 'count' ? 'count' : 'estimatedCost';
    return (Number(b[key]) || 0) - (Number(a[key]) || 0);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="输入 Token"
          value={fmtNum(Number(data.totalPromptTokens) || 0)}
          icon="upload"
        />
        <StatCard
          label="输出 Token"
          value={fmtNum(Number(data.totalCompletionTokens) || 0)}
          icon="download"
          color="#AF52DE"
        />
        <StatCard
          label="总成本"
          value={fmtCost(data.totalEstimatedCost)}
          icon="payments"
          color="#FF9500"
        />
        <StatCard
          label="缓存命中"
          value={fmtNum(Number(data.totalCacheReadTokens) || 0)}
          icon="bolt"
          color="#34C759"
        />
      </div>

      {/* 部门汇总 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">部门汇总</h3>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2 font-medium text-gray-500">部门</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">人数</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">调用</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Tokens</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">成本</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">占比</th>
              </tr>
            </thead>
            <tbody>
              {deptSummary.map((d) => {
                const pct = (((Number(d.estimatedCost) || 0) / totalCost) * 100).toFixed(1);
                return (
                  <tr key={String(d.department)} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{String(d.department)}</td>
                    <td className="px-4 py-2 text-gray-600">{String(d.users)}</td>
                    <td className="px-4 py-2 text-gray-600">{fmtNum(Number(d.count) || 0)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {fmtNum(Number(d.totalTokens) || 0)}
                    </td>
                    <td className="px-4 py-2 text-gray-800">{fmtCost(d.estimatedCost)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#007AFF] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {deptSummary.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 用户汇总 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium text-gray-700">用户汇总</h3>
          <select
            value={userDeptFilter}
            onChange={(e) => setUserDeptFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
          >
            <option value="">全部部门</option>
            {deptSummary.map((d) => (
              <option key={String(d.department)} value={String(d.department)}>
                {String(d.department)}
              </option>
            ))}
          </select>
          <select
            value={userSort}
            onChange={(e) => setUserSort(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
          >
            <option value="cost">按成本</option>
            <option value="tokens">按 Token</option>
            <option value="count">按调用</option>
          </select>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2 font-medium text-gray-500">用户</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">部门</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">调用</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Tokens</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">成本</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => (
                <tr key={String(u.userId)} className="border-b border-gray-50">
                  <td className="px-4 py-2 text-gray-800">{String(u.userId)}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{String(u.department || '—')}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtNum(Number(u.count) || 0)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtNum(Number(u.totalTokens) || 0)}</td>
                  <td className="px-4 py-2 text-gray-800">{fmtCost(u.estimatedCost)}</td>
                </tr>
              ))}
              {userRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 模型汇总 + 日趋势 并排 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">模型汇总</h3>
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">模型</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">调用</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Tokens</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">缓存 Token</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">成本</th>
                </tr>
              </thead>
              <tbody>
                {modelSummary.map((m) => (
                  <tr key={String(m.model)} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-800 text-xs font-mono">{String(m.model)}</td>
                    <td className="px-4 py-2 text-gray-600">{fmtNum(Number(m.count) || 0)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {fmtNum(Number(m.totalTokens) || 0)}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {Number(m.cacheReadTokens) > 0
                        ? fmtNum(Number(m.cacheReadTokens))
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-800">{fmtCost(m.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">日趋势</h3>
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">日期</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">调用</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">入/出 Token</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">缓存 Token</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">成本</th>
                </tr>
              </thead>
              <tbody>
                {dailyTrend.map((r) => (
                  <tr key={String(r.day)} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-600 text-xs">{String(r.day)}</td>
                    <td className="px-4 py-2 text-gray-600">{fmtNum(Number(r.count) || 0)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {fmtNum(Number(r.promptTokens) || 0)} /{' '}
                      {fmtNum(Number(r.completionTokens) || 0)}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {Number(r.cacheReadTokens) > 0
                        ? fmtNum(Number(r.cacheReadTokens))
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-800">{fmtCost(r.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
