import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { useToastStore } from '../../../application/stores/toastStore';
import {
  quotaApi,
  employeeApi,
  employeeDetailApi,
  type QuotaDashboardData,
  type Employee,
} from '../../../application/services/adminApi';

interface NodeSummary {
  nodeName: string;
  total: number;
  running: number;
  stopped: number;
  failed: number;
  cpuTotalMillis: number;
  memoryTotalMi: number;
  instances: { name: string; state: string; cpuMillis: number; memoryMi: number }[];
}

const RESOURCE_META: Record<string, { icon: string; label: string; color: string }> = {
  instance_count: { icon: 'dns', label: '实例数量', color: '#007AFF' },
  token_monthly: { icon: 'token', label: '月度 Token', color: '#34C759' },
  storage: { icon: 'storage', label: '存储空间', color: '#FF9500' },
  api_calls: { icon: 'api', label: 'API 调用', color: '#AF52DE' },
};

function UsageRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function formatValue(val: number, unit: string): string {
  if (unit === 'tokens' && val >= 10000) return `${(val / 10000).toFixed(1)}万`;
  if (unit === 'MB' && val >= 1024) return `${(val / 1024).toFixed(1)} GB`;
  return String(val);
}

function formatLimit(val: number, unit: string): string {
  if (unit === 'tokens' && val >= 10000) return `${(val / 10000).toFixed(0)}万`;
  if (unit === 'MB' && val >= 1024) return `${(val / 1024).toFixed(0)} GB`;
  return String(val);
}

function parseCpuMillis(cpu?: string): number {
  if (!cpu) return 500;
  if (cpu.endsWith('m')) return parseInt(cpu, 10) || 0;
  return (parseFloat(cpu) || 0) * 1000;
}

function parseMemoryMi(mem?: string): number {
  if (!mem) return 512;
  if (mem.endsWith('Gi')) return (parseFloat(mem) || 0) * 1024;
  if (mem.endsWith('Mi')) return parseFloat(mem) || 0;
  return parseFloat(mem) || 0;
}

function formatCpu(millis: number): string {
  return millis >= 1000 ? `${(millis / 1000).toFixed(1)} Core` : `${millis}m`;
}

function formatMemory(mi: number): string {
  return mi >= 1024 ? `${(mi / 1024).toFixed(1)} Gi` : `${mi} Mi`;
}

