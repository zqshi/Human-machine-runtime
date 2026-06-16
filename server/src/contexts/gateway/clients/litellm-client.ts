import { BaseGatewayClient } from './base-client.js';

export interface SpendLogEntry {
  request_id: string;
  call_type: string;
  model: string;
  spend: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  startTime: string;
  endTime: string;
  api_key: string;
  user: string;
  metadata: Record<string, unknown>;
  cache_hit: string;
  cache_key: string;
  request_tags: string[];
  custom_llm_provider?: string;
  [key: string]: unknown;
}

export class LiteLLMClient extends BaseGatewayClient {
  async listModels() {
    return this.request('/v1/models');
  }

  async chatCompletion(params: {
    model: string;
    messages: { role: string; content: string }[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    user?: string;
    metadata?: Record<string, unknown>;
    /** 覆盖默认 Authorization，用于 per-instance virtual key 调用 */
    apiKey?: string;
  }) {
    return this.request('/v1/chat/completions', {
      method: 'POST',
      body: params,
      timeout: 60000,
      ...(params.apiKey ? { headers: { Authorization: `Bearer ${params.apiKey}` } } : {}),
    });
  }

  /* ──── Virtual Key 管理（per-instance / per-team 模型隔离） ──── */

  /**
   * 生成一把绑定 allowed_models 的 virtual key。
   * LiteLLM proxy 标准端点 /key/generate，需 master key 权限。
   */
  async generateKey(params: {
    teamId?: string;
    userId?: string;
    /** 该 key 允许调用的模型别名列表（来自 grants） */
    models: string[];
    /** 人类可读标识 */
    keyAlias?: string;
    metadata?: Record<string, unknown>;
    /** 过期时间（ISO），可选 */
    expires?: string;
  }): Promise<{ key: string; key_id?: string; expires?: string | null }> {
    const body: Record<string, unknown> = {
      models: params.models,
      ...(params.teamId ? { team_id: params.teamId } : {}),
      ...(params.userId ? { user_id: params.userId } : {}),
      ...(params.keyAlias ? { key_alias: params.keyAlias } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
      ...(params.expires ? { expires: params.expires } : {}),
    };
    return this.request('/key/generate', { method: 'POST', body });
  }

  /** 删除（吊销）一把 key。 */
  async deleteKey(keys: string[]): Promise<{ deleted_keys: string[] }> {
    return this.request('/key/delete', { method: 'POST', body: { keys } });
  }

  /** 查询某 key 的信息（含 allowed models）。 */
  async getKeyInfo(key: string): Promise<Record<string, unknown>> {
    return this.request(`/key/info?key=${encodeURIComponent(key)}`);
  }

  async getModelInfo(modelId: string) {
    return this.request(`/model/info?model=${encodeURIComponent(modelId)}`);
  }

  async getSpend(params: { startDate?: string; endDate?: string; apiKey?: string } = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.set('start_date', params.startDate);
    if (params.endDate) query.set('end_date', params.endDate);
    if (params.apiKey) query.set('api_key', params.apiKey);
    const qs = query.toString();
    return this.request(`/spend/logs${qs ? `?${qs}` : ''}`);
  }

  async healthCheck() {
    return this.request('/health');
  }

  async getSpendLogs(params: {
    startDate: string;
    endDate: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: SpendLogEntry[]; total: number }> {
    const query = new URLSearchParams();
    query.set('start_date', params.startDate);
    query.set('end_date', params.endDate);
    query.set('page', String(params.page ?? 1));
    query.set('page_size', String(params.pageSize ?? 100));
    const result = await this.request<{ data: SpendLogEntry[]; total: number }>(
      `/spend/logs/v2?${query.toString()}`,
      { timeout: 30_000, skipRetry: true }
    );
    return {
      data: Array.isArray(result?.data) ? result.data : [],
      total: result?.total ?? 0,
    };
  }
}
