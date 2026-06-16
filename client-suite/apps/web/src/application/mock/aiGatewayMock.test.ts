import { describe, it, expect } from 'vitest';
import {
  userGrantSource,
  toggleDeptCascade,
  instanceGrantSource,
  resolveGrantedInstanceIds,
  MOCK_DEPTS,
  MOCK_DEPT_INSTANCES,
  type DeptGrantSelection,
} from './aiGatewayMock';

/** 构造 DeptGrantSelection 的便捷工厂，避免到处 new Set */
const sel = (
  depts: string[] = [],
  users: string[] = [],
  instances: string[] = []
): DeptGrantSelection => ({
  depts: new Set(depts),
  users: new Set(users),
  instances: new Set(instances),
});

describe('userGrantSource — 用户授权来源派生（与 instanceGrantSource 对称）', () => {
  it('空授权 → none', () => {
    expect(userGrantSource('Alice', 'dept-rd', sel())).toBe('none');
  });

  it('用户级直接授权 → user', () => {
    expect(userGrantSource('Alice', 'dept-rd', sel([], ['Alice']))).toBe('user');
  });

  it('部门级授权 → dept（继承自部门）', () => {
    expect(userGrantSource('Alice', 'dept-rd', sel(['dept-rd']))).toBe('dept');
  });

  it('部门优先于用户（部门已覆盖时来源归因到部门规则）', () => {
    expect(userGrantSource('Alice', 'dept-rd', sel(['dept-rd'], ['Alice']))).toBe('dept');
  });

  it('父部门勾选经级联覆盖子部门 → 子部门下用户均为 dept', () => {
    // toggleDeptCascade 勾「Technology」会把整棵子树（Engineering/AI/QA）写入 selection.depts
    const after = toggleDeptCascade('dept-tech', sel(), MOCK_DEPTS);
    expect(userGrantSource('Alice', 'dept-rd', after)).toBe('dept'); // Engineering
    expect(userGrantSource('Eric', 'dept-ai', after)).toBe('dept'); // AI
    expect(userGrantSource('Helen', 'dept-qa', after)).toBe('dept'); // QA
  });
});

describe('回归：复现「勾选部门后用户未勾选」bug', () => {
  it('勾 Technology 后，Engineering 的 Alice 应识别为继承自部门', () => {
    const after = toggleDeptCascade('dept-tech', sel(), MOCK_DEPTS);
    // 旧行为（findUserChecked）只看 selection.users，勾部门不会写 users → false，即 bug
    expect(after.users.has('Alice')).toBe(false);
    // 新派生逻辑：应识别为 dept 来源
    expect(userGrantSource('Alice', 'dept-rd', after)).toBe('dept');
  });
});

describe('回归：instanceGrantSource 部门继承（确保改动未破坏 Agent 侧）', () => {
  it('部门勾选 → 直属实例来源 dept', () => {
    expect(
      instanceGrantSource('inst-demo-003', 'dept-rd', 'Alice', sel(['dept-rd']))
    ).toBe('dept');
  });

  it('用户勾选 → 名下实例来源 user', () => {
    expect(
      instanceGrantSource('inst-demo-003', 'dept-rd', 'Alice', sel([], ['Alice']))
    ).toBe('user');
  });
});

describe('回归：resolveGrantedInstanceIds 子树展开', () => {
  it('勾 Technology → Engineering/AI/QA 部门直属（非共享）实例全部授权', () => {
    const after = toggleDeptCascade('dept-tech', sel(), MOCK_DEPTS);
    const granted = resolveGrantedInstanceIds(after, MOCK_DEPTS, MOCK_DEPT_INSTANCES);
    expect(granted.has('inst-demo-003')).toBe(true); // Engineering Alice
    expect(granted.has('inst-demo-007')).toBe(true); // AI Eric
    expect(granted.has('inst-demo-008')).toBe(true); // AI Fiona
    expect(granted.has('inst-demo-009')).toBe(true); // QA Greg
    expect(granted.has('inst-demo-010')).toBe(true); // QA Helen
    // 共享 Agent 不被部门继承命中（dept-rd 虽勾选，但共享实例 isShared=true 被排除）
    expect(granted.has('inst-shared-codereview')).toBe(false);
  });
});
