import { describe, it, expect } from 'vitest';
import {
  selectFilteredEmployees,
  selectEmployeeStats,
  selectAvailableNodes,
  selectNodeHealthMap,
  selectDeptOptions,
  selectRoleOptions,
  EMPTY_EMPLOYEE_FILTERS,
  type EmployeeListFilters,
} from '../selectEmployeeList';
import type { Employee } from '../types';

/** 构造测试用员工对象的最小辅助 */
function makeEmp(partial: Partial<Employee>): Employee {
  return {
    id: 'e1',
    name: 'bot',
    ...partial,
  } as Employee;
}

const baseEmployees: Employee[] = [
  makeEmp({
    id: 'a',
    name: 'Alpha',
    displayName: '甲',
    department: 'ops',
    role: 'operator',
    scope: 'organization',
    status: 'active',
    agentRuntime: 'cockpit',
    matrixRoomId: '!room-a:server',
    createdAt: '2024-01-01T00:00:00Z',
    remote: { nodeName: 'node-1', podName: 'pod-a', cluster: 'k8s' },
  }),
  makeEmp({
    id: 'b',
    name: 'Beta',
    displayName: '乙',
    department: 'finance',
    role: 'analyst',
    scope: 'personal',
    status: 'error',
    agentRuntime: 'harness',
    matrixRoomId: '!room-b:server',
    createdAt: '2024-01-02T00:00:00Z',
    remote: { nodeName: 'node-2', podName: 'pod-b', cluster: 'cubesandbox' },
  }),
  makeEmp({
    id: 'c',
    name: 'Gamma',
    department: 'ops',
    role: 'operator',
    scope: 'organization',
    status: 'paused',
    createdAt: '2024-01-03T00:00:00Z',
  }),
];

describe('selectFilteredEmployees', () => {
  it('默认筛选返回全部，并按 createdAt 倒序', () => {
    const r = selectFilteredEmployees(baseEmployees, EMPTY_EMPLOYEE_FILTERS);
    expect(r.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('keyword 命中 id / name / displayName / matrixRoomId 任一', () => {
    expect(
      selectFilteredEmployees(baseEmployees, { ...EMPTY_EMPLOYEE_FILTERS, keyword: 'alpha' }).map(
        (e) => e.id
      )
    ).toEqual(['a']);
    expect(
      selectFilteredEmployees(baseEmployees, { ...EMPTY_EMPLOYEE_FILTERS, keyword: '甲' }).map(
        (e) => e.id
      )
    ).toEqual(['a']);
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        keyword: '!room-b',
      }).map((e) => e.id)
    ).toEqual(['b']);
  });

  it('keyword 不区分大小写', () => {
    expect(
      selectFilteredEmployees(baseEmployees, { ...EMPTY_EMPLOYEE_FILTERS, keyword: 'BETA' }).map(
        (e) => e.id
      )
    ).toEqual(['b']);
  });

  it('agentType 归一：缺省视为 cockpit', () => {
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        agentType: 'cockpit',
      }).map((e) => e.id)
    ).toEqual(['c', 'a']); // b 是 harness
  });

  it('clusterType 按 remote.cluster 归一小写匹配', () => {
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        clusterType: 'k8s',
      }).map((e) => e.id)
    ).toEqual(['a']);
  });

  it('精确字段筛选：state / dept / role / scope', () => {
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        stateFilter: 'paused',
      }).map((e) => e.id)
    ).toEqual(['c']);
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        deptFilter: 'ops',
      }).map((e) => e.id)
    ).toEqual(['c', 'a']);
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        roleFilter: 'analyst',
      }).map((e) => e.id)
    ).toEqual(['b']);
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        scopeFilter: 'personal',
      }).map((e) => e.id)
    ).toEqual(['b']);
  });

  it('scopeFilter 归一：缺省 scope 视为 organization', () => {
    // gamma 无 scope 字段，应被 organization 命中
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        scopeFilter: 'organization',
      }).map((e) => e.id)
    ).toEqual(['c', 'a']);
  });

  it('channelFilter 按 matrixRoomId 子串匹配', () => {
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        channelFilter: 'room-a',
      }).map((e) => e.id)
    ).toEqual(['a']);
  });

  it('nodeFilter / podFilter 按 remote 字段子串匹配', () => {
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        nodeFilter: 'node-2',
      }).map((e) => e.id)
    ).toEqual(['b']);
    expect(
      selectFilteredEmployees(baseEmployees, {
        ...EMPTY_EMPLOYEE_FILTERS,
        podFilter: 'pod-a',
      }).map((e) => e.id)
    ).toEqual(['a']);
  });

  it('createdAt 缺失视为 0，排在最后', () => {
    const noDate = makeEmp({ id: 'z', name: 'z', createdAt: undefined });
    const r = selectFilteredEmployees([...baseEmployees, noDate], EMPTY_EMPLOYEE_FILTERS);
    expect(r[r.length - 1].id).toBe('z');
  });

  it('多条件叠加取交集', () => {
    const filters: EmployeeListFilters = {
      ...EMPTY_EMPLOYEE_FILTERS,
      deptFilter: 'ops',
      stateFilter: 'active',
      agentType: 'cockpit',
    };
    expect(selectFilteredEmployees(baseEmployees, filters).map((e) => e.id)).toEqual(['a']);
  });

  it('空列表输入返回空列表', () => {
    expect(selectFilteredEmployees([], EMPTY_EMPLOYEE_FILTERS)).toEqual([]);
  });
});

