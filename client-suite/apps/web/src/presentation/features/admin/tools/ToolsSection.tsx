/**
 * ToolsSection — 工具管理
 *
 * 风格与 SkillsSection / SharedAgentsSection 统一：
 * StatCard → FilterBar → 表格列表 → Drawer 详情
 */
import { useState, useEffect, useCallback } from 'react';
import { toolApi } from '../../../../application/services/adminApi';
import { StatCard } from '../../../components/ui/StatCard';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Icon } from '../../../components/ui/Icon';
import { Drawer } from '../../../components/ui/Drawer';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { ToolSourceCreateWizard } from './ToolSourceCreateWizard';
import type {
  ToolSource,
  ToolDefinition,
  ToolStats,
} from '../../../../infrastructure/api/adminApiClient';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  syncing: 'bg-blue-50 text-blue-600',
  error: 'bg-red-50 text-red-600',
  archived: 'bg-gray-100 text-gray-500',
};

const HEALTH_BADGE: Record<string, { dot: string; label: string; text: string }> = {
  healthy: { dot: 'bg-green-500', label: '健康', text: 'text-green-700' },
  degraded: { dot: 'bg-yellow-500', label: '降级', text: 'text-yellow-700' },
  down: { dot: 'bg-red-500', label: '不可用', text: 'text-red-700' },
  unknown: { dot: 'bg-gray-300', label: '未探活', text: 'text-gray-400' },
};

/** 工具源健康徽章（P4 scheduler 探活维护的 healthStatus 前端可视化）。 */
function HealthBadge({ status }: { status?: string }) {
  const m = HEALTH_BADGE[status || 'unknown'] || HEALTH_BADGE.unknown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${m.text}`} title={`健康：${m.label}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  openapi: 'OpenAPI',
  database: '数据库',
  gateway: 'API 网关',
  mcp_native: 'MCP 原生',
};

