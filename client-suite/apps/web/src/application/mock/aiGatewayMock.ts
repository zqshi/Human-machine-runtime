/**
 * AI Gateway 模型管理 —— 演示用 mock 数据。
 *
 * 仅在 adminStore.aiGatewayDemoMode === true 时使用。显式演示开关，非静默降级，
 * 不污染真实数据判断（见 feedback_real-data-only 原则）。
 *
 * 内存可写：演示模式下「授权」操作会更新内存 grants map，刷新页面后回初始态。
 */

import type { GrantInstanceDTO } from '../services/adminApi';

export interface MockModel {
  id: string;
  displayName: string;
  name?: string;
  description: string;
  providerType: string;
  protocolType: string;
  baseUrl: string;
  providerModelName: string;
  modelName?: string;
  isActive: boolean;
  healthStatus: string;
  inputPrice: number;
  outputPrice: number;
  currency: string;
  maxTokens?: number;
  rateLimitPerMin?: number;
}

/** 演示模型：覆盖主流供应商 + 不同价格/状态 */
export const MOCK_MODELS: MockModel[] = [
  {
    id: '101',
    displayName: 'Claude Sonnet 4.6',
    description: '主力推理模型 · 长上下文 + 强工具调用',
    providerType: 'anthropic',
    protocolType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    providerModelName: 'claude-sonnet-4-6',
    modelName: 'claude-sonnet-4-6',
    isActive: true,
    healthStatus: 'healthy',
    inputPrice: 3.0,
    outputPrice: 15.0,
    currency: 'USD',
    maxTokens: 200000,
    rateLimitPerMin: 60,
  },
  {
    id: '102',
    displayName: 'GPT-4o',
    description: '通用多模态 · 性价比均衡',
    providerType: 'openai',
    protocolType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    providerModelName: 'gpt-4o',
    modelName: 'gpt-4o',
    isActive: true,
    healthStatus: 'healthy',
    inputPrice: 2.5,
    outputPrice: 10.0,
    currency: 'USD',
    maxTokens: 128000,
    rateLimitPerMin: 120,
  },
  {
    id: '103',
    displayName: 'DeepSeek-V3',
    description: '低成本国产模型 · 高频任务',
    providerType: 'deepseek',
    protocolType: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    providerModelName: 'deepseek-chat',
    modelName: 'deepseek-chat',
    isActive: true,
    healthStatus: 'degraded',
    inputPrice: 0.27,
    outputPrice: 1.1,
    currency: 'CNY',
    maxTokens: 64000,
    rateLimitPerMin: 200,
  },
  {
    id: '104',
    displayName: '通义千问 Max',
    description: '阿里云 · 中文场景优化',
    providerType: 'qwen',
    protocolType: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    providerModelName: 'qwen-max',
    modelName: 'qwen-max',
    isActive: false,
    healthStatus: 'unhealthy',
    inputPrice: 0.04,
    outputPrice: 0.12,
    currency: 'CNY',
    maxTokens: 32000,
    rateLimitPerMin: 80,
  },
  {
    id: '105',
    displayName: 'Gemini 2.0 Flash',
    description: 'Google · 超低延迟轻量任务',
    providerType: 'google',
    protocolType: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    providerModelName: 'gemini-2.0-flash',
    modelName: 'gemini-2.0-flash',
    isActive: true,
    healthStatus: 'healthy',
    inputPrice: 0.075,
    outputPrice: 0.3,
    currency: 'USD',
    maxTokens: 1000000,
    rateLimitPerMin: 300,
  },
];

