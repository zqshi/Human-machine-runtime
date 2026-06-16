import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  employeeApi,
  employeeDetailApi,
  type Employee,
  type AgentRuntime,
} from '../../../application/services/adminApi';
import type { InstanceScope } from '../../../domain/shared/types';
import { useToastStore } from '../../../application/stores/toastStore';
import { StatCard } from '../../components/ui/StatCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import { EmployeeEditDrawer } from './EmployeeEditDrawer';
import { EmployeeCreateWizard } from './EmployeeCreateWizard';

const SCOPE_BADGE: Record<string, string> = {
  personal: 'bg-purple-50 text-purple-700',
  organization: 'bg-blue-50 text-blue-700',
};
const SCOPE_LABEL: Record<string, string> = {
  personal: '个人',
  organization: '组织',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  running: 'bg-green-50 text-green-700',
  paused: 'bg-yellow-50 text-yellow-700',
  provisioning: 'bg-blue-50 text-blue-700',
  pending: 'bg-yellow-50 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
  error: 'bg-red-50 text-red-700',
  failed: 'bg-red-50 text-red-700',
};

const DEPT_LABELS: Record<string, string> = {
  ops: '运营',
  operation: '运营',
  operations: '运营',
  finance: '财务',
  hr: '人力资源',
  human_resources: '人力资源',
  legal: '法务',
  marketing: '市场',
  sales: '销售',
  product: '产品',
  engineering: '研发',
  tech: '技术',
  it: '技术支持',
  support: '客服',
};

const ROLE_LABELS: Record<string, string> = {
  operator: '操作员',
  dispatcher: '调度员',
  analyst: '分析师',
  reviewer: '审核员',
  manager: '经理',
  admin: '管理员',
  specialist: '专员',
  engineer: '工程师',
  assistant: '助理',
};

type DrawerMode = 'none' | 'detail' | 'edit';
type ViewMode = 'ops' | 'biz';
type AgentFilter = AgentRuntime | '';
type ClusterType = '' | 'k8s' | 'cubesandbox';

const NODE_STATUS_BADGE: Record<string, string> = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600',
  unhealthy: 'text-red-600',
};
const NODE_STATUS_ICON: Record<string, string> = {
  healthy: 'check_circle',
  warning: 'warning',
  unhealthy: 'error',
};

const VIEW_MODE_COLUMNS: Record<string, readonly { key: string; label: string; width: string }[]> = {
  ops: [
    { key: 'name', label: '名称', width: '' },
    { key: 'status', label: '状态', width: '' },
    { key: 'podName', label: 'Pod', width: '' },
    { key: 'nodeName', label: '节点', width: '' },
    { key: 'restarts', label: '重启', width: '' },
    { key: 'actions', label: '操作', width: '' },
  ],
  biz: [
    { key: 'name', label: '名称', width: '' },
    { key: 'status', label: '状态', width: '' },
    { key: 'employeeNo', label: '工号', width: '' },
    { key: 'department', label: '部门/岗位', width: '' },
    { key: 'scope', label: '类型', width: '' },
    { key: 'actions', label: '操作', width: '' },
  ],
  cubesandbox: [
    { key: 'id', label: 'Instance ID', width: '' },
    { key: 'agentId', label: 'Agent ID', width: '' },
    { key: 'runMode', label: '状态模式', width: '' },
    { key: 'heartbeat', label: '心跳', width: '' },
    { key: 'healthStatus', label: '健康状态', width: '' },
    { key: 'runtimeTemplate', label: 'Runtime Template', width: '' },
    { key: 'agentRevision', label: 'Agent Revision', width: '' },
  ],
};

function formatDept(v?: string): string {
  if (!v) return '-';
  return DEPT_LABELS[v.toLowerCase().trim()] || v;
}
function formatRole(v?: string): string {
  if (!v) return '-';
  return ROLE_LABELS[v.toLowerCase().trim()] || v;
}

