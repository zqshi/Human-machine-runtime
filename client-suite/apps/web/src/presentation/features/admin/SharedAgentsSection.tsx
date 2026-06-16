import { useState, useEffect, useCallback } from 'react';
import { agentApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { FilterBar } from '../../components/ui/FilterBar';
import { Icon } from '../../components/ui/Icon';

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-green-50 text-green-700',
  active: 'bg-green-50 text-green-700',
  draft: 'bg-gray-100 text-gray-500',
  paused: 'bg-yellow-50 text-yellow-700',
};

const FILTER_DEFS = [
  { key: 'keyword', label: '搜索', type: 'text' as const, placeholder: '名称/ID' },
  {
    key: 'status',
    label: '状态',
    type: 'select' as const,
    options: [
      { value: 'published', label: '已发布' },
      { value: 'draft', label: '草稿' },
      { value: 'paused', label: '暂停' },
    ],
  },
];

export function SharedAgentsSection() {
  const [agents, setAgents] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // filters 变化时在渲染阶段标记 loading（避免 useEffect 中同步 setState）
  const [prevFilters, setPrevFilters] = useState(filters);
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    setLoading(true);
  }

  const load = useCallback(() => {
    agentApi
      .listShared({ keyword: filters.keyword || undefined, status: filters.status || undefined })
      .then((r) => {
        setAgents(r.rows || []);
        setSummary(r.summary || {});
      })
      .catch(() => {
        setAgents([]);
        setSummary({});
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load]);

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="总数" value={String(summary.total ?? agents.length)} icon="smart_toy" />
        <StatCard
          label="已发布"
          value={String(summary.published ?? '—')}
          icon="check_circle"
          color="#34C759"
        />
        <StatCard
          label="草稿"
          value={String(summary.draft ?? '—')}
          icon="edit_note"
          color="#8E8E93"
        />
        <StatCard label="共享" value={String(summary.shared ?? '—')} icon="share" color="#AF52DE" />
      </div>

      <div className="flex items-center justify-between">
        <FilterBar
          filters={FILTER_DEFS}
          values={filters}
          onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
          onSearch={load}
        />
        <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
          <Icon name="refresh" size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">能力签名</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Owner</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">生成方式</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">来源</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">标签</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">使用量</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={String(agent.id)} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">{String(agent.name)}</div>
                    <div className="text-xs text-gray-400">{String(agent.id)}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs font-mono truncate max-w-[160px]">
                    {String(agent.capabilitySignature || agent.category || '—')}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {String(agent.ownerEmployeeId || agent.owner || '—')}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {String(agent.spawnedBy || '—')}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {String(agent.source || '—')}
                  </td>
                  <td className="px-4 py-2.5">
                    {Array.isArray(agent.tags) ? (
                      <div className="flex flex-wrap gap-1">
                        {(agent.tags as string[]).slice(0, 3).map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex px-1.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {String(agent.usageCount ?? '—')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[String(agent.status)] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {String(agent.status || '—')}
                    </span>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    暂无 Agent
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
