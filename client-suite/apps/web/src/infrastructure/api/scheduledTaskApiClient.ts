/**
 * Scheduled Tasks API Client — 定时任务管理
 *
 * Covers all /api/admin/scheduled-tasks/* routes.
 */

import { request } from './adminApiClient';

/* ──── Types ──── */

export interface ScheduledTask {
  id: string;
  name: string;
  description: string | null;
  jobType: 'agent' | 'system';
  jobPayload: Record<string, unknown>;
  scheduleType: 'cron' | 'interval';
  cronExpr: string | null;
  intervalSeconds: number | null;
  timezone: string;
  isEnabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTaskRun {
  id: string;
  taskId: string;
  status: string;
  triggerType: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  conclusion: string | null;
  outputPayload: unknown;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface CronValidation {
  valid: boolean;
  error?: string;
  description: string;
  next5: string[];
}

export interface ScheduledTaskInput {
  name: string;
  description?: string;
  jobType: 'agent' | 'system';
  jobPayload: Record<string, unknown>;
  scheduleType: 'cron' | 'interval';
  cronExpr?: string;
  intervalSeconds?: number;
  timezone?: string;
  isEnabled?: boolean;
}

/* ──── API ──── */

export const scheduledTaskApi = {
  list(params?: { isEnabled?: boolean; jobType?: string }): Promise<{ tasks: ScheduledTask[] }> {
    const qs = new URLSearchParams();
    if (params?.isEnabled !== undefined) qs.set('isEnabled', String(params.isEnabled));
    if (params?.jobType) qs.set('jobType', params.jobType);
    const q = qs.toString();
    return request(`/api/admin/scheduled-tasks${q ? `?${q}` : ''}`);
  },

  get(id: string): Promise<ScheduledTask> {
    return request(`/api/admin/scheduled-tasks/${encodeURIComponent(id)}`);
  },

  create(data: ScheduledTaskInput): Promise<ScheduledTask> {
    return request('/api/admin/scheduled-tasks', { method: 'POST', body: JSON.stringify(data) });
  },

  update(id: string, data: Partial<ScheduledTaskInput>): Promise<ScheduledTask> {
    return request(`/api/admin/scheduled-tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/scheduled-tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  toggle(id: string, enabled: boolean): Promise<ScheduledTask> {
    return request(`/api/admin/scheduled-tasks/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  run(id: string): Promise<ScheduledTaskRun> {
    return request(`/api/admin/scheduled-tasks/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    });
  },

  listRuns(
    id: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ runs: ScheduledTaskRun[] }> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request(`/api/admin/scheduled-tasks/${encodeURIComponent(id)}/runs${q ? `?${q}` : ''}`);
  },

  getRun(taskId: string, runId: string): Promise<ScheduledTaskRun> {
    return request(
      `/api/admin/scheduled-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}`
    );
  },

  validateCron(expr: string, tz?: string): Promise<CronValidation> {
    return request('/api/admin/scheduled-tasks/validate-cron', {
      method: 'POST',
      body: JSON.stringify({ expr, ...(tz ? { tz } : {}) }),
    });
  },
};