function aggregateNodes(employees: Employee[]): NodeSummary[] {
  const map = new Map<string, NodeSummary>();
  for (const emp of employees) {
    const remote = emp.remote as { nodeName?: string } | undefined;
    const nodeName = remote?.nodeName || '未分配';
    const state = String(emp.state ?? emp.status ?? 'unknown');
    const cpuMillis = parseCpuMillis(emp.resources?.compute?.cpu);
    const memoryMi = parseMemoryMi(emp.resources?.compute?.memory);
    if (!map.has(nodeName)) {
      map.set(nodeName, {
        nodeName,
        total: 0,
        running: 0,
        stopped: 0,
        failed: 0,
        cpuTotalMillis: 0,
        memoryTotalMi: 0,
        instances: [],
      });
    }
    const node = map.get(nodeName)!;
    node.total++;
    node.cpuTotalMillis += cpuMillis;
    node.memoryTotalMi += memoryMi;
    if (state === 'running') node.running++;
    else if (state === 'stopped') node.stopped++;
    else if (state === 'failed' || state === 'error') node.failed++;
    node.instances.push({ name: emp.name, state, cpuMillis, memoryMi });
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function QuotaDashboardTab() {
  const [data, setData] = useState<QuotaDashboardData | null>(null);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evacuateNode, setEvacuateNode] = useState<string | null>(null);
  const [evacuateTarget, setEvacuateTarget] = useState('');
  const [evacuating, setEvacuating] = useState(false);

  const targetNodes = useMemo(
    () => nodes.filter((n) => n.nodeName !== evacuateNode && n.nodeName !== '未分配'),
    [nodes, evacuateNode]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, emps] = await Promise.all([
        quotaApi.getDashboard(),
        employeeApi.list().catch(() => [] as Employee[]),
      ]);
      setData(res.data);
      setEmployees(emps);
      setNodes(aggregateNodes(emps));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Icon name="hourglass_empty" size={20} className="animate-spin" />
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
        <Icon name="error_outline" size={28} className="text-red-400" />
        <p className="text-sm">{error}</p>
        <button onClick={load} className="text-xs text-[#007AFF] hover:underline">
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  const handleEvacuate = async () => {
    if (!evacuateNode || !evacuateTarget) return;
    setEvacuating(true);
    const toMigrate = employees.filter((e) => {
      const remote = e.remote as { nodeName?: string } | undefined;
      return (remote?.nodeName || '未分配') === evacuateNode;
    });
    let ok = 0;
    let fail = 0;
    for (const emp of toMigrate) {
      try {
        await employeeDetailApi.instanceAction(emp.id, 'migrate', { targetNode: evacuateTarget });
        ok++;
      } catch {
        fail++;
      }
    }
    setEvacuating(false);
    setEvacuateNode(null);
    setEvacuateTarget('');
    if (fail === 0) {
      useToastStore.getState().addToast(`已疏散 ${ok} 个实例到 ${evacuateTarget}`, 'success');
    } else {
      useToastStore.getState().addToast(`疏散完成：${ok} 成功，${fail} 失败`, 'error');
    }
    load();
  };

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {data.alerts.active > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <Icon name="warning" size={18} className="text-red-500" />
          <span className="text-sm text-red-700 font-medium">
            {data.alerts.active} 条活跃告警需要处理
          </span>
        </div>
      )}

      {/* Usage cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.items.map((item) => {
          const meta = RESOURCE_META[item.resourceType] ?? {
            icon: 'help',
            label: item.resourceType,
            color: '#6B7280',
          };
          const isWarning = item.usagePct >= 80;
          const isCritical = item.usagePct >= 90;
          return (
            <div
              key={item.resourceType}
              className={`bg-white rounded-xl border p-4 ${
                isCritical
                  ? 'border-red-200 bg-red-50/30'
                  : isWarning
                    ? 'border-orange-200 bg-orange-50/30'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name={meta.icon} size={16} style={{ color: meta.color }} />
                    <span className="text-xs text-gray-500">{meta.label}</span>
                  </div>
                  <div className="text-xl font-semibold text-gray-900">
                    {formatValue(item.current, item.unit)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    / {formatLimit(item.limit, item.unit)} {item.unit === '次/日' ? '' : item.unit}
                  </div>
                </div>
                <div className="relative flex items-center justify-center">
                  <UsageRing
                    pct={item.usagePct}
                    color={isCritical ? '#EF4444' : isWarning ? '#F59E0B' : meta.color}
                  />
                  <span
                    className={`absolute text-xs font-semibold ${
                      isCritical ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-gray-700'
                    }`}
                  >
                    {item.usagePct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Node Resource Distribution */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1.5">
          <Icon name="dns" size={16} className="text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700">节点资源分布</h3>
          <span className="text-[11px] text-gray-400 ml-1">
            共 {nodes.length} 个节点，{nodes.reduce((s, n) => s + n.total, 0)} 个实例
            {nodes.length > 0 && (
              <>
                {' '}
                · CPU {formatCpu(nodes.reduce((s, n) => s + n.cpuTotalMillis, 0))} · 内存{' '}
                {formatMemory(nodes.reduce((s, n) => s + n.memoryTotalMi, 0))}
              </>
            )}
          </span>
        </div>
        {nodes.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-gray-400">暂无节点数据</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-medium">节点</th>
                <th className="px-4 py-2 text-center font-medium">实例数</th>
                <th className="px-4 py-2 text-center font-medium">运行中</th>
                <th className="px-4 py-2 text-center font-medium">异常</th>
                <th className="px-4 py-2 text-center font-medium">CPU 已用</th>
                <th className="px-4 py-2 text-center font-medium">内存已用</th>
                <th className="px-4 py-2 text-left font-medium">负载分布</th>
                <th className="px-4 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const maxTotal = Math.max(...nodes.map((n) => n.total), 1);
                const barPct = (node.total / maxTotal) * 100;
                return (
                  <tr key={node.nodeName} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Icon name="computer" size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-700 text-xs">{node.nodeName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums font-medium text-gray-800">
                      {node.total}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`tabular-nums ${node.running > 0 ? 'text-green-600 font-medium' : 'text-gray-300'}`}
                      >
                        {node.running}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`tabular-nums ${node.failed > 0 ? 'text-red-500 font-medium' : 'text-gray-300'}`}
                      >
                        {node.failed}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs tabular-nums text-gray-700 font-medium">
                        {formatCpu(node.cpuTotalMillis)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs tabular-nums text-gray-700 font-medium">
                        {formatMemory(node.memoryTotalMi)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                          {node.running > 0 && (
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${(node.running / node.total) * barPct}%` }}
                            />
                          )}
                          {node.total - node.running - node.failed > 0 && (
                            <div
                              className="h-full bg-gray-300"
                              style={{
                                width: `${((node.total - node.running - node.failed) / node.total) * barPct}%`,
                              }}
                            />
                          )}
                          {node.failed > 0 && (
                            <div
                              className="h-full bg-red-400"
                              style={{ width: `${(node.failed / node.total) * barPct}%` }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">{Math.round(barPct)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {node.failed > 0 && node.nodeName !== '未分配' && (
                        <button
                          onClick={() => {
                            setEvacuateNode(node.nodeName);
                            setEvacuateTarget(targetNodes[0]?.nodeName || '');
                          }}
                          className="px-2 py-1 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Icon name="exit_to_app" size={12} className="mr-0.5 align-[-2px]" />
                          疏散
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
        <Icon name="info" size={16} className="text-[#007AFF] mt-0.5" />
        <p className="text-xs text-gray-600">
          配额上限由运管平台设定，管控平台可查看使用情况并配置预警规则。实际用量通过后端实时聚合。
        </p>
      </div>

      <Modal
        open={!!evacuateNode}
        onClose={() => {
          setEvacuateNode(null);
          setEvacuateTarget('');
        }}
        title={`疏散节点 ${evacuateNode ?? ''}`}
        width="w-[420px]"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            将 <span className="font-medium text-gray-800">{evacuateNode}</span>{' '}
            上的所有实例迁移到目标节点。
          </p>
          {targetNodes.length === 0 ? (
            <p className="text-sm text-red-500">无可用的目标节点</p>
          ) : (
            <div>
              <label className="text-xs text-gray-500 block mb-1">目标节点</label>
              <select
                value={evacuateTarget}
                onChange={(e) => setEvacuateTarget(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                {targetNodes.map((n) => (
                  <option key={n.nodeName} value={n.nodeName}>
                    {n.nodeName}（{n.running} 运行 / {n.total} 实例）
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEvacuateNode(null);
                setEvacuateTarget('');
              }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleEvacuate}
              disabled={evacuating || !evacuateTarget}
              className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {evacuating ? '疏散中...' : '确认疏散'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