export function EmployeesSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('none');
  const [selectedDetail, setSelectedDetail] = useState<Record<string, unknown> | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{ id: string; action: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // filters
  const [keyword, setKeyword] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'' | InstanceScope>('');
  const [createWizardOpen, setCreateWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('biz');
  const [agentType, setAgentType] = useState<AgentFilter>('');
  const [clusterType, setClusterType] = useState<ClusterType>('cubesandbox');
  const [nodeFilter, setNodeFilter] = useState('');
  const [podFilter, setPodFilter] = useState('');
  const [migrateTarget, setMigrateTarget] = useState<{
    id: string;
    name: string;
    currentNode: string;
  } | null>(null);
  const [migrateNode, setMigrateNode] = useState('');
  const [migrateLoading, setMigrateLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmployees = useCallback(() => {
    employeeApi
      .list()
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const loadEmployees = useCallback(() => {
    setLoading(true);
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchEmployees();
    timerRef.current = setInterval(fetchEmployees, 2500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchEmployees]);

  const filtered = employees.filter((e) => {
    if (agentType && (e.agentRuntime || 'openclaw') !== agentType) return false;
    if (clusterType) {
      const cluster = (e.remote?.cluster || '').toLowerCase();
      if (cluster !== clusterType) return false;
    }
    if (keyword) {
      const kw = keyword.toLowerCase();
      const match =
        e.id.toLowerCase().includes(kw) ||
        e.name.toLowerCase().includes(kw) ||
        (e.displayName || '').toLowerCase().includes(kw) ||
        (e.matrixRoomId || '').toLowerCase().includes(kw);
      if (!match) return false;
    }
    if (
      channelFilter &&
      !(e.matrixRoomId || '').toLowerCase().includes(channelFilter.toLowerCase())
    )
      return false;
    if (stateFilter && e.status !== stateFilter) return false;
    if (deptFilter && e.department !== deptFilter) return false;
    if (roleFilter && e.role !== roleFilter) return false;
    if (scopeFilter && (e.scope || 'organization') !== scopeFilter) return false;
    if (nodeFilter) {
      const nn = (e.remote?.nodeName || '').toLowerCase();
      if (!nn.includes(nodeFilter.toLowerCase())) return false;
    }
    if (podFilter) {
      const pn = (e.remote?.podName || '').toLowerCase();
      if (!pn.includes(podFilter.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  const availableNodes = useMemo(() => {
    const nodeSet = new Set<string>();
    for (const e of employees) {
      if (e.remote?.nodeName) nodeSet.add(e.remote.nodeName);
    }
    return Array.from(nodeSet).sort();
  }, [employees]);

  const nodeHealthMap = useMemo(() => {
    const map = new Map<string, { total: number; failed: number; status: string }>();
    for (const e of employees) {
      const nodeName = e.remote?.nodeName;
      if (!nodeName) continue;
      if (!map.has(nodeName)) map.set(nodeName, { total: 0, failed: 0, status: 'healthy' });
      const node = map.get(nodeName)!;
      node.total++;
      if (e.status === 'error' || e.status === 'failed') node.failed++;
      const ns = e.remote?.nodeStatus;
      if (ns === 'unhealthy') node.status = 'unhealthy';
      else if (ns === 'warning' && node.status !== 'unhealthy') node.status = 'warning';
    }
    return map;
  }, [employees]);

  const deptOptions = [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[];
  const roleOptions = [...new Set(employees.map((e) => e.role).filter(Boolean))] as string[];

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDrawerMode('detail');
    try {
      const detail = await employeeDetailApi.getDetail(id);
      setSelectedDetail(detail);
    } catch {
      const basic = employees.find((e) => e.id === id);
      setSelectedDetail(basic ? { ...basic } : null);
    }
  };

  const openEdit = (id?: string) => {
    if (id) setSelectedId(id);
    setDrawerMode('edit');
  };

  const closeDrawer = () => {
    setDrawerMode('none');
    setSelectedId(null);
    setSelectedDetail(null);
  };

  const handleInstanceAction = async () => {
    if (!actionConfirm) return;
    setActionLoading(true);
    try {
      await employeeDetailApi.instanceAction(actionConfirm.id, actionConfirm.action);
      loadEmployees();
    } catch {
      /* ignore */
    }
    setActionLoading(false);
    setActionConfirm(null);
  };

  const onSaveSuccess = () => {
    loadEmployees();
    closeDrawer();
  };

  const departments = new Set(employees.map((e) => e.department).filter(Boolean));
  const personalCount = employees.filter((e) => e.scope === 'personal').length;
  const orgCount = employees.filter((e) => (e.scope || 'organization') === 'organization').length;
  const stats = {
    total: employees.length,
    deptCount: departments.size,
    personalCount,
    orgCount,
  };

  const ACTION_LABELS: Record<string, string> = {
    start: '启动',
    stop: '停止',
    rebuild: '容器重启',
    delete: '删除',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadEmployees();
  };

  const closeMigrate = useCallback(() => {
    setMigrateTarget(null);
    setMigrateNode('');
  }, []);

  const handleMigrate = useCallback(async () => {
    if (!migrateTarget || !migrateNode.trim()) return;
    setMigrateLoading(true);
    try {
      await employeeDetailApi.instanceAction(migrateTarget.id, 'migrate', {
        targetNode: migrateNode.trim(),
      });
      useToastStore
        .getState()
        .addToast(`节点漂移已提交：${migrateTarget.name} → ${migrateNode}`, 'success');
      loadEmployees();
    } catch (err) {
      useToastStore
        .getState()
        .addToast(`节点漂移失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setMigrateLoading(false);
      setMigrateTarget(null);
      setMigrateNode('');
    }
  }, [migrateTarget, migrateNode, loadEmployees]);

  const selectCls =
    'px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';
  const inputCls = selectCls;

  const activeColumns = viewMode === 'ops' && clusterType === 'cubesandbox'
    ? VIEW_MODE_COLUMNS.cubesandbox
    : VIEW_MODE_COLUMNS[viewMode];

  const isCubeSandboxView = viewMode === 'ops' && clusterType === 'cubesandbox';

  return (
    <div className="p-6 space-y-4">
      {/* 页头统计 */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">数字员工管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">管理数字员工实例、画像配置与资源分配</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 快速创建入口暂不展示，保留组件文件便于后续恢复。 */}
          <button
            onClick={() => setCreateWizardOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors flex items-center gap-1"
          >
            <Icon name="auto_awesome" size={16} />
            创建数字员工
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="员工总数" value={stats.total} icon="group" />
        <StatCard label="组织实例" value={stats.orgCount} icon="business" />
        <StatCard label="个人实例" value={stats.personalCount} icon="person" />
        <StatCard label="组织覆盖" value={`${stats.deptCount} 个部门`} icon="category" />
      </div>

      {/* 视角切换（一级） + Agent 类型筛选（二级） */}
      <div className="flex items-center gap-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('ops')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewMode === 'ops'
                ? 'bg-white text-[#007AFF] font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name="terminal" size={14} />
            运维视角
          </button>
          <button
            onClick={() => setViewMode('biz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewMode === 'biz'
                ? 'bg-white text-[#007AFF] font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name="work" size={14} />
            业务视角
          </button>
        </div>
        {viewMode === 'ops' && (
          <>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="filter_alt" size={14} />
              Agent 类型
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[
                { value: '' as AgentFilter, label: '全部', icon: 'apps' },
                { value: 'openclaw' as AgentFilter, label: 'OpenClaw', icon: 'smart_toy' },
                { value: 'harness' as AgentFilter, label: 'Harness', icon: 'memory' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAgentType(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                    agentType === opt.value
                      ? 'bg-white text-[#007AFF] font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon name={opt.icon} size={13} />
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="dns" size={14} />
              集群
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[
                { value: 'k8s' as ClusterType, label: 'K8s', icon: 'kubernetes' },
                { value: 'cubesandbox' as ClusterType, label: 'CubeSandbox', icon: 'cube' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setClusterType(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                    clusterType === opt.value
                      ? 'bg-white text-[#007AFF] font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon name={opt.icon} size={13} />
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
        {viewMode === 'biz' && (
          <>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="filter_alt" size={14} />
              Agent 类型
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[
                { value: '' as AgentFilter, label: '全部', icon: 'apps' },
                { value: 'openclaw' as AgentFilter, label: 'OpenClaw', icon: 'smart_toy' },
                { value: 'harness' as AgentFilter, label: 'Harness', icon: 'memory' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAgentType(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                    agentType === opt.value
                      ? 'bg-white text-[#007AFF] font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon name={opt.icon} size={13} />
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="按实例ID / 姓名搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputCls} w-56`}
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className={selectCls}
        >
          <option value="">全部状态</option>
          <option value="active">active（运行中）</option>
          <option value="paused">paused（暂停）</option>
          <option value="inactive">inactive（停用）</option>
          <option value="provisioning">provisioning（创建中）</option>
          <option value="pending">pending（待启动）</option>
          <option value="error">error（异常）</option>
        </select>
        {viewMode === 'ops' && !isCubeSandboxView && (
          <>
            <input
              type="text"
              placeholder="Node 节点"
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputCls} w-36`}
            />
            <input
              type="text"
              placeholder="Pod 名称"
              value={podFilter}
              onChange={(e) => setPodFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputCls} w-44`}
            />
          </>
        )}
        {viewMode === 'biz' && (
          <>
            <input
              type="text"
              placeholder="固定会话ID"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputCls} w-40`}
            />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={selectCls}
            >
              <option value="">全部部门</option>
              {deptOptions.sort().map((d) => (
                <option key={d} value={d}>
                  {formatDept(d)}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={selectCls}
            >
              <option value="">全部岗位</option>
              {roleOptions.sort().map((r) => (
                <option key={r} value={r}>
                  {formatRole(r)}
                </option>
              ))}
            </select>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as '' | InstanceScope)}
              className={selectCls}
            >
              <option value="">全部类型</option>
              <option value="organization">组织级</option>
              <option value="personal">个人级</option>
            </select>
          </>
        )}
        <button
          onClick={loadEmployees}
          className="p-2 text-gray-400 hover:text-[#007AFF] transition-colors"
          title="刷新"
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>

      {/* 表格 */}
      {loading && employees.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {activeColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`${col.key === 'actions' ? 'text-right' : 'text-left'} px-3 py-2.5 font-medium text-gray-500 whitespace-nowrap`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const remote = emp.remote;
                  return (
                    <tr
                      key={emp.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors h-14"
                    >
                      {isCubeSandboxView ? (
                        <>
                          <td className="px-3 py-2 font-mono text-xs text-gray-700">
                            {emp.id}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">
                            {String(emp.employeeId ?? emp.id)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                              remote?.runMode === 'persistent'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {remote?.runMode === 'persistent' ? '常驻' : remote?.runMode === 'single' ? '单次' : '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {remote?.heartbeat || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1">
                              <Icon
                                name={NODE_STATUS_ICON[remote?.healthStatus || ''] || 'help'}
                                size={13}
                                className={NODE_STATUS_BADGE[remote?.healthStatus || ''] || 'text-gray-400'}
                              />
                              <span className="text-xs text-gray-600">
                                {remote?.healthStatus === 'healthy' ? '健康'
                                  : remote?.healthStatus === 'warning' ? '告警'
                                  : remote?.healthStatus === 'unhealthy' ? '异常'
                                  : '-'}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">
                            {remote?.runtimeTemplate || '-'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">
                            {remote?.agentRevision || '-'}
                          </td>
                        </>
                      ) : viewMode === 'ops' ? (
                        <>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800">
                              {emp.displayName || emp.name}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">{emp.id}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[emp.status || ''] || 'bg-gray-100 text-gray-500'}`}
                            >
                              {emp.status || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">
                            {remote?.podName || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {remote?.nodeName ? (
                              <span className="flex items-center gap-1">
                                <Icon
                                  name={NODE_STATUS_ICON[remote?.nodeStatus || ''] || 'help'}
                                  size={13}
                                  className={
                                    NODE_STATUS_BADGE[remote?.nodeStatus || ''] || 'text-gray-400'
                                  }
                                />
                                {remote.nodeName}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {remote?.restarts != null ? String(remote.restarts) : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800">
                              {emp.displayName || emp.name}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">{emp.id}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[emp.status || ''] || 'bg-gray-100 text-gray-500'}`}
                            >
                              {emp.status || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {emp.employeeNo || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            <div>
                              {formatDept(emp.department)} / {formatRole(emp.role)}
                            </div>
                            <div className="text-gray-400">{emp.jobTitle || '-'}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs rounded-full ${SCOPE_BADGE[emp.scope || 'organization'] || SCOPE_BADGE.organization}`}
                            >
                              {SCOPE_LABEL[emp.scope || 'organization'] || '组织'}
                            </span>
                          </td>
                        </>
                      )}
                      {!isCubeSandboxView && (
                      <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                        {viewMode === 'biz' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openDetail(emp.id)}
                              className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-gray-100"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => openEdit(emp.id)}
                              className="px-2 py-0.5 text-xs bg-[#007AFF] text-white rounded hover:bg-[#0066DD]"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => setActionConfirm({ id: emp.id, action: 'delete' })}
                              className="px-2 py-0.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                            >
                              删除
                            </button>
                          </div>
                        )}
                        {viewMode === 'ops' && (
                          <div className="flex items-center justify-end gap-0.5">
                            {(['start', 'stop', 'rebuild'] as const).map((act) => (
                              <button
                                key={act}
                                onClick={() => setActionConfirm({ id: emp.id, action: act })}
                                className="px-1.5 py-0.5 text-[11px] border border-gray-200 text-gray-500 rounded hover:bg-gray-100 transition-colors"
                              >
                                {ACTION_LABELS[act]}
                              </button>
                            ))}
                            <button
                              onClick={() =>
                                setMigrateTarget({
                                  id: emp.id,
                                  name: emp.displayName || emp.name,
                                  currentNode: remote?.nodeName || '',
                                })
                              }
                              className="px-1.5 py-0.5 text-[11px] border border-purple-200 text-purple-600 rounded hover:bg-purple-50 transition-colors"
                            >
                              漂移
                            </button>
                          </div>
                        )}
                      </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={activeColumns.length + (isCubeSandboxView ? 0 : 1)}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      暂无员工数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EmployeeDetailDrawer
        open={drawerMode === 'detail'}
        detail={selectedDetail}
        onClose={closeDrawer}
        onEdit={() => openEdit()}
      />
      <EmployeeEditDrawer
        open={drawerMode === 'edit'}
        employeeId={selectedId}
        employees={employees}
        onClose={closeDrawer}
        onSave={onSaveSuccess}
      />
      <EmployeeCreateWizard
        open={createWizardOpen}
        onClose={() => setCreateWizardOpen(false)}
        onSuccess={() => {
          setCreateWizardOpen(false);
          loadEmployees();
        }}
      />
      <ConfirmModal
        open={!!actionConfirm}
        title={`确认${ACTION_LABELS[actionConfirm?.action || ''] || '操作'}`}
        message={`确定要对实例 ${actionConfirm?.id || ''} 执行"${ACTION_LABELS[actionConfirm?.action || ''] || ''}"操作吗？`}
        danger={actionConfirm?.action === 'delete' || actionConfirm?.action === 'stop'}
        loading={actionLoading}
        onConfirm={handleInstanceAction}
        onCancel={() => setActionConfirm(null)}
      />

      {/* 节点漂移 Modal（统一风格） */}
      <Modal open={!!migrateTarget} onClose={closeMigrate} title="节点漂移" width="max-w-sm">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-500">实例</span>
            <span className="text-gray-800 font-medium">{migrateTarget?.name}</span>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-500">当前节点</span>
            <span className="text-gray-800 font-mono text-xs">
              {migrateTarget?.currentNode || '-'}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">目标节点</label>
            <select
              value={migrateNode}
              onChange={(e) => setMigrateNode(e.target.value)}
              className={`w-full ${selectCls}`}
            >
              <option value="">选择目标节点...</option>
              {availableNodes
                .filter((n) => n !== migrateTarget?.currentNode)
                .map((n) => {
                  const h = nodeHealthMap.get(n);
                  const tag =
                    h?.status === 'unhealthy'
                      ? ' (异常)'
                      : h?.status === 'warning'
                        ? ' (告警)'
                        : '';
                  return (
                    <option key={n} value={n}>
                      {n} — {h?.total || 0} 实例{tag}
                    </option>
                  );
                })}
            </select>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            将 Pod 从当前节点迁移到目标节点。适用于 Node
            异常、资源不均衡、节点维护等场景。漂移过程中实例会短暂重启。
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={closeMigrate}
            disabled={migrateLoading}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleMigrate}
            disabled={!migrateNode.trim() || migrateLoading}
            className="px-4 py-2 text-sm rounded-lg text-white bg-[#007AFF] hover:bg-[#0066DD] transition-colors disabled:opacity-50"
          >
            {migrateLoading ? '处理中...' : '确认漂移'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
