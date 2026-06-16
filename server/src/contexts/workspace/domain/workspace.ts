import { newId, nowIso } from '../../../shared/utils.js';

export type WorkspaceType = 'APP' | 'SKILL' | 'NORMAL' | 'AGENT';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  ownerId: string;
  tenantId: string;
  description: string;
  status: 'active' | 'archived';
  xspaceWorkspaceId?: string;
  sourceChannel?: string;
  sourceConversationId?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface WorkspaceApp {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: 'draft' | 'building' | 'ready' | 'deployed' | 'failed';
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceConversation {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export function createWorkspace(params: {
  name: string;
  type: WorkspaceType;
  ownerId: string;
  tenantId: string;
  description?: string;
  sourceChannel?: string;
  sourceConversationId?: string;
}): Workspace {
  const now = nowIso();
  return {
    id: newId('ws'),
    name: params.name,
    type: params.type,
    ownerId: params.ownerId,
    tenantId: params.tenantId,
    description: params.description || '',
    status: 'active',
    sourceChannel: params.sourceChannel,
    sourceConversationId: params.sourceConversationId,
    createdAt: now,
    updatedAt: now,
    metadata: {},
  };
}

export function archiveWorkspace(ws: Workspace): Workspace {
  return { ...ws, status: 'archived', updatedAt: nowIso() };
}
