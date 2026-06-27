/**
 * studioApi — Studio 聚合 API 服务
 *
 * 调用后端 /api/cockpit/studio/* 端点，聚合用户 AI 资产数据。
 */
import type { AssetItem } from '../../presentation/features/studio/AssetCard';
import { handleSessionExpired } from '../../infrastructure/api/sessionHandler';

const BASE = '/api/cockpit/studio';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 401) {
    handleSessionExpired();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Studio API ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const studioApi = {
  /** 获取用户全部资产（自建 + 已安装 + 组织共享） */
  async listAssets(): Promise<AssetItem[]> {
    const data = await request<{ items: AssetItem[] }>('/assets');
    return data.items;
  },

  /** 从共享中心安装资产 */
  async installAsset(assetId: string, source: string): Promise<void> {
    await request('/assets/install', {
      method: 'POST',
      body: JSON.stringify({ assetId, source }),
    });
  },

  /** 卸载已安装的资产 */
  async uninstallAsset(assetId: string): Promise<void> {
    await request(`/assets/${assetId}`, { method: 'DELETE' });
  },

  /** 获取 Agent 编排配置 */
  async getAgentConfig(agentId: string) {
    return request<{
      systemPrompt: string;
      modelId: string;
      openingMessage: string;
      presetQuestions: string[];
      shortcuts: string[];
      humanize: boolean;
      webSearch: boolean;
      mcpRefs: { id: string; name: string; toolCount: number }[];
      skillRefs: { id: string; name: string; description: string }[];
      knowledgeBaseIds: string[];
      publishedVersion: string | null;
    }>(`/agents/${agentId}/config`);
  },

  /** 保存 Agent 编排配置（草稿） */
  async saveAgentConfig(agentId: string, config: Record<string, unknown>): Promise<void> {
    await request(`/agents/${agentId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  /** 发布 Agent 配置 */
  async publishAgent(agentId: string, version: string): Promise<void> {
    await request(`/agents/${agentId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  },
};
