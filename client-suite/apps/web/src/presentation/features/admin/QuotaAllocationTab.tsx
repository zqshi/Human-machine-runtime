import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  quotaApi,
  employeeApi,
  type AllocationData,
  type TenantDefaultConfig,
  type Employee,
} from '../../../application/services/adminApi';
import { EmployeeResourceDrawer } from './EmployeeResourceDrawer';

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  running: { label: '运行中', cls: 'bg-green-100 text-green-700' },
  stopped: { label: '已停止', cls: 'bg-gray-100 text-gray-500' },
  error: { label: '异常', cls: 'bg-red-100 text-red-600' },
  starting: { label: '启动中', cls: 'bg-blue-100 text-blue-600' },
  requested: { label: '申请中', cls: 'bg-purple-100 text-purple-600' },
  provisioning: { label: '部署中', cls: 'bg-yellow-100 text-yellow-600' },
};

function parseCpuMillis(cpu: string): number {
  if (cpu.endsWith('m')) return parseInt(cpu, 10) || 0;
  return (parseFloat(cpu) || 0) * 1000;
}

function parseMemoryMi(mem: string): number {
  if (mem.endsWith('Gi')) return (parseFloat(mem) || 0) * 1024;
  if (mem.endsWith('Mi')) return parseFloat(mem) || 0;
  return parseFloat(mem) || 0;
}

function formatCpu(millis: number): string {
  return millis >= 1000 ? `${(millis / 1000).toFixed(1)}C` : `${millis}m`;
}

function formatMem(mi: number): string {
  return mi >= 1024 ? `${(mi / 1024).toFixed(1)}Gi` : `${mi}Mi`;
}

function usageBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-400';
  if (pct >= 70) return 'bg-orange-400';
  return 'bg-[#007AFF]';
}

const CPU_OPTIONS = ['250m', '500m', '1000m', '2000m', '4000m'];
const MEMORY_OPTIONS = ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'];
const STORAGE_OPTIONS = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'];