describe('selectEmployeeStats', () => {
  it('统计总数 / 部门覆盖 / 个人 / 组织（缺省归一为组织）', () => {
    const stats = selectEmployeeStats(baseEmployees);
    expect(stats.total).toBe(3);
    expect(stats.deptCount).toBe(2); // ops, finance
    expect(stats.personalCount).toBe(1);
    expect(stats.orgCount).toBe(2); // a + c(gamma 无 scope 归一组织)
  });

  it('空列表全零', () => {
    const stats = selectEmployeeStats([]);
    expect(stats).toEqual({ total: 0, deptCount: 0, personalCount: 0, orgCount: 0 });
  });
});

describe('selectAvailableNodes', () => {
  it('去重并按字母序返回', () => {
    expect(selectAvailableNodes(baseEmployees)).toEqual(['node-1', 'node-2']);
  });
  it('无 remote 的员工不贡献节点', () => {
    expect(selectAvailableNodes([makeEmp({ id: 'x' })])).toEqual([]);
  });
});

describe('selectNodeHealthMap', () => {
  it('聚合每节点 total / failed / status，unhealthy 优先级最高', () => {
    const emps: Employee[] = [
      makeEmp({
        id: '1',
        status: 'error',
        remote: { nodeName: 'n1', nodeStatus: 'healthy' },
      }),
      makeEmp({
        id: '2',
        status: 'active',
        remote: { nodeName: 'n1', nodeStatus: 'warning' },
      }),
      makeEmp({
        id: '3',
        status: 'active',
        remote: { nodeName: 'n2', nodeStatus: 'unhealthy' },
      }),
    ];
    const map = selectNodeHealthMap(emps);
    expect(map.get('n1')).toEqual({ total: 2, failed: 1, status: 'warning' });
    expect(map.get('n2')).toEqual({ total: 1, failed: 0, status: 'unhealthy' });
  });

  it('warning 不会覆盖已有的 unhealthy', () => {
    const emps: Employee[] = [
      makeEmp({ id: '1', status: 'active', remote: { nodeName: 'n1', nodeStatus: 'unhealthy' } }),
      makeEmp({ id: '2', status: 'active', remote: { nodeName: 'n1', nodeStatus: 'warning' } }),
    ];
    expect(selectNodeHealthMap(emps).get('n1')?.status).toBe('unhealthy');
  });

  it('failed 计数：status=error 或 failed', () => {
    const emps: Employee[] = [
      makeEmp({ id: '1', status: 'error', remote: { nodeName: 'n1' } }),
      makeEmp({ id: '2', status: 'failed', remote: { nodeName: 'n1' } }),
      makeEmp({ id: '3', status: 'active', remote: { nodeName: 'n1' } }),
    ];
    expect(selectNodeHealthMap(emps).get('n1')?.failed).toBe(2);
  });

  it('无 nodeName 的员工被跳过', () => {
    expect(selectNodeHealthMap([makeEmp({ id: 'x', remote: {} })]).size).toBe(0);
  });
});

describe('selectDeptOptions / selectRoleOptions', () => {
  it('去重并保留原值（用于精确匹配）', () => {
    expect(selectDeptOptions(baseEmployees).sort()).toEqual(['finance', 'ops']);
    expect(selectRoleOptions(baseEmployees).sort()).toEqual(['analyst', 'operator']);
  });
  it('过滤掉空值', () => {
    expect(selectDeptOptions([makeEmp({ id: 'x', department: undefined })])).toEqual([]);
  });
});
