/**
 * studioApi — Studio 聚合 API 服务
 *
 * 调用后端 /api/cockpit/studio/* 端点，聚合用户 AI 资产数据。
 */
import type { AssetItem } from '../../presentation/features/studio/AssetCard';
import { handleSessionExpired } from '../../infrastructure/api/sessionHandler';

const BASE = '/api/cockpit/studio';

/** Cockpit chat 端点(非流式),与 studio 前缀不同,单独定义 */
const CHAT_ENDPOINT = '/api/cockpit/chat';

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

/** 预览对话返回结构 — 与后端 ChatService.chat 返回对齐(附加前端测得的耗时) */
export interface PreviewChatResult {
  reply: string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  blocked?: boolean;
  /** 前端测得的近似耗时(ms),后端不返 latency,仅用于预览调试展示 */
  elapsedMs: number;
}

/** 预览对话调用错误 — 携带状态码以便 UI 区分 503/502/403 */
export class PreviewChatError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PreviewChatError';
  }
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

  /**
   * 预览对话 — 调用真实 Cockpit chat 端点(LiteLLM 真实调用)。
   *
   * Studio 编排预览场景无 instanceId(配置未发布),后端 ChatService 在 instanceId
   * 为空时跳过 persona/guardrail,改用 body.systemPrompt 作为 system prompt,真调 LiteLLM。
   * LiteLLM 未配置/失败时后端返 503/502(不 mock 兜底,故障暴露)。
   *
   * @param message     用户消息
   * @param systemPrompt 当前编排的系统提示词(作为软约束注入)
   * @param history     历史消息(可选,role/content)
   */
  async previewChat(
    message: string,
    systemPrompt: string,
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<PreviewChatResult> {
    const startedAt = performance.now();
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        systemPrompt,
        history: history ?? [],
        traceSource: 'studio-preview',
      }),
    });
    const elapsedMs = Math.round(performance.now() - startedAt);

    if (res.status === 401) {
      handleSessionExpired();
      throw new PreviewChatError('Session expired', 401);
    }
    const body = (await res.json().catch(() => ({}))) as {
      reply?: string;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      blocked?: boolean;
      error?: string;
    };

    if (!res.ok) {
      // 503: LiteLLM 未配置;502: 调用失败;403: 模型未授权
      throw new PreviewChatError(body.error ?? `对话服务异常 (${res.status})`, res.status);
    }

    return {
      reply: body.reply ?? '',
      model: body.model,
      usage: body.usage,
      blocked: body.blocked,
      elapsedMs,
    };
  },
};
