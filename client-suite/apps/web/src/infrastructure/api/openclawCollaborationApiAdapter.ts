import { request } from './openclawApiAdapter';

export interface IntentDTO {
  type: string;
  description: string;
  requiredParams: string[];
  agentId?: string;
}

export interface CollaborationSessionDTO {
  id: string;
  purpose: string;
  participants: Array<{ id: string; type: 'human' | 'agent'; name: string }>;
  status: 'active' | 'completed' | 'escalated';
  createdAt: number;
  updatedAt: number;
}

export interface AgentProfileDTO {
  agentId: string;
  agentName: string;
  domains: string[];
  successRate: number;
  avgDurationMs: number;
  avgTokenCost: number;
  totalCompleted: number;
  totalFailed: number;
}

export interface ContractDTO {
  id: string;
  taskId: string;
  objective: string;
  inputs: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  escalationConditions: string[];
  estimatedCost: number;
  status: 'active' | 'completed' | 'failed';
}

export async function fetchIntents(): Promise<IntentDTO[]> {
  const res = await request<{ items: IntentDTO[] }>('/api/openclaw/intents');
  return res.items;
}

export async function createIntent(
  intent: Omit<IntentDTO, 'agentId'> & { agentId: string }
): Promise<IntentDTO> {
  return request('/api/openclaw/intents', {
    method: 'POST',
    body: JSON.stringify(intent),
  });
}

export async function dispatchIntent(
  intentType: string,
  payload: Record<string, unknown>,
  fromAgentId: string
): Promise<{ dispatched: boolean; targetAgentId?: string }> {
  return request('/api/openclaw/intents/dispatch', {
    method: 'POST',
    body: JSON.stringify({ intentType, payload, fromAgentId }),
  });
}

export async function fetchSessions(): Promise<CollaborationSessionDTO[]> {
  const res = await request<{ items: CollaborationSessionDTO[] }>('/api/openclaw/sessions');
  return res.items;
}

export async function createSession(session: {
  purpose: string;
  participantIds: string[];
}): Promise<CollaborationSessionDTO> {
  return request('/api/openclaw/sessions', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}

export async function getSession(id: string): Promise<CollaborationSessionDTO> {
  return request(`/api/openclaw/sessions/${encodeURIComponent(id)}`);
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<CollaborationSessionDTO, 'status'>>
): Promise<CollaborationSessionDTO> {
  return request(`/api/openclaw/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchAgentProfiles(): Promise<AgentProfileDTO[]> {
  const res = await request<{ items: AgentProfileDTO[] }>('/api/openclaw/agent-profiles');
  return res.items;
}

export async function getAgentProfile(id: string): Promise<AgentProfileDTO> {
  return request(`/api/openclaw/agent-profiles/${encodeURIComponent(id)}`);
}

export async function updateAgentProfile(
  id: string,
  patch: Partial<AgentProfileDTO>
): Promise<AgentProfileDTO> {
  return request(`/api/openclaw/agent-profiles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function recordAgentPerformance(
  id: string,
  data: { domain: string; success: boolean; durationMs: number; tokenCost: number }
): Promise<void> {
  await request(`/api/openclaw/agent-profiles/${encodeURIComponent(id)}/record`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function escalateTask(
  taskId: string,
  reason: string
): Promise<{ stage: string; action: string }> {
  return request(`/api/openclaw/tasks/${encodeURIComponent(taskId)}/escalate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function resolveEscalation(
  taskId: string,
  resolution: string
): Promise<{ resolved: boolean }> {
  return request(`/api/openclaw/tasks/${encodeURIComponent(taskId)}/escalate/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution }),
  });
}

export async function createContract(
  contract: Omit<ContractDTO, 'id' | 'status'>
): Promise<ContractDTO> {
  return request('/api/openclaw/contracts', {
    method: 'POST',
    body: JSON.stringify(contract),
  });
}

export async function getContract(id: string): Promise<ContractDTO> {
  return request(`/api/openclaw/contracts/${encodeURIComponent(id)}`);
}
