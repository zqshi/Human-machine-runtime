/**
 * MessageBlock — L2 层结构化内容块
 * 嵌入对话消息内的可交互卡片，Palantir AIP Action Card 模式。
 * 每个 block 在对话中渲染为独立的视觉卡片，点击可展开 Drawer 深入。
 */

export interface TaskCardBlock {
  type: 'task-card';
  taskId: string;
}

export interface SourceRefBlock {
  type: 'source-ref';
  sourceId: string;
  title: string;
  snippet?: string;
}

export interface KPIBlock {
  type: 'kpi';
  items: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'flat' }>;
}

export interface DataTableBlock {
  type: 'data-table';
  title: string;
  columns: string[];
  rows: string[][];
  truncated?: boolean;
}

export interface ActionConfirmBlock {
  type: 'action-confirm';
  actionId: string;
  title: string;
  description: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface FileRefBlock {
  type: 'file-ref';
  fileName: string;
  fileType: string;
  size?: string;
}

export interface CodeResultBlock {
  type: 'code-result';
  language: string;
  code: string;
  fileName?: string;
}

export interface CollaborationChainBlock {
  type: 'collaboration-chain';
  chainId: string;
  chainName: string;
  nodeCount: number;
  activeNodeName?: string;
}

export interface DecisionRequestBlock {
  type: 'decision-request';
  decisionId: string;
  title: string;
  urgency: 'critical' | 'high' | 'normal' | 'low';
  deadline: number;
  recommendation: string;
}

export interface GoalProgressBlock {
  type: 'goal-progress';
  goalId: string;
  title: string;
  milestoneName: string;
  progress: number;
}

export interface SuggestedActionsBlock {
  type: 'suggested-actions';
  /** 操作标题（如"建议操作"、"下一步"） */
  title: string;
  actions: Array<{
    id: string;
    icon: string;
    label: string;
    /** 填入输入框的指令文本 */
    command: string;
  }>;
}

export interface EmailDraftBlock {
  type: 'email-draft';
  from: string;
  to?: string;
  cc?: string;
  subject: string;
  date: string;
  body: string;
}

export interface AppPreviewBlock {
  type: 'app-preview';
  appId: string;
  appName: string;
  stage: string;
}

export interface DocEditorBlock {
  type: 'doc-editor';
  docId: string;
  docTitle: string;
  sectionsReady: number;
  totalSections: number;
}

export interface ProjectBoardBlock {
  type: 'project-board';
  boardId: string;
  boardName: string;
  totalCards: number;
  activeAgents: number;
}

export interface StudioIntentBlock {
  type: 'studio-intent';
  intent:
    | 'create-agent'
    | 'edit-agent'
    | 'debug-agent'
    | 'create-skill'
    | 'create-app'
    | 'create-mcp';
  agentName?: string;
  templateId?: string;
  description?: string;
  /** MCP 创建时的接入模式 */
  mcpMode?: 'openapi' | 'database' | 'gateway';
}

export interface BaseBlockMeta {
  styleHints?: Record<string, string>;
}

export type MessageBlock = (
  | TaskCardBlock
  | SourceRefBlock
  | KPIBlock
  | DataTableBlock
  | ActionConfirmBlock
  | FileRefBlock
  | CodeResultBlock
  | CollaborationChainBlock
  | DecisionRequestBlock
  | GoalProgressBlock
  | SuggestedActionsBlock
  | EmailDraftBlock
  | AppPreviewBlock
  | DocEditorBlock
  | ProjectBoardBlock
  | StudioIntentBlock
) &
  BaseBlockMeta;
