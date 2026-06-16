import { useState, useEffect, useCallback } from 'react';
import { useAdminStore, type AIGatewayTab } from '../../../application/stores/adminStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { aiGatewayApi } from '../../../application/services/adminApi';
import { MOCK_MODELS, mockCountDeptGrantsByModel } from '../../../application/mock/aiGatewayMock';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { StatCard } from '../../components/ui/StatCard';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { CostsTab } from './AIGatewayCostsTab';
import { RiskRulesTab } from './AIGatewayRulesTab';
import { ModelEditor } from './AIModelEditor';
import { FailoverSection } from './AIFailoverSection';
import { AgentGrantsDrawer } from './AgentGrantsDrawer';
import { DeptGrantDrawer } from './DeptGrantDrawer';

const TABS: { key: AIGatewayTab; label: string }[] = [
  { key: 'models', label: '模型管理' },
  { key: 'costs', label: '成本分析' },
  { key: 'risk-rules', label: '风险规则' },
];

// 健康状态枚举与后端对齐：health-check 真实只会产生
// healthy / degraded / unconfigured / unreachable 四态（见 server ai-gateway.ts）。
// unhealthy 保留为兼容历史数据/mock，语义等同 unreachable（异常）。
const HEALTH_STATUS: Record<string, { dot: string; label: string }> = {
  healthy: { dot: 'bg-green-500', label: '正常' },
  degraded: { dot: 'bg-yellow-500', label: '降级' },
  unreachable: { dot: 'bg-red-500', label: '异常' },
  unconfigured: { dot: 'bg-gray-400', label: '未配置' },
  unhealthy: { dot: 'bg-red-500', label: '异常' },
};
const HEALTH_DEFAULT = { dot: 'bg-gray-400', label: '未检测' };

function healthMeta(status: string) {
  return HEALTH_STATUS[status] ?? HEALTH_DEFAULT;
}

