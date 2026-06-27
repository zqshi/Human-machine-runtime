export type RoomId = string;
export type UserId = string;
export type EventId = string;

export type RoomType = 'dm' | 'bot' | 'group' | 'subscription' | 'system';

export type RoomFilter = 'all' | 'starred' | (string & {});

export type DockTab =
  | 'messages'
  | 'apps'
  | 'tasks'
  | 'notifications'
  | 'knowledge'
  | 'agents'
  | 'skills'
  | 'contacts'
  | 'calendar'
  | 'subscription'
  | 'cockpit'
  | 'settings'
  | 'strategic-cockpit'
  | 'orchestration'
  | 'sensing'
  | 'evaluation'
  | 'judgment'
  | 'studio'
  | 'marketplace';

export type AppMode = 'im' | 'cockpit';

export type DrawerContentType =
  | 'doc'
  | 'code'
  | 'preview'
  | 'markdown'
  | 'spreadsheet'
  | 'location'
  | 'subscription'
  | 'sheet'
  | 'slide';

export type MessageContentType =
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'agent-card'
  | 'drawer-content'
  | 'system-notification'
  | 'approval-request'
  | 'briefing'
  | 'encrypted'
  | 'redacted';

export type MessageSendStatus = 'sending' | 'sent' | 'failed';

export type ConnectionState =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type AgentPersonality = 'professional' | 'friendly' | 'creative' | 'analytical';

export type ModelId = 'claude-sonnet-4-6' | 'claude-opus-4-6' | 'gpt-4o' | 'deepseek-r1';

export type AgentType = 'primary' | 'capability';

export type InstanceScope = 'personal' | 'organization';

export type AgentStatus = 'online' | 'busy' | 'offline';

export type AgentRuntimeStatus =
  | 'idle'
  | 'working'
  | 'monitoring'
  | 'awaiting-decision'
  | 'offline'
  | 'error';

export type ChannelType =
  | 'matrix'
  | 'wps'
  | 'websocket'
  | 'lark'
  | 'dingtalk'
  | 'wecom'
  | 'email'
  | 'webhook'
  | 'system';

export type TriageStatus = 'needs-human' | 'auto-handled' | 'pending';

export type AgentTaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export type AgentCategory =
  | 'dev'
  | 'docs'
  | 'data'
  | 'design'
  | 'test'
  | 'ops'
  | 'translate'
  | 'security';

export interface SearchUserResult {
  userId: UserId;
  displayName: string;
  avatarUrl: string | null;
}
