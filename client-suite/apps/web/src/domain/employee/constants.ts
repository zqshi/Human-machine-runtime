/**
 * 数字员工领域常量与映射。
 *
 * 这些映射表是"业务状态 → 语义标签 / 视觉语义"的字典：
 * 哪个状态属于危险、哪个状态属于正常、部门代号对应的中文名，
 * 都是业务判断，故下沉至 domain 层。badge 类名只是该语义的
 * Tailwind 载体，随语义一同迁移；UI 行为/外观保持不变。
 */

/** 实例范围（个人/组织）→ badge 样式 */
export const SCOPE_BADGE: Record<string, string> = {
  personal: 'bg-purple-50 text-purple-700',
  organization: 'bg-blue-50 text-blue-700',
};

/** 实例范围 → 中文标签 */
export const SCOPE_LABEL: Record<string, string> = {
  personal: '个人',
  organization: '组织',
};

/** 员工状态 → badge 样式（按语义分组：正常/暂停/进行中/停用/异常） */
export const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  running: 'bg-green-50 text-green-700',
  paused: 'bg-yellow-50 text-yellow-700',
  provisioning: 'bg-blue-50 text-blue-700',
  pending: 'bg-yellow-50 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
  error: 'bg-red-50 text-red-700',
  failed: 'bg-red-50 text-red-700',
};

/** 部门代号（含别名归一）→ 中文名 */
export const DEPT_LABELS: Record<string, string> = {
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

/** 岗位代号 → 中文名 */
export const ROLE_LABELS: Record<string, string> = {
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

/** 节点健康状态 → 文字色 */
export const NODE_STATUS_BADGE: Record<string, string> = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600',
  unhealthy: 'text-red-600',
};

/** 节点健康状态 → 图标名 */
export const NODE_STATUS_ICON: Record<string, string> = {
  healthy: 'check_circle',
  warning: 'warning',
  unhealthy: 'error',
};

/** 实例操作 → 中文标签 */
export const ACTION_LABELS: Record<string, string> = {
  start: '启动',
  stop: '停止',
  rebuild: '容器重启',
  delete: '删除',
};

/** 视图模式 → 表格列定义 */
export const VIEW_MODE_COLUMNS: Record<
  string,
  readonly { key: string; label: string; width: string }[]
> = {
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

/**
 * 将部门代号格式化为中文展示名；未知值原样返回。
 * 业务规则：先归一化（小写+trim），再查映射表。
 */
export function formatDept(value?: string): string {
  if (!value) return '-';
  return DEPT_LABELS[value.toLowerCase().trim()] || value;
}

/**
 * 将岗位代号格式化为中文展示名；未知值原样返回。
 */
export function formatRole(value?: string): string {
  if (!value) return '-';
  return ROLE_LABELS[value.toLowerCase().trim()] || value;
}
