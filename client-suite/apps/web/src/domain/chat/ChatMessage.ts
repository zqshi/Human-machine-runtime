import type {
  EventId,
  RoomId,
  UserId,
  MessageContentType,
  MessageSendStatus,
} from '../shared/types';

export interface AgentCardData {
  name: string;
  role: string;
  [key: string]: unknown;
}

export interface DrawerContentData {
  type: 'doc' | 'code' | 'preview';
  content?: string;
  language?: string;
  title?: string;
  /** Runtime data bag passed to Drawer panels (html, code, etc.) */
  data?: Record<string, unknown>;
}

export interface SystemNotificationData {
  notificationType: 'approved' | 'rejected';
  documentName: string;
  documentId?: string;
  approver: string;
  reason?: string;
}

export interface ApprovalRequestData {
  applicant: string;
  documentName: string;
  documentContent?: string;
  reason: string;
}

export interface BriefingNewsItem {
  title: string;
  category: string;
  categoryColor: string;
  source: string;
  time: string;
}

export interface BriefingData {
  title: string;
  date: string;
  summary: string;
  news: BriefingNewsItem[];
}

export interface ReplyToData {
  eventId: string;
  senderId: string;
  senderName: string;
  body: string;
}

export interface ChatMessageProps {
  id: EventId;
  roomId: RoomId;
  senderId: UserId;
  senderName: string;
  body: string;
  timestamp: number;
  contentType?: MessageContentType;
  mediaUrl?: string;
  fileSize?: string;
  sendStatus?: MessageSendStatus;
  edited?: boolean;
  replyTo?: ReplyToData;
  agentCard?: AgentCardData;
  drawerContent?: DrawerContentData;
  systemNotification?: SystemNotificationData;
  approvalRequest?: ApprovalRequestData;
  briefing?: BriefingData;
}

export class ChatMessage {
  readonly id: EventId;
  readonly roomId: RoomId;
  readonly senderId: UserId;
  readonly senderName: string;
  readonly body: string;
  readonly timestamp: number;
  readonly contentType: MessageContentType;
  readonly mediaUrl?: string;
  readonly fileSize?: string;
  readonly sendStatus?: MessageSendStatus;
  readonly edited?: boolean;
  readonly replyTo?: ReplyToData;
  readonly agentCard?: AgentCardData;
  readonly drawerContent?: DrawerContentData;
  readonly systemNotification?: SystemNotificationData;
  readonly approvalRequest?: ApprovalRequestData;
  readonly briefing?: BriefingData;

  private constructor(props: ChatMessageProps) {
    this.id = props.id;
    this.roomId = props.roomId;
    this.senderId = props.senderId;
    this.senderName = props.senderName;
    this.body = props.body;
    this.timestamp = props.timestamp;
    this.contentType = props.contentType ?? 'text';
    this.mediaUrl = props.mediaUrl;
    this.fileSize = props.fileSize;
    this.sendStatus = props.sendStatus;
    this.edited = props.edited;
    this.replyTo = props.replyTo;
    this.agentCard = props.agentCard;
    this.drawerContent = props.drawerContent;
    this.systemNotification = props.systemNotification;
    this.approvalRequest = props.approvalRequest;
    this.briefing = props.briefing;
  }

  static create(props: ChatMessageProps): ChatMessage {
    return new ChatMessage(props);
  }

  get isBot(): boolean {
    const id = this.senderId.toLowerCase();
    return id.includes('hmr-bot') || id.includes('factory') || id.startsWith('@agent-');
  }

  isFromUser(userId: UserId): boolean {
    return this.senderId === userId;
  }

  get formattedTime(): string {
    const d = new Date(this.timestamp);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  get avatarLetter(): string {
    return this.senderName.charAt(0).toUpperCase();
  }
}