const FILTER_DEFS = [
  { key: 'keyword', label: '搜索', type: 'text' as const, placeholder: '名称/类型' },
  {
    key: 'sourceType',
    label: '类型',
    type: 'select' as const,
    options: [
      { value: 'openapi', label: 'OpenAPI' },
      { value: 'database', label: '数据库' },
      { value: 'gateway', label: 'API 网关' },
      { value: 'mcp_native', label: 'MCP 原生' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    type: 'select' as const,
    options: [
      { value: 'active', label: '正常' },
      { value: 'error', label: '异常' },
      { value: 'syncing', label: '同步中' },
    ],
  },
];

type DrawerState = { mode: 'none' } | { mode: 'create' } | { mode: 'detail'; source: ToolSource };

export function ToolsSection() {
  const [sources, setSources] = useState<ToolSource[]>([]);
  const [stats, setStats] = useState<ToolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'none' });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  // 详情 Drawer 中的工具列表
  const [definitions, setDefinitions] = useState<ToolDefinition[]>([]);
  const [defsLoading, setDefsLoading] = useState(false);
  // 试调
  const [testTarget, setTestTarget] = useState<ToolDefinition | null>(null);
  const [testParams, setTestParams] = useState('{}');
  const [testResult, setTestResult] = useState<object | null>(null);
  const [testing, setTesting] = useState(false);

  const [prevFilters, setPrevFilters] = useState(filters);
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    setLoading(true);
  }

  const fetchSources = useCallback(() => {
    Promise.all([
      toolApi.listSources().catch(() => ({ sources: [] })),
      toolApi.getStats().catch(() => null),
    ]).then(([srcRes, s]) => {
      setSources(srcRes.sources || []);
      if (s) setStats(s);
      setLoading(false);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchSources();
  }, [fetchSources]);

  useEffect(fetchSources, [fetchSources]);

  const filtered = sources.filter((s) => {
    if (filters.sourceType && s.sourceType !== filters.sourceType) return false;
    if (filters.status && s.status !== filters.status) return false;
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      if (!s.name.toLowerCase().includes(kw) && !s.sourceType.includes(kw)) return false;
    }
    return true;
  });

  const handleSync = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSyncing(id);
    try {
      await toolApi.syncSource(id);
      load();
    } catch {
      /* ignore */
    }
    setSyncing(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await toolApi.deleteSource(deleteTarget);
      if (drawer.mode === 'detail' && drawer.source.id === deleteTarget) {
        setDrawer({ mode: 'none' });
      }
      load();
    } catch {
      /* ignore */
    }
    setDeleteTarget(null);
  };

  const openDetail = async (source: ToolSource) => {
    setDrawer({ mode: 'detail', source });
    setDefsLoading(true);
    try {
      const r = await toolApi.listDefinitions({ sourceId: source.id });
      setDefinitions(r.definitions || []);
    } catch {
      setDefinitions([]);
    }
    setDefsLoading(false);
  };

  const handleToggle = async (def: ToolDefinition) => {
    try {
      await toolApi.updateDefinition(def.id, { enabled: !def.enabled });
      // 刷新详情
      if (drawer.mode === 'detail') {
        const r = await toolApi.listDefinitions({ sourceId: drawer.source.id });
        setDefinitions(r.definitions || []);
      }
    } catch {
      /* ignore */
    }
  };

  const handleTest = async () => {
    if (!testTarget) return;
    setTesting(true);
    try {
      const params = JSON.parse(testParams);
      const result = await toolApi.testTool(testTarget.id, params);
      setTestResult(result);
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : String(err) });
    }
    setTesting(false);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="工具源" value={stats?.totalSources ?? 0} icon="source" />
        <StatCard label="工具总数" value={stats?.totalDefinitions ?? 0} icon="extension" />
        <StatCard
          label="已启用"
          value={stats?.enabledDefinitions ?? 0}
          icon="check_circle"
          color="#34C759"
        />
      </div>

      {/* Filter + Actions */}
      <div className="flex items-center justify-between">
        <FilterBar
          filters={FILTER_DEFS}
          values={filters}
          onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
          onSearch={load}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
          >
            <Icon name="add" size={14} className="mr-1 align-[-2px]" />
            接入工具源
          </button>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">工具数</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">最近同步</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((src) => (
                <tr
                  key={src.id}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openDetail(src)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">{src.name}</div>
                    <div className="text-xs text-gray-400">{src.description || src.id}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {SOURCE_TYPE_LABEL[src.sourceType] || src.sourceType}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{src.toolCount}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {src.lastSyncedAt ? src.lastSyncedAt.slice(0, 16).replace('T', ' ') : '未同步'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[src.status] || 'bg-gray-100 text-gray-500'}`}
                      >
                        {src.status}
                      </span>
                      <HealthBadge status={src.healthStatus} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => handleSync(src.id, e)}
                        disabled={syncing === src.id}
                        className="p-1 text-gray-400 hover:text-[#007AFF] disabled:opacity-50"
                        title="同步"
                      >
                        <Icon
                          name="sync"
                          size={16}
                          className={syncing === src.id ? 'animate-spin' : ''}
                        />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(src.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    暂无工具源
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Wizard Drawer */}
      <Drawer
        open={drawer.mode === 'create'}
        onClose={() => setDrawer({ mode: 'none' })}
        title="接入工具源"
      >
        <ToolSourceCreateWizard
          onCreated={() => {
            setDrawer({ mode: 'none' });
            load();
          }}
        />
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        open={drawer.mode === 'detail'}
        onClose={() => setDrawer({ mode: 'none' })}
        title={drawer.mode === 'detail' ? drawer.source.name : ''}
      >
        {drawer.mode === 'detail' && (
          <div className="space-y-4">
            {/* Source Meta */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <strong>类型:</strong> {SOURCE_TYPE_LABEL[drawer.source.sourceType]}
              </p>
              <p>
                <strong>状态:</strong> {drawer.source.status}
              </p>
              <p>
                <strong>工具数:</strong> {drawer.source.toolCount}
              </p>
              {drawer.source.lastSyncedAt && (
                <p>
                  <strong>同步时间:</strong>{' '}
                  {drawer.source.lastSyncedAt.slice(0, 16).replace('T', ' ')}
                </p>
              )}
              {drawer.source.lastSyncError && (
                <p className="text-red-500">
                  <strong>错误:</strong> {drawer.source.lastSyncError}
                </p>
              )}
            </div>

            {/* Tool List */}
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">工具列表</h4>
              {defsLoading ? (
                <div className="text-xs text-gray-400 py-4 text-center">加载中...</div>
              ) : definitions.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">暂无工具，点击同步生成</div>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                  {definitions.map((def) => (
                    <div
                      key={def.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {def.method && (
                            <span className="text-[10px] font-mono font-semibold text-[#007AFF] bg-blue-50 px-1.5 py-0.5 rounded">
                              {def.method}
                            </span>
                          )}
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {def.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {def.path || def.summary || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                          onClick={() => handleToggle(def)}
                          className={`w-7 h-3.5 rounded-full transition-colors ${def.enabled ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
                        >
                          <div
                            className={`w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${def.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`}
                          />
                        </button>
                        <button
                          onClick={() => {
                            setTestTarget(def);
                            setTestResult(null);
                            setTestParams('{}');
                          }}
                          className="text-[10px] text-[#007AFF] hover:bg-blue-50 px-1.5 py-0.5 rounded"
                        >
                          试调
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Test Drawer */}
      <Drawer
        open={!!testTarget}
        onClose={() => setTestTarget(null)}
        title={`试调: ${testTarget?.name ?? ''}`}
      >
        {testTarget && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 space-y-1">
              {testTarget.method && (
                <p>
                  <strong>方法:</strong> {testTarget.method} {testTarget.path}
                </p>
              )}
              <p>
                <strong>执行方式:</strong> {testTarget.executionType}
              </p>
            </div>
            {testTarget.inputSchema && Object.keys(testTarget.inputSchema).length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">输入 Schema</label>
                <pre className="text-[10px] font-mono bg-gray-50 p-2 rounded border border-gray-100 overflow-auto max-h-28">
                  {JSON.stringify(testTarget.inputSchema, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">调用参数 (JSON)</label>
              <textarea
                value={testParams}
                onChange={(e) => setTestParams(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg resize-y"
              />
            </div>
            <button
              onClick={handleTest}
              disabled={testing}
              className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
            >
              {testing ? '调用中...' : '执行'}
            </button>
            {testResult && (
              <pre className="text-[10px] font-mono bg-gray-50 p-3 rounded border border-gray-100 overflow-auto max-h-48">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Drawer>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="删除工具源"
        message="确定要删除该工具源？关联的工具定义将一并删除，此操作不可恢复。"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