/** 演示数字员工：覆盖「一人多 Agent」「共享客服 bot」「跨部门」三种形态 */
export const MOCK_INSTANCES: GrantInstanceDTO[] = [
  { id: 'inst-demo-001', name: 'Alice · Customer Support', tenantId: 'tnt-demo', departmentId: 'dept-cs', department: 'Support', ownerName: 'Alice', state: 'running' },
  { id: 'inst-demo-002', name: 'Alice · Data Analyst', tenantId: 'tnt-demo', departmentId: 'dept-bi', department: 'Analytics', ownerName: 'Alice', state: 'running' },
  { id: 'inst-demo-003', name: 'Alice · Coding Assistant', tenantId: 'tnt-demo', departmentId: 'dept-rd', department: 'Engineering', ownerName: 'Alice', state: 'stopped' },
  { id: 'inst-demo-004', name: 'Bob · Finance', tenantId: 'tnt-demo', departmentId: 'dept-fin', department: 'Finance', ownerName: 'Bob', state: 'running' },
  { id: 'inst-demo-005', name: 'Carol · Marketing', tenantId: 'tnt-demo', departmentId: 'dept-mkt', department: 'Marketing', ownerName: 'Carol', state: 'running' },
  { id: 'inst-shared-support', name: 'Shared Support Bot', tenantId: 'tnt-demo', departmentId: 'dept-cs', department: 'Support', ownerName: 'Shared (All)', state: 'running' },
  { id: 'inst-shared-codereview', name: 'Shared Code Review Bot', tenantId: 'tnt-demo', departmentId: 'dept-rd', department: 'Engineering', ownerName: 'Shared (Engineering)', state: 'running' },
  { id: 'inst-demo-006', name: 'David · Legal', tenantId: 'tnt-demo', departmentId: 'dept-legal', department: 'Legal', ownerName: 'David', state: 'running' },
];

/** 内存 grants：modelId → instanceId[]。演示授权操作会改写这里。 */
let mockGrants: Record<string, string[]> = {
  '101': ['inst-demo-001', 'inst-demo-003', 'inst-shared-support'],
  '102': ['inst-demo-002', 'inst-demo-004'],
  '103': ['inst-demo-002', 'inst-demo-005', 'inst-shared-support', 'inst-shared-codereview'],
  '105': ['inst-demo-001'],
};

/** 重置为初始演示数据（测试/调试用） */
export function resetMockGrants(): void {
  mockGrants = {
    '101': ['inst-demo-001', 'inst-demo-003', 'inst-shared-support'],
    '102': ['inst-demo-002', 'inst-demo-004'],
    '103': ['inst-demo-002', 'inst-demo-005', 'inst-shared-support', 'inst-shared-codereview'],
    '105': ['inst-demo-001'],
  };
}

export function mockListGrantsByModel(modelId: string): string[] {
  return mockGrants[modelId] ? [...mockGrants[modelId]] : [];
}

export function mockCountGrantsByModel(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(mockGrants)) out[k] = v.length;
  return out;
}

export function mockSetModelGrants(modelId: string, instanceIds: string[]): string[] {
  mockGrants[modelId] = [...instanceIds];
  return mockListGrantsByModel(modelId);
}

// ─── 部门级授权原型（声明式）：多层级部门树 + 规则级授权 ───────────────
// 后端 departments 表目前扁平（无 parent_id），这里用 mock 验证
// 「组织树 + 部门继承授权」交互。待后端 P0（部门 parent_id）/ P1（model_grants 表）就绪后，
// 下面的 resolve/source 等纯函数可直接迁入 domain 层并接真实数据。

export interface MockDept {
  id: string;
  name: string;
  parentId: string | null;
}

/** 多层级部门树（3 层：总部 → 中心 → 部门） */
export const MOCK_DEPTS: MockDept[] = [
  { id: 'dept-root', name: 'Headquarters', parentId: null },
  { id: 'dept-tech', name: 'Technology', parentId: 'dept-root' },
  { id: 'dept-rd', name: 'Engineering', parentId: 'dept-tech' },
  { id: 'dept-ai', name: 'AI', parentId: 'dept-tech' },
  { id: 'dept-qa', name: 'QA', parentId: 'dept-tech' },
  { id: 'dept-biz', name: 'Business', parentId: 'dept-root' },
  { id: 'dept-cs', name: 'Support', parentId: 'dept-biz' },
  { id: 'dept-bi', name: 'Analytics', parentId: 'dept-biz' },
  { id: 'dept-mkt', name: 'Marketing', parentId: 'dept-biz' },
  { id: 'dept-fn', name: 'Operations', parentId: 'dept-root' },
  { id: 'dept-fin', name: 'Finance', parentId: 'dept-fn' },
  { id: 'dept-legal', name: 'Legal', parentId: 'dept-fn' },
  { id: 'dept-shared', name: 'Shared Services', parentId: 'dept-root' },
];

