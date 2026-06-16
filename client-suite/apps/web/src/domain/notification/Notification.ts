import type { ChannelType, TriageStatus } from '../shared/types';

export type NotificationType = 'system' | 'mention' | 'approval' | 'update' | 'decision';

export interface NotificationSender {
  name: string;
  avatar?: string;
}

export interface ContextMessage {
  id: string;
  senderName: string;
  body: string;
  timestamp: number;
  isOwn: boolean;
}

/**
 * AgentReaction — Agent 对外部消息的自动处理结果。
 * 每条跨渠道通知都可能携带 Agent 的判断和草拟回复。
 */
export interface ReasoningStep {
  /** 步骤标签 */
  label: string;
  /** 详细说明 */
  detail: string;
}

export type Confidence = 'high' | 'medium' | 'low';

/** Agent 建议的快捷操作 */
export interface SuggestedAction {
  id: string;
  icon: string;
  label: string;
  /** 填入输入框的指令文本 */
  command: string;
}

export interface AgentReaction {
  /** Agent 的判断摘要 */
  summary: string;
  /** 草拟的回复内容（待用户确认） */
  draftReply?: string;
  /** Agent 执行的动作描述 */
  actionTaken?: string;
  /** 推理步骤（可审计的分析过程） */
  reasoningSteps?: ReasoningStep[];
  /** 判断置信度 */
  confidence?: Confidence;
  /** Agent 建议的快捷操作（动态数据驱动） */
  suggestedActions?: SuggestedAction[];
}

/** 邮件渠道的额外元数据 */
export interface EmailMeta {
  /** 收件人列表，逗号分隔 */
  to?: string;
  /** 抄送列表，逗号分隔 */
  cc?: string;
  /** 邮件 HTML 正文（可选，优先于 body） */
  htmlBody?: string;
}

export interface NotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  sender: NotificationSender;
  roomId?: string;
  channel?: ChannelType;
  agentTaskId?: string;
  contextMessages?: ContextMessage[];
  decisionId?: string;
  triageStatus?: TriageStatus;
  externalId?: string;
  agentReaction?: AgentReaction;
  /** 同一 thread 中未读的消息数 */
  unreadCount?: number;
  /** 邮件渠道的额外元数据 */
  emailMeta?: EmailMeta;
}

export class Notification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly timestamp: string;
  readonly read: boolean;
  readonly sender: NotificationSender;
  readonly roomId?: string;
  readonly channel?: ChannelType;
  readonly agentTaskId?: string;
  readonly contextMessages?: ContextMessage[];
  readonly decisionId?: string;
  readonly triageStatus?: TriageStatus;
  readonly externalId?: string;
  readonly agentReaction?: AgentReaction;
  readonly unreadCount?: number;
  readonly emailMeta?: EmailMeta;

  private constructor(props: NotificationProps) {
    this.id = props.id;
    this.type = props.type;
    this.title = props.title;
    this.body = props.body;
    this.timestamp = props.timestamp;
    this.read = props.read;
    this.sender = props.sender;
    this.roomId = props.roomId;
    this.channel = props.channel;
    this.agentTaskId = props.agentTaskId;
    this.contextMessages = props.contextMessages;
    this.decisionId = props.decisionId;
    this.triageStatus = props.triageStatus;
    this.externalId = props.externalId;
    this.agentReaction = props.agentReaction;
    this.unreadCount = props.unreadCount;
    this.emailMeta = props.emailMeta;
  }

  static create(props: NotificationProps): Notification {
    return new Notification(props);
  }

  markAsRead(): Notification {
    return new Notification({ ...this.toProps(), read: true });
  }

  get isUnread(): boolean {
    return !this.read;
  }

  get isNeedsHuman(): boolean {
    return this.triageStatus === 'needs-human' || (!this.triageStatus && !this.read);
  }

  get isAutoHandled(): boolean {
    return this.triageStatus === 'auto-handled';
  }

  withTriageStatus(status: TriageStatus): Notification {
    return new Notification({ ...this.toProps(), triageStatus: status });
  }

  withAgentReaction(reaction: AgentReaction): Notification {
    return new Notification({ ...this.toProps(), agentReaction: reaction });
  }

  private toProps(): NotificationProps {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      body: this.body,
      timestamp: this.timestamp,
      read: this.read,
      sender: this.sender,
      roomId: this.roomId,
      channel: this.channel,
      agentTaskId: this.agentTaskId,
      contextMessages: this.contextMessages,
      decisionId: this.decisionId,
      triageStatus: this.triageStatus,
      externalId: this.externalId,
      agentReaction: this.agentReaction,
      unreadCount: this.unreadCount,
      emailMeta: this.emailMeta,
    };
  }
}
