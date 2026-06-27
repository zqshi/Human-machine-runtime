/**
 * CockpitDrawerContent — Drawer 内容类型定义
 * 统一 Drawer 系统，替代原 TaskDetailDrawer 硬编码方案。
 */

export type CockpitDrawerType =
  | 'task-detail'
  | 'activity-detail'
  | 'source-detail'
  | 'data-explorer'
  | 'code-viewer'
  | 'execution-log'
  | 'collaboration-chain'
  | 'notification-detail'
  | 'decision-detail'
  | 'goal-tracker'
  | 'cot-detail'
  | 'inbox-thread'
  | 'app-preview'
  | 'doc-editor'
  | 'project-board'
  | 'agent-studio';

export interface CockpitDrawerContent {
  type: CockpitDrawerType;
  title: string;
  data: Record<string, unknown>;
}

/**
 * AttentionItem — 左栏关注事项
 * 从对话消息 blocks + 外部通知中派生，不是独立数据源。
 */
export type AttentionItemKind =
  | 'goal'
  | 'decision'
  | 'task'
  | 'action-confirm'
  | 'notification'
  | 'workorder';

export interface AttentionItem {
  id: string;
  kind: AttentionItemKind;
  title: string;
  summary?: string;
  /** 关联的消息 ID，用于中栏滚动定位 */
  messageId: string;
  /** 关联的决策 ID，用于 drawer 打开 */
  decisionId?: string;
  /** 关联的通知 ID（外部通知） */
  notificationId?: string;
  /** 关联的任务 ID */
  taskId?: string;
  /** 关联的工单 ID */
  workOrderId?: string;
  /** 是否已处理 */
  resolved: boolean;
  /** 排序权重：越低越靠前 */
  priority: number;
  /** 渠道标识（外部通知） */
  channel?: string;
  /** 倒计时（决策用） */
  deadline?: number;
  /** 任务进度 0-100 */
  taskProgress?: number;
  /** 任务主题色 */
  taskColor?: string;
  /** 当前子任务名 */
  currentSubtask?: string;
  /** 最新推理摘要 */
  reasoningSummary?: string;
  /** 任务状态标签 */
  taskStatusLabel?: string;
  /** 关联目标 ID */
  goalId?: string;
  /** 目标进度 0-100 */
  goalProgress?: number;
  /** 目标优先级 */
  goalPriority?: string;
  /** 是否需要人工介入 */
  isNeedsHuman?: boolean;
  /** 时间戳 */
  timestamp?: number;
}