/** 新增 instance 挂在 AI/QA 部门，体现规模（不改动原有 8 个 MOCK_INSTANCES） */
const EXTRA_INSTANCES: GrantInstanceDTO[] = [
  { id: 'inst-demo-007', name: 'Eric · Model Training', tenantId: 'tnt-demo', departmentId: 'dept-ai', department: 'AI', ownerName: 'Eric', state: 'running' },
  { id: 'inst-demo-008', name: 'Fiona · Data Labeling', tenantId: 'tnt-demo', departmentId: 'dept-ai', department: 'AI', ownerName: 'Fiona', state: 'running' },
  { id: 'inst-demo-009', name: 'Greg · QA Automation', tenantId: 'tnt-demo', departmentId: 'dept-qa', department: 'QA', ownerName: 'Greg', state: 'stopped' },
  { id: 'inst-demo-010', name: 'Helen · QA Review', tenantId: 'tnt-demo', departmentId: 'dept-qa', department: 'QA', ownerName: 'Helen', state: 'running' },
];

/** 树形授权原型用的全量 instance（原 8 + 新增 4，分布在 3 层部门树） */
export const MOCK_DEPT_INSTANCES: GrantInstanceDTO[] = [...MOCK_INSTANCES, ...EXTRA_INSTANCES];

/**
 * 级联勾选模型（取代声明式 includeChildren）：
 * - depts：勾选的部门 id。勾父级→整棵子树勾选；取消父级→整棵子树清除；子级全勾→父级自动全选，部分→父级半选。
 * - users：勾选的负责人（名下 Agent 继承授权）。
 * - instances：单独勾选的实例（组织共享 Agent 只能走这里，不归属部门、不被继承）。
 */
export interface DeptGrantSelection {
  depts: Set<string>;
  users: Set<string>;
  instances: Set<string>;
}

function emptySelection(): DeptGrantSelection {
  return { depts: new Set(), users: new Set(), instances: new Set() };
}

function initialDeptSelection(): Record<string, DeptGrantSelection> {
  const s = emptySelection();
  s.depts.add('dept-tech'); // Technology 含下属 → 级联勾选整棵子树
  s.users.add('Bob');
  s.instances.add('inst-shared-support');
  return { '101': s };
}

let mockDeptSelections: Record<string, DeptGrantSelection> = initialDeptSelection();

export function resetMockDeptSelection(): void {
  mockDeptSelections = initialDeptSelection();
}

export function mockListDeptSelection(modelId: string): DeptGrantSelection {
  const s = mockDeptSelections[modelId] ?? emptySelection();
  return { depts: new Set(s.depts), users: new Set(s.users), instances: new Set(s.instances) };
}

export function mockSetDeptSelection(modelId: string, sel: DeptGrantSelection): void {
  mockDeptSelections[modelId] = {
    depts: new Set(sel.depts),
    users: new Set(sel.users),
    instances: new Set(sel.instances),
  };
}

/** 部门子树（含自身）的所有部门 id */
export function deptSubtreeIds(depts: MockDept[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const d of depts) {
    if (d.parentId) {
      const arr = childrenOf.get(d.parentId) ?? [];
      arr.push(d.id);
      childrenOf.set(d.parentId, arr);
    }
  }
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const k of childrenOf.get(cur) ?? []) {
      if (!out.has(k)) {
        out.add(k);
        stack.push(k);
      }
    }
  }
  return out;
}

/**
 * 部门级联三态：基于 selection.depts 在该部门子树（含自身）中的覆盖情况。
 * - all：自身及所有子孙均已勾选
 * - none：自身及所有子孙均未勾选
 * - some：部分勾选（用于 indeterminate 半选展示）
 */
export function deptCascadeState(
  deptId: string,
  selection: DeptGrantSelection,
  depts: MockDept[]
): 'all' | 'some' | 'none' {
  const sub = deptSubtreeIds(depts, deptId);
  let inCnt = 0;
  for (const d of sub) if (selection.depts.has(d)) inCnt++;
  if (inCnt === sub.size) return 'all';
  if (inCnt === 0) return 'none';
  return 'some';
}

/** 切换部门勾选（向下级联）：all→清空子树，some/none→勾选整个子树。返回新 selection。 */
export function toggleDeptCascade(
  deptId: string,
  selection: DeptGrantSelection,
  depts: MockDept[]
): DeptGrantSelection {
  const sub = deptSubtreeIds(depts, deptId);
  const next: DeptGrantSelection = {
    depts: new Set(selection.depts),
    users: new Set(selection.users),
    instances: new Set(selection.instances),
  };
  if (deptCascadeState(deptId, selection, depts) === 'all') {
    for (const d of sub) next.depts.delete(d);
  } else {
    for (const d of sub) next.depts.add(d);
  }
  return next;
}