function fmtClock(iso: unknown): string {
  const s = String(iso ?? '');
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function healthTooltip(
  status: string,
  latency?: number,
  checkedAt?: unknown,
  checking?: boolean
): string {
  if (checking) return '检测中…';
  const meta = healthMeta(status);
  const parts: string[] = [meta.label];
  if (latency != null) parts.push(`${latency}ms`);
  const clock = fmtClock(checkedAt);
  if (clock) parts.push(`${clock} 检测`);
  return parts.join(' · ');
}

function fmtPrice(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

// ─── Models Tab ───────────────────────────────────────────────────────

function ModelsTab() {
  const demoMode = useAdminStore((s) => s.aiGatewayDemoMode);
  const toggleDemo = useAdminStore((s) => s.toggleAIGatewayDemoMode);
  const [models, setModels] = useState<Record<string, unknown>[]>([]);
  const [grantsCount, setGrantsCount] = useState<Record<string, number>>({});
  const [providers, setProviders] = useState<Record<string, unknown>[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
  const [healthLatency, setHealthLatency] = useState<Record<string, number | undefined>>({});
  const [grantTarget, setGrantTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    if (demoMode) {
      setModels(MOCK_MODELS as unknown as Record<string, unknown>[]);
      // 部门级授权原型：用声明式规则展开后的实际人数
      setGrantsCount(mockCountDeptGrantsByModel());
      return;
    }
    aiGatewayApi
      .listModels()
      .then((r) => {
        const db = (r.models || r.rows || []) as Record<string, unknown>[];
        const remote =
          ((r as Record<string, unknown>).remote as { data?: Record<string, unknown>[] })?.data ??
          [];
        const dbIds = new Set(db.map((m) => String(m.id)));
        const merged = [
          ...db,
          ...remote
            .filter((m) => !dbIds.has(String(m.id)))
            .map((m) => ({
              id: m.id,
              name: m.id,
              displayName: String(m.id),
              providerType: 'litellm',
              isActive: true,
              source: 'remote',
            })),
        ];
        setModels(merged);
      })
      .catch(() => {});
    aiGatewayApi
      .listGrantsCount()
      .then((r) => setGrantsCount(r.counts || {}))
      .catch(() => {});
    aiGatewayApi
      .listProviders()
      .then((r) => setProviders(r.providers || []))
      .catch(() => {});
  }, [demoMode]);
  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await aiGatewayApi.deleteModel(deleteTarget);
      load();
    } catch {
      /* intentionally ignored */
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleToggle = async (id: string) => {
    if (demoMode) {
      setModels((prev) =>
        prev.map((m) => (String(m.id) === id ? { ...m, isActive: !m.isActive } : m))
      );
      return;
    }
    try {
      await aiGatewayApi.toggleModel(id);
    } catch {
      /* ignore */
    }
    load();
  };

  const handleHealthCheck = async (id: string) => {
    setCheckingHealth(id);
    const addToast = useToastStore.getState().addToast;
    try {
      if (demoMode) {
        // 演示模式：在 正常 → 降级 → 异常 间循环，预览三种状态颜色与提示
        const target = models.find((m) => String(m.id) === id);
        const prev = String(target?.healthStatus);
        const next = prev === 'healthy' ? 'degraded' : prev === 'degraded' ? 'unreachable' : 'healthy';
        setModels((cur) =>
          cur.map((m) =>
            String(m.id) === id
              ? { ...m, healthStatus: next, lastHealthCheckAt: new Date().toISOString() }
              : m
          )
        );
        setHealthLatency((cur) => ({ ...cur, [id]: next === 'unreachable' ? undefined : 142 }));
        addToast(
          `健康检查完成：${healthMeta(next).label}`,
          next === 'unreachable' ? 'error' : 'success'
        );
      } else {
        const result = await aiGatewayApi.healthCheck(id);
        const status = String(result.status);
        const latency = result.latencyMs != null ? Number(result.latencyMs) : undefined;
        setModels((cur) =>
          cur.map((m) =>
            String(m.id) === id
              ? { ...m, healthStatus: status, lastHealthCheckAt: String(result.checkedAt ?? '') }
              : m
          )
        );
        setHealthLatency((cur) => ({ ...cur, [id]: latency }));
        if (status === 'healthy') {
          addToast(`健康检查完成：正常${latency != null ? `（${latency}ms）` : ''}`, 'success');
        } else if (status === 'degraded') {
          const http = result.httpStatus != null ? `HTTP ${result.httpStatus} · ` : '';
          addToast(
            `健康检查完成：降级（${http}${latency != null ? `${latency}ms` : '—'}）`,
            'info'
          );
        } else if (status === 'unconfigured') {
          addToast('健康检查失败：模型未配置 baseUrl', 'error');
        } else if (status === 'unreachable') {
          const err = result.error ? `（${result.error}）` : '';
          addToast(`健康检查失败：无法连接${err}`, 'error');
        } else {
          addToast('健康检查完成', 'info');
        }
      }
    } catch {
      addToast('健康检查失败，请稍后重试', 'error');
    } finally {
      setCheckingHealth(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {models.length} 个模型
          {demoMode && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-medium border border-amber-100">
              演示数据
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDemo}
            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              demoMode
                ? 'border-amber-300 text-amber-600 bg-amber-50'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            title="切换演示模式：开启后用本地 mock 数据，便于预览授权 UI"
          >
            <Icon name="science" size={13} className="mr-1 align-[-2px]" />
            {demoMode ? '演示模式：开' : '演示模式'}
          </button>
          <button
            onClick={() => {
              setEditTarget(null);
              setEditorOpen(true);
            }}
            className="px-3 py-1.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
          >
            <Icon name="add" size={14} className="mr-1 align-[-2px]" />
            添加模型
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {models.map((m) => {
          const mid = String(m.id);
          const health = String(m.healthStatus || 'unknown');
          return (
            <div key={mid} className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${healthMeta(health).dot}`}
                    title={healthTooltip(
                      health,
                      healthLatency[mid],
                      m.lastHealthCheckAt,
                      checkingHealth === mid
                    )}
                  />
                  <span className="font-medium text-sm text-gray-800">
                    {String(m.displayName || m.name)}
                  </span>
                  {checkingHealth === mid ? (
                    <span className="text-[10px] text-amber-500 animate-pulse">检测中…</span>
                  ) : healthLatency[mid] != null ? (
                    <span
                      className={`text-[10px] font-medium ${
                        health === 'healthy'
                          ? 'text-green-600'
                          : health === 'degraded'
                            ? 'text-yellow-600'
                            : 'text-gray-400'
                      }`}
                    >
                      {healthLatency[mid]}ms
                    </span>
                  ) : null}
                </div>
                <ToggleSwitch checked={!!m.isActive} onChange={() => handleToggle(mid)} />
              </div>

              <div className="text-xs text-gray-500 mb-2">{String(m.description || '')}</div>

              <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-2">
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {String(m.providerType || '—')}
                </span>
                <span className="font-mono">{String(m.providerModelName || '—')}</span>
                {!!m.modelName && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-mono">
                    {String(m.modelName)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
                <span>
                  输入:{' '}
                  <span className="font-medium text-gray-700">{fmtPrice(m.inputPrice)}/M</span>
                </span>
                <span>
                  输出:{' '}
                  <span className="font-medium text-gray-700">{fmtPrice(m.outputPrice)}/M</span>
                </span>
                {!!m.maxTokens && (
                  <span>
                    上限:{' '}
                    <span className="font-medium text-gray-700">
                      {Number(m.maxTokens) >= 1000
                        ? `${Math.round(Number(m.maxTokens) / 1024)}K`
                        : String(m.maxTokens)}
                    </span>
                  </span>
                )}
                <span>
                  限流:{' '}
                  <span className="font-medium text-gray-700">
                    {String(m.rateLimitPerMin || '—')}/min
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  onClick={() =>
                    setGrantTarget({ id: mid, name: String(m.displayName || m.name) })
                  }
                  className={`group flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                    (grantsCount[mid] ?? 0) > 0
                      ? 'bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  title="配置可使用该模型的数字员工"
                >
                  <Icon name="lock_person" size={12} className="align-[-2px]" />
                  已授权 <span className="font-semibold">{grantsCount[mid] ?? 0}</span> 个 Agent
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleHealthCheck(mid)}
                    disabled={checkingHealth === mid}
                    className="p-1 text-gray-400 hover:text-green-600 disabled:opacity-50"
                    title={checkingHealth === mid ? '检测中…' : '健康检查'}
                  >
                    <Icon
                      name={checkingHealth === mid ? 'hourglass_empty' : 'monitor_heart'}
                      size={14}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEditTarget(m);
                      setEditorOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-[#007AFF]"
                    title="编辑"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(mid)}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="删除"
                  >
                    <Icon name="delete" size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {models.length === 0 && (
          <div className="col-span-2 flex items-center justify-center py-12 text-gray-400 text-sm">
            暂无模型
          </div>
        )}
      </div>

      <FailoverSection models={models} />

      {editorOpen && (
        <ModelEditor
          model={editTarget}
          providers={providers}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            load();
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="删除模型"
        message="确定要删除该模型配置吗？"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {demoMode ? (
        <DeptGrantDrawer
          modelId={grantTarget?.id ?? null}
          modelName={grantTarget?.name ?? ''}
          onClose={() => setGrantTarget(null)}
          onSaved={() => load()}
        />
      ) : (
        <AgentGrantsDrawer
          modelId={grantTarget?.id ?? null}
          modelName={grantTarget?.name ?? ''}
          demoMode={demoMode}
          onClose={() => setGrantTarget(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function AIGatewaySection() {
  const tab = useAdminStore((s) => s.aiGatewayTab);
  const setTab = useAdminStore((s) => s.setAIGatewayTab);
  const dateFrom = useAdminStore((s) => s.aiGatewayDateFrom);
  const dateTo = useAdminStore((s) => s.aiGatewayDateTo);
  const setDateRange = useAdminStore((s) => s.setAIGatewayDateRange);
  const setDateThisWeek = useAdminStore((s) => s.setAIGatewayDateThisWeek);
  const setDateRecentDays = useAdminStore((s) => s.setAIGatewayDateRecentDays);
  const setDateAll = useAdminStore((s) => s.setAIGatewayDateAll);
  const [stats, setStats] = useState<Record<string, unknown>>({});

  const loadStats = useCallback(() => {
    aiGatewayApi
      .getStats({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      .then(setStats)
      .catch(() => {});
  }, [dateFrom, dateTo]);

  useEffect(loadStats, [loadStats]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">AI Gateway</h1>
          <p className="text-xs text-gray-400 mt-0.5">模型管理、成本分析与风险拦截规则配置</p>
        </div>
      </div>

      {/* 日期筛选（页面级，成本分析 Tab 共用同一范围） */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateRange(e.target.value, dateTo)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg w-36"
            title="开始日期"
          />
          <span className="text-gray-400 text-xs">至</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateRange(dateFrom, e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg w-36"
            title="结束日期"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={setDateThisWeek}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            本周
          </button>
          <button
            onClick={() => setDateRecentDays(7)}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            近7天
          </button>
          <button
            onClick={() => setDateRecentDays(30)}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            近30天
          </button>
          <button
            onClick={setDateAll}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            全部
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="总调用" value={String(stats.totalCalls ?? '—')} icon="api" />
        <StatCard
          label="总 Token"
          value={formatNum(Number(stats.totalTokens) || 0)}
          icon="token"
          color="#AF52DE"
        />
        <StatCard
          label="平均延迟"
          value={String(stats.avgLatency ?? '—')}
          icon="speed"
          color="#FF9500"
        />
        <StatCard
          label="错误率"
          value={stats.errorRate != null ? `${Number(stats.errorRate).toFixed(2)}%` : '—'}
          icon="error_outline"
          color="#FF3B30"
        />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-[#007AFF] text-[#007AFF] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'models' && <ModelsTab />}
      {tab === 'costs' && <CostsTab />}
      {tab === 'risk-rules' && <RiskRulesTab />}
    </div>
  );
}
