/**
 * 数字员工列表的筛选 / 排序 / 聚合 —— 纯领域逻辑。
 *
 * 从 presentation 层下沉而来：原 EmployeesSection.tsx 内联的
 * 9 个过滤分支 + createdAt 倒序排序 + 节点统计聚合，全部集中到此处，
 * 形成无 React 依赖、无副作用的纯函数，便于单元测试。
 *
 * 行为与原实现逐行等价，UI 不变。
 */

import type { Employee, AgentRuntime } from './types';
import type { InstanceScope } from '../shared/types';

/** 筛选条件（与原组件 state 一一对应） */
export interface EmployeeListFilters {
  /** 实例ID / 姓名 / 显示名 / 会话ID 关键字 */
  keyword: string;
  /** 固定会话ID（matrixRoomId）子串 */
  channelFilter: string;
  /** 员工状态精确匹配 */
  stateFilter: string;
  /** 部门精确匹配 */
  deptFilter: string;
  /** 岗位精确匹配 */
  roleFilter: string;
  /** 实例范围（个人/组织）精确匹配，缺省归一为 organization */
  scopeFilter: '' | InstanceScope;
  /** Agent 运行时类型（openclaw / harness），缺省归一为 openclaw */
  agentType: AgentRuntime | '';
  /** 集群类型（k8s / cubesandbox），按 remote.cluster 归一匹配 */
  clusterType: '' | 'k8s' | 'cubesandbox';
  /** 节点名子串（ops 视图） */
  nodeFilter: string;
  /** Pod 名子串（ops 视图） */
  podFilter: string;
}

/** 空筛选条件，组件初始化时复用 */
export const EMPTY_EMPLOYEE_FILTERS: EmployeeListFilters = {
  keyword: '',
  channelFilter: '',
  stateFilter: '',
  deptFilter: '',
  roleFilter: '',
  scopeFilter: '',
  agentType: '',
  clusterType: '',
  nodeFilter: '',
  podFilter: '',
};

/**
 * 按筛选条件过滤员工列表，并按 createdAt 倒序排序。
 *
 * 等价于原组件 `employees.filter(...).sort(...)`，逻辑分支保持一致：
 * 1. agentType：归一（缺省 openclaw）后不等则排除
 * 2. clusterType：remote.cluster 归一小写后不等则排除
 * 3. keyword：id / name / displayName / matrixRoomId 任一包含
 * 4. channelFilter：matrixRoomId 包含
 * 5. stateFilter / deptFilter / roleFilter：精确不等则排除
 * 6. scopeFilter：归一（缺省 organization）后不等则排除
 * 7. nodeFilter / podFilter：remote.nodeName / podName 包含
 * 8. 排序：createdAt（缺失视为 0）倒序
 */
export function selectFilteredEmployees(
  employees: Employee[],
  filters: EmployeeListFilters,
): Employee[] {
  return employees
    .filter((e) => {
      if (filters.agentType && (e.agentRuntime || 'openclaw') !== filters.agentType) {
        return false;
      }
      if (filters.clusterType) {
        const cluster = (e.remote?.cluster || '').toLowerCase();
        if (cluster !== filters.clusterType) return false;
      }
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const match =
          e.id.toLowerCase().includes(kw) ||
          e.name.toLowerCase().includes(kw) ||
          (e.displayName || '').toLowerCase().includes(kw) ||
          (e.matrixRoomId || '').toLowerCase().includes(kw);
        if (!match) return false;
      }
      if (
        filters.channelFilter &&
        !(e.matrixRoomId || '').toLowerCase().includes(filters.channelFilter.toLowerCase())
      ) {
        return false;
      }
      if (filters.stateFilter && e.status !== filters.stateFilter) return false;
      if (filters.deptFilter && e.department !== filters.deptFilter) return false;
      if (filters.roleFilter && e.role !== filters.roleFilter) return false;
      if (filters.scopeFilter && (e.scope || 'organization') !== filters.scopeFilter) {
        return false;
      }
      if (filters.nodeFilter) {
        const nn = (e.remote?.nodeName || '').toLowerCase();
        if (!nn.includes(filters.nodeFilter.toLowerCase())) return false;
      }
      if (filters.podFilter) {
        const pn = (e.remote?.podName || '').toLowerCase();
        if (!pn.includes(filters.podFilter.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
}

/** 页头统计卡片所需聚合 */
export interface EmployeeStats {
  total: number;
  /** 组织覆盖的部门数（去重） */
  deptCount: number;
  personalCount: number;
  orgCount: number;
}

/**
 * 计算页头统计：总数 / 部门覆盖数 / 个人实例数 / 组织实例数。
 */
export function selectEmployeeStats(employees: Employee[]): EmployeeStats {
  const departments = new Set(employees.map((e) => e.department).filter(Boolean));
  const personalCount = employees.filter((e) => e.scope === 'personal').length;
  const orgCount = employees.filter((e) => (e.scope || 'organization') === 'organization').length;
  return {
    total: employees.length,
    deptCount: departments.size,
    personalCount,
    orgCount,
  };
}

/**
 * 汇总所有员工的 nodeName 集合，按字母序返回（用于节点漂移目标选择）。
 */
export function selectAvailableNodes(employees: Employee[]): string[] {
  const nodeSet = new Set<string>();
  for (const e of employees) {
    if (e.remote?.nodeName) nodeSet.add(e.remote.nodeName);
  }
  return Array.from(nodeSet).sort();
}

/** 单节点健康聚合 */
export interface NodeHealth {
  total: number;
  failed: number;
  status: 'healthy' | 'warning' | 'unhealthy';
}

/**
 * 按节点聚合健康状态：统计每节点实例数 / 失败数，
 * 并按 nodeStatus 聚合为节点级健康度（unhealthy 优先于 warning 优先于 healthy）。
 *
 * 失败判定：员工 status === 'error' || 'failed'。
 */
export function selectNodeHealthMap(employees: Employee[]): Map<string, NodeHealth> {
  const map = new Map<string, NodeHealth>();
  for (const e of employees) {
    const nodeName = e.remote?.nodeName;
    if (!nodeName) continue;
    if (!map.has(nodeName)) {
      map.set(nodeName, { total: 0, failed: 0, status: 'healthy' });
    }
    const node = map.get(nodeName)!;
    node.total++;
    if (e.status === 'error' || e.status === 'failed') node.failed++;
    const ns = e.remote?.nodeStatus;
    if (ns === 'unhealthy') node.status = 'unhealthy';
    else if (ns === 'warning' && node.status !== 'unhealthy') node.status = 'warning';
  }
  return map;
}

/**
 * 取可选部门列表（去重，保留原值用于精确匹配筛选）。
 */
export function selectDeptOptions(employees: Employee[]): string[] {
  return [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[];
}

/**
 * 取可选岗位列表（去重，保留原值用于精确匹配筛选）。
 */
export function selectRoleOptions(employees: Employee[]): string[] {
  return [...new Set(employees.map((e) => e.role).filter(Boolean))] as string[];
}
