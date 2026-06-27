import { request } from './cockpitApiAdapter';

export interface EmergentSignalDTO {
  id: string;
  patternId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  correlatedSignalIds: string[];
  pattern: string;
  suggestedAction: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: number;
}

export interface DetectedPatternDTO {
  id: string;
  name: string;
  description: string;
  frequency: number;
  lastSeenAt: number;
  severity: 'low' | 'medium' | 'high';
}

export interface KnowledgePatternDTO {
  id: string;
  contextKey: string;
  keywords: string[];
  urgency: string;
  source: string;
  recommendedAction: string;
  successRate: number;
  sampleSize: number;
  usageCount: number;
  createdAt: number;
}

export interface ScorecardDTO {
  id: string;
  type: 'agent' | 'human';
  subjectId: string;
  subjectName: string;
  periodStart: number;
  periodEnd: number;
  score: number;
  adjustment: 'promote' | 'maintain' | 'demote';
  metrics: Record<string, number>;
}

export async function fetchEmergentSignals(): Promise<EmergentSignalDTO[]> {
  const res = await request<{ items: EmergentSignalDTO[] }>('/api/cockpit/signals/emergent');
  return res.items;
}

export async function createEmergentSignal(
  signal: Omit<EmergentSignalDTO, 'id' | 'createdAt'>
): Promise<EmergentSignalDTO> {
  return request('/api/cockpit/signals/emergent', {
    method: 'POST',
    body: JSON.stringify(signal),
  });
}

export async function updateEmergentSignal(
  id: string,
  patch: Partial<Pick<EmergentSignalDTO, 'status'>>
): Promise<EmergentSignalDTO> {
  return request(`/api/cockpit/signals/emergent/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchDetectedPatterns(): Promise<DetectedPatternDTO[]> {
  const res = await request<{ items: DetectedPatternDTO[] }>('/api/cockpit/patterns');
  return res.items;
}

export async function createDetectedPattern(
  pattern: Omit<DetectedPatternDTO, 'id'>
): Promise<DetectedPatternDTO> {
  return request('/api/cockpit/patterns', {
    method: 'POST',
    body: JSON.stringify(pattern),
  });
}

export async function fetchKnowledgePatterns(filter?: {
  keyword?: string;
}): Promise<KnowledgePatternDTO[]> {
  const qs = filter?.keyword ? `?keyword=${encodeURIComponent(filter.keyword)}` : '';
  const res = await request<{ items: KnowledgePatternDTO[] }>(
    `/api/cockpit/knowledge/patterns${qs}`
  );
  return res.items;
}

export async function createKnowledgePattern(
  pattern: Omit<KnowledgePatternDTO, 'id' | 'createdAt' | 'usageCount'>
): Promise<KnowledgePatternDTO> {
  return request('/api/cockpit/knowledge/patterns', {
    method: 'POST',
    body: JSON.stringify(pattern),
  });
}

export async function fetchScorecards(filter?: {
  type?: 'agent' | 'human';
}): Promise<ScorecardDTO[]> {
  const qs = filter?.type ? `?type=${encodeURIComponent(filter.type)}` : '';
  const res = await request<{ items: ScorecardDTO[] }>(`/api/cockpit/evaluation/scorecards${qs}`);
  return res.items;
}

export async function createScorecard(scorecard: Omit<ScorecardDTO, 'id'>): Promise<ScorecardDTO> {
  return request('/api/cockpit/evaluation/scorecards', {
    method: 'POST',
    body: JSON.stringify(scorecard),
  });
}