export function QuotaAllocationTab() {
  const [data, setData] = useState<AllocationData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerTarget, setDrawerTarget] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<TenantDefaultConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<TenantDefaultConfig>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allocRes, empList, defaultsRes] = await Promise.all([
        quotaApi.getAllocation(),
        employeeApi.list().catch(() => [] as Employee[]),
        quotaApi.getDefaults().catch(() => null),
      ]);
      setData(allocRes.data);
      setEmployees(empList);
      if (defaultsRes) setDefaults(defaultsRes.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      const res = await quotaApi.updateDefaults(draft);
      setDefaults(res.data);
      setEditing(false);
      setDraft({});
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Icon name="hourglass_empty" size={20} className="animate-spin" />
        加载中...
      </div>
    );
  }

  if (!data) return null;

  const { totals, rows } = data;

  return (
    <div className="space-y-4">
      {/* Tenant Default Config */}
      {defaults && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon name="settings" size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">新实例默认配置</span>
              <span className="text-[11px] text-gray-400">（新开通的数字员工将继承此配置）</span>
            </div>
            {!editing && (
              <button
                onClick={() => {
                  setDraft({ ...defaults });
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#007AFF] hover:bg-[#007AFF]/5 rounded-md transition-colors"
              >
                <Icon name="edit" size={14} />
                编辑
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <DefaultSelect
                  label="默认 CPU"
                  value={draft.cpu ?? defaults.cpu}
                  options={CPU_OPTIONS}
                  onChange={(v) => setDraft((p) => ({ ...p, cpu: v }))}
                />
                <DefaultSelect
                  label="默认内存"
                  value={draft.memory ?? defaults.memory}
                  options={MEMORY_OPTIONS}
                  onChange={(v) => setDraft((p) => ({ ...p, memory: v }))}
                />
                <DefaultSelect
                  label="默认存储"
                  value={draft.storage ?? defaults.storage}
                  options={STORAGE_OPTIONS}
                  onChange={(v) => setDraft((p) => ({ ...p, storage: v }))}
                />
                <DefaultNumberInput
                  label="月 Token 预算"
                  value={draft.monthlyBudget ?? defaults.monthlyBudget}
                  onChange={(v) => setDraft((p) => ({ ...p, monthlyBudget: v }))}
                />
                <DefaultNumberInput
                  label="日 Token 预算"
                  value={draft.dailyBudget ?? defaults.dailyBudget}
                  onChange={(v) => setDraft((p) => ({ ...p, dailyBudget: v }))}
                />
                <DefaultNumberInput
                  label="最大并发实例"
                  value={draft.maxConcurrency ?? defaults.maxConcurrency}
                  onChange={(v) => setDraft((p) => ({ ...p, maxConcurrency: v }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveDefaults}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft({});
                  }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              <DefaultCard label="CPU" value={defaults.cpu} icon="memory" />
              <DefaultCard label="内存" value={defaults.memory} icon="sd_storage" />
              <DefaultCard label="存储" value={defaults.storage} icon="hard_drive" />
              <DefaultCard
                label="月预算"
                value={formatBudget(defaults.monthlyBudget)}
                icon="payments"
              />
              <DefaultCard label="日预算" value={formatBudget(defaults.dailyBudget)} icon="today" />
              <DefaultCard label="并发上限" value={String(defaults.maxConcurrency)} icon="speed" />
            </div>
          )}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="实例数"
          value={`${totals.instanceCount} / ${totals.instanceLimit}`}
          pct={
            totals.instanceLimit
              ? Math.round((totals.instanceCount / totals.instanceLimit) * 100)
              : 0
          }
          icon="dns"
        />
        <SummaryCard
          label="预算已分配"
          value={`¥${totals.budgetAllocated}`}
          pct={
            totals.budgetLimit ? Math.round((totals.budgetAllocated / totals.budgetLimit) * 100) : 0
          }
          icon="payments"
        />
      </div>

      {/* Allocation table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">员工</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">状态</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">CPU 用量</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">内存用量</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">月预算</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">已用预算</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">配置类型</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const badge = STATE_BADGE[row.state] ?? STATE_BADGE.stopped;
              const budgetPct = row.monthlyBudget
                ? Math.round((row.budgetUsed / row.monthlyBudget) * 100)
                : 0;
              const cpuUsedMillis = parseCpuMillis(row.cpuUsed);
              const cpuTotalMillis = parseCpuMillis(row.cpu);
              const cpuPct = cpuTotalMillis
                ? Math.round((cpuUsedMillis / cpuTotalMillis) * 100)
                : 0;
              const memUsedMi = parseMemoryMi(row.memoryUsed);
              const memTotalMi = parseMemoryMi(row.memory);
              const memPct = memTotalMi ? Math.round((memUsedMi / memTotalMi) * 100) : 0;
              return (
                <tr key={row.instanceId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.instanceName}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 text-[11px] rounded-full ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-gray-600">
                        {formatCpu(cpuUsedMillis)}
                        <span className="text-gray-300"> / </span>
                        {formatCpu(cpuTotalMillis)}
                      </span>
                      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usageBarColor(cpuPct)}`}
                          style={{ width: `${Math.min(cpuPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums">{cpuPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-gray-600">
                        {formatMem(memUsedMi)}
                        <span className="text-gray-300"> / </span>
                        {formatMem(memTotalMi)}
                      </span>
                      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usageBarColor(memPct)}`}
                          style={{ width: `${Math.min(memPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums">{memPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">¥{row.monthlyBudget}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">¥{row.budgetUsed}</span>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usageBarColor(budgetPct)}`}
                          style={{ width: `${Math.min(budgetPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[11px] ${
                        row.resourceSource === 'custom' ? 'text-[#007AFF]' : 'text-gray-400'
                      }`}
                    >
                      {row.resourceSource === 'custom' ? '自定义' : '默认'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setDrawerTarget(row.instanceId)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#007AFF] hover:bg-[#007AFF]/5 rounded-md transition-colors"
                    >
                      <Icon name="tune" size={14} />
                      配置
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  暂无员工实例
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EmployeeResourceDrawer
        open={drawerTarget !== null}
        employeeId={drawerTarget}
        employees={employees}
        onClose={() => setDrawerTarget(null)}
        onSave={() => {
          setDrawerTarget(null);
          load();
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  pct,
  icon,
}: {
  label: string;
  value: string;
  pct: number;
  icon: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#007AFF]/10">
        <Icon name={icon} size={18} className="text-[#007AFF]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{value}</div>
        <div className="text-[11px] text-gray-500">
          {label} · {pct}%
        </div>
      </div>
    </div>
  );
}

function DefaultCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
      <Icon name={icon} size={14} className="text-gray-400" />
      <div>
        <div className="text-[11px] text-gray-400">{label}</div>
        <div className="text-sm font-medium text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function DefaultSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/30 outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function DefaultNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/30 outline-none"
      />
    </div>
  );
}

function formatBudget(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
