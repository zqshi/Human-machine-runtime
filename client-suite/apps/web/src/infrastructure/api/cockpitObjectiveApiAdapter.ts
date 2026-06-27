import { request } from './cockpitApiAdapter';

export interface ObjectiveDTO {
  id: string;
  level: 'L0' | 'L1' | 'L2';
  title: string;
  description: string;
  parentId?: string;
  confidence: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  metrics: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface DecodedStrategyDTO {
  questions: Array<{ id: string; question: string; purpose: string }>;
  hypotheses: Array<{ id: string; statement: string; baselineValue: number; targetValue: number }>;
  constraints: string[];
  suggestedL1Objectives: Array<{ title: string; keyQuestion: string }>;
}

export async function fetchObjectives(filter?: { level?: string }): Promise<ObjectiveDTO[]> {
  const qs = filter?.level ? `?level=${encodeURIComponent(filter.level)}` : '';
  const res = await request<{ items: ObjectiveDTO[] }>(`/api/cockpit/objectives${qs}`);
  return res.items;
}

export async function createObjective(
  objective: Omit<ObjectiveDTO, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ObjectiveDTO> {
  return request('/api/cockpit/objectives', {
    method: 'POST',
    body: JSON.stringify(objective),
  });
}

export async function getObjective(id: string): Promise<ObjectiveDTO> {
  return request(`/api/cockpit/objectives/${encodeURIComponent(id)}`);
}

export async function updateObjective(
  id: string,
  patch: Partial<Pick<ObjectiveDTO, 'title' | 'description' | 'status' | 'confidence' | 'metrics'>>
): Promise<ObjectiveDTO> {
  return request(`/api/cockpit/objectives/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteObjective(id: string): Promise<void> {
  await request(`/api/cockpit/objectives/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function decodeStrategy(intent: string): Promise<DecodedStrategyDTO> {
  return request('/api/cockpit/objectives/decode', {
    method: 'POST',
    body: JSON.stringify({ intent }),
  });
}
