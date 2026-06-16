export type ChannelType =
  | 'matrix'
  | 'wps'
  | 'websocket'
  | 'lark'
  | 'dingtalk'
  | 'wecom'
  | 'email'
  | 'webhook';

export interface ChannelTarget {
  channelType: ChannelType;
  roomId: string;
  userId?: string;
}

export interface ChannelMessage {
  type: 'text' | 'rich_text' | 'card' | 'file';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelConversation {
  id: string;
  channelType: ChannelType;
  name: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
}

export interface ChannelStatus {
  channelType: ChannelType;
  connected: boolean;
  error?: string;
}

export interface IChannelAdapter {
  readonly channelType: ChannelType;
  readonly supportsInbound: boolean;
  sendMessage(target: ChannelTarget, message: ChannelMessage): Promise<void>;
  getStatus(): Promise<ChannelStatus>;
  listConversations(userId: string): Promise<ChannelConversation[]>;
  onInboundMessage?(handler: (msg: InboundMessage) => void): () => void;
}

export interface InboundMessage {
  id: string;
  channelType: ChannelType;
  sender: { id: string; name?: string; channel: string };
  roomId: string;
  content: string;
  contentType: 'text' | 'rich_text' | 'card' | 'file';
  rawPayload?: unknown;
  receivedAt: Date;
}
