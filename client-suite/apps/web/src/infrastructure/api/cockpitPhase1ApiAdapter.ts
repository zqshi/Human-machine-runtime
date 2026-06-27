import { request } from './cockpitApiAdapter';

export interface SignalDTO {
  id: string;
  source: string;
  urgency: string;
  deadline?: number;
  impactScope: number;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface JudgmentAnalyticsDTO {
  totalJudgments: number;
  accuracyRate: number;
  avgResponseMs: number;
  sourceDistribution: Record<string, number>;
  timeSeriesData: Array<{ timestamp: number; count: number; accuracyRate: number }>;
}

export async function fetchSignals(filter?: { urgency?: string }): Promise<SignalDTO[]> {
  const qs = filter?.urgency ? `?urgency=${encodeURIComponent(filter.urgency)}` : '';
  const res = await request<{ items: SignalDTO[] }>(`/api/cockpit/signals${qs}`);
  return res.items;
}

export async function applyCorrection(
  planId: string,
  actions: Array<{ targetId: string; action: string }>
): Promise<{ applied: number; failed: number }> {
  return request('/api/cockpit/corrections/apply', {
    method: 'POST',
    body: JSON.stringify({ planId, actions }),
  });
}

export async function fetchJudgmentAnalytics(): Promise<JudgmentAnalyticsDTO> {
  return request('/api/cockpit/judgment-analytics');
}