/**
 * 级联授权展开：解析 selection 得到最终被授权的 instanceId 集合。
 * 命中条件（任一）：其部门被勾选（直属，非共享）/ 其 ownerName 被用户级勾选 / 自身被实例级勾选。
 * —— 后端 model-grant-checker 将来要做的核心判定逻辑。
 */
export function resolveGrantedInstanceIds(
  selection: DeptGrantSelection,
  depts: MockDept[],
  instances: GrantInstanceDTO[]
): Set<string> {
  const granted = new Set<string>();
  // 部门勾选 → 直属非共享成员
  for (const inst of instances) {
    if (!isSharedInstance(inst.ownerName) && inst.departmentId && selection.depts.has(inst.departmentId)) {
      granted.add(inst.id);
    }
  }
  // 用户勾选 → 名下 Agent
  for (const inst of instances) {
    if (inst.ownerName && selection.users.has(inst.ownerName)) granted.add(inst.id);
  }
  // 实例勾选 → 单独
  for (const id of selection.instances) granted.add(id);
  return granted;
}

/**
 * 某用户（在某部门下渲染时）的授权来源：部门(dept) / 用户(user) / 未授权(none)。
 * 与 instanceGrantSource 对称——用户节点同样是派生状态，须反映部门级继承：
 *   用户继承自部门 ⟺ 其所属部门 deptId ∈ selection.depts
 *   （toggleDeptCascade 勾父级时整棵子树含 deptId 已写入 selection.depts）。
 * 优先级 dept > user，与 Agent 实例来源判定一致（部门已覆盖即归因到部门规则）。
 */
export function userGrantSource(
  userName: string,
  deptId: string,
  selection: DeptGrantSelection
): 'dept' | 'user' | 'none' {
  if (selection.depts.has(deptId)) return 'dept';
  if (selection.users.has(userName)) return 'user';
  return 'none';
}

/** 某 instance 的授权来源：部门(dept) / 用户(user) / 单独(direct) / 未授权(none) */
export function instanceGrantSource(
  instId: string,
  instDeptId: string | null,
  instOwnerName: string | null,
  selection: DeptGrantSelection
): 'dept' | 'user' | 'direct' | 'none' {
  if (instDeptId && selection.depts.has(instDeptId)) return 'dept';
  if (instOwnerName && selection.users.has(instOwnerName)) return 'user';
  if (selection.instances.has(instId)) return 'direct';
  return 'none';
}

export interface AuthSourceLabel {
  kind: 'dept' | 'user';
  name: string;
}

/** 找到使某 instance 被授权的来源（部门或用户），用于灰禁项的来源标签展示。 */
export function instanceAuthLabel(
  instDeptId: string | null,
  instOwnerName: string | null,
  selection: DeptGrantSelection,
  depts: MockDept[]
): AuthSourceLabel | null {
  if (instDeptId && selection.depts.has(instDeptId)) {
    const name = depts.find((d) => d.id === instDeptId)?.name ?? instDeptId;
    return { kind: 'dept', name };
  }
  if (instOwnerName && selection.users.has(instOwnerName)) {
    return { kind: 'user', name: instOwnerName };
  }
  return null;
}

/**
 * 是否为组织级共享 Agent。mock 用 ownerName 含「Shared」识别；
 * 真实环境应改用 instance.source === 'organization'（Instance 接口已有 source 字段）。
 * 共享 Agent 不归属任何部门/用户，只能通过 instance 级单独授权，不被部门继承命中。
 */
export function isSharedInstance(ownerName: string | null): boolean {
  return !!ownerName && ownerName.includes('Shared');
}

/** 按 ownerName 分组 instance，排除组织共享 Agent（非真实用户） */
export function groupInstancesByUser(instances: GrantInstanceDTO[]): Array<[string, GrantInstanceDTO[]]> {
  const map = new Map<string, GrantInstanceDTO[]>();
  for (const i of instances) {
    if (!i.ownerName || isSharedInstance(i.ownerName)) continue;
    const arr = map.get(i.ownerName) ?? [];
    arr.push(i);
    map.set(i.ownerName, arr);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh'));
}

/** 各模型按级联勾选展开后的授权人数（demo 模式徽章用） */
export function mockCountDeptGrantsByModel(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mid of Object.keys(mockDeptSelections)) {
    out[mid] = resolveGrantedInstanceIds(mockDeptSelections[mid], MOCK_DEPTS, MOCK_DEPT_INSTANCES).size;
  }
  return out;
}
