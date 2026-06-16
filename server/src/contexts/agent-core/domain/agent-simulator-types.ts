export type BroadcastFn = (event: string, data: unknown) => void;

export type Urgency = 'critical' | 'high' | 'normal' | 'low';
export type RiskLevel = 'low' | 'medium' | 'high';
export type DecisionResponseStatus = 'pending' | 'expired' | 'approved' | 'rejected';

export type TaskStatus = 'running' | 'completed' | 'queued';
export type GoalStatus = 'active' | 'completed';
export type MilestoneStatus = 'completed' | 'active' | 'pending';

export interface IMapStore<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[string, V]>;
}

export interface AgentSimulatorStores {
  decisions: IMapStore<Decision>;
  tasks: IMapStore<SimTask>;
  goals: IMapStore<Goal>;
  judgments: IMapStore<unknown>;
  workOrders?: IMapStore<unknown>;
}

export interface SimTask {
  id: string;
  agentId: string;
  name: string;
  status: TaskStatus;
  progress: number;
  subtasks: unknown[];
  logs: unknown[];
  createdAt: number;
  updatedAt: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  reasoning: string;
  estimatedImpact: string;
  riskLevel: RiskLevel;
}

export interface Decision {
  id: string;
  agentId: string;
  title: string;
  context: string;
  recommendation: DecisionOption;
  alternatives: DecisionOption[];
  urgency: Urgency;
  deadline: number;
  responseStatus: DecisionResponseStatus;
  userResponse: unknown;
  responseAt: number | null;
  createdAt: number;
  updatedAt: number;
  impactScope: number;
  downstreamTaskIds: string[];
  downstreamGoalIds: string[];
}

export interface Milestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  completedAt?: number;
  relatedTaskIds: string[];
}

export interface GoalConstraint {
  id: string;
  type: 'timeline' | 'budget' | 'compliance' | 'quality';
  description: string;
  threshold?: string;
  hardLimit: boolean;
}

export interface GoalAuthorization {
  autoExecute: string[];
  requireOwner: string[];
  requireCollaborator: Array<{ action: string; collaboratorRole: string }>;
}

export interface SuccessCriterion {
  id: string;
  metric: string;
  target: string;
  measureMethod: string;
  currentValue: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  intent: string;
  priority: string;
  status: GoalStatus;
  deadline: number;
  milestones: Milestone[];
  constraints: GoalConstraint[];
  authorization: GoalAuthorization;
  successCriteria: SuccessCriterion[];
  ownerId: string;
  collaboratorIds: string[];
  parentGoalId: string | null;
  decompositionStrategy: string;
  relatedTaskIds: string[];
  relatedDecisionIds: string[];
  progressUpdates: unknown[];
  createdAt: number;
  updatedAt: number;
}

export interface DecisionTemplate {
  titleFn: () => string;
  contextFn: () => string;
  agentId: string;
  urgency: Urgency;
  rec: { label: string; riskLevel: RiskLevel };
  alt: { label: string; riskLevel: RiskLevel };
}

export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    titleFn: () => `API 延迟异常，P99 升至 ${rand(200, 800)}ms`,
    contextFn: () =>
      `过去 ${rand(10, 30)} 分钟内，核心 API P99 延迟飙升，错误率从 0.01% 升至 ${(Math.random() * 0.5 + 0.1).toFixed(2)}%。DB 连接池使用率 ${rand(80, 98)}%。`,
    agentId: 'ops-assistant',
    urgency: 'critical',
    rec: { label: '临时扩容', riskLevel: 'low' },
    alt: { label: '仅调整连接池', riskLevel: 'medium' },
  },
  {
    titleFn: () => `发现高危依赖漏洞 CVE-${new Date().getFullYear()}-${rand(10000, 99999)}`,
    contextFn: () =>
      `依赖扫描发现高危漏洞（CVSS ${(Math.random() * 2 + 8).toFixed(1)}），影响 ${rand(1, 5)} 个服务。补丁版本已可用。`,
    agentId: 'security-agent',
    urgency: 'high',
    rec: { label: '立即升级', riskLevel: 'low' },
    alt: { label: '低峰期升级', riskLevel: 'medium' },
  },
  {
    titleFn: () => `服务器 CPU 持续 ${rand(85, 99)}%，建议扩容`,
    contextFn: () =>
      `${pick(['auth-service', 'order-service', 'gateway'])} 节点 CPU 使用率超过阈值已持续 ${rand(5, 30)} 分钟，自动伸缩策略尚未触发。`,
    agentId: 'ops-assistant',
    urgency: 'high',
    rec: { label: '水平扩容 +2 节点', riskLevel: 'low' },
    alt: { label: '垂直扩容升级规格', riskLevel: 'medium' },
  },
  {
    titleFn: () => `新版本 v${rand(2, 5)}.${rand(0, 9)}.${rand(0, 20)} 发布审批`,
    contextFn: () =>
      `CI 构建 #${rand(100, 999)} 已完成，包含 ${rand(3, 15)} 个功能和 ${rand(1, 8)} 个 bug 修复。所有测试通过。`,
    agentId: 'dev-assistant',
    urgency: 'normal',
    rec: { label: '批准发布', riskLevel: 'low' },
    alt: { label: '延迟到低峰期', riskLevel: 'low' },
  },
  {
    titleFn: () => `数据库慢查询 ${rand(3, 12)} 条，建议优化`,
    contextFn: () =>
      `检测到 ${pick(['orders', 'users', 'inventory', 'analytics'])} 表存在 ${rand(3, 12)} 条慢查询（>500ms），缺少复合索引导致全表扫描。`,
    agentId: 'data-analyst',
    urgency: 'normal',
    rec: { label: '创建优化索引', riskLevel: 'low' },
    alt: { label: '先在测试环境验证', riskLevel: 'low' },
  },
  {
    titleFn: () => `SSL 证书将在 ${rand(3, 14)} 天后过期`,
    contextFn: () =>
      `${pick(['*.example.com', 'api.example.com', 'admin.example.com'])} 的 SSL 证书即将过期，需要续期以避免服务中断。`,
    agentId: 'ops-assistant',
    urgency: 'low',
    rec: { label: '自动续期', riskLevel: 'low' },
    alt: { label: '手动更换证书', riskLevel: 'medium' },
  },
  {
    titleFn: () => `存储空间使用率达 ${rand(80, 95)}%`,
    contextFn: () =>
      `${pick(['日志', '数据库备份', '对象存储'])}占用持续增长，预计 ${rand(3, 10)} 天内达到上限。`,
    agentId: 'ops-assistant',
    urgency: 'normal',
    rec: { label: '清理过期数据 + 扩容', riskLevel: 'low' },
    alt: { label: '仅清理，暂不扩容', riskLevel: 'medium' },
  },
  {
    titleFn: () => `异常登录行为检测`,
    contextFn: () =>
      `过去 1 小时内检测到 ${rand(50, 500)} 次异常登录尝试，来源 IP 集中在 ${pick(['海外', '未知代理', '异常地区'])}。`,
    agentId: 'security-agent',
    urgency: 'high',
    rec: { label: '启用 IP 封禁 + 告警', riskLevel: 'low' },
    alt: { label: '仅告警观察', riskLevel: 'high' },
  },
];

export const URGENCY_DEADLINE_MINUTES: Record<Urgency, number> = {
  critical: 10,
  high: 20,
  normal: 60,
  low: 120,
};
