/**
 * ChatService — 对话能力核心(从 routes/openclaw/chat.ts 抽取,DRY 共用)。
 *
 * 封装 persona 解析 + guardrail 拦截 + 授权校验 + per-instance key + LiteLLM 调用 +
 * trace 落库,供 openclaw chat route(HTTP 对话)与 RuntimeProxyService(Matrix bot 对话)共用。
 *
 * 设计:返回带 status 的 ChatResult,让调用方(route/handler)只做 HTTP/协议适配,
 * 业务逻辑下沉 service。行为与原 chat.ts /chat 端点一致(T24 persona/T49 history/T15 guardrail)。
 *
 * 容错不抛:guardrail 查询失败/无 personaProvider → 降级 body/默认;LiteLLM 调用失败 → 502。
 */
import type { LiteLLMClient } from '../../gateway/clients/litellm-client.js';
import type { AiGatewayRepository } from '../../../db/repositories/ai-gateway-repository.js';
import type { ModelGrantChecker } from '../../gateway/model-grant-checker.js';
import type { IPersonaProvider } from '../domain/persona-provider.js';
import { checkGuardrails } from '../domain/guardrail-checker.js';
import { newId } from '../../../shared/utils.js';

export const DEFAULT_CHAT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_SYSTEM_PROMPT = `你是企业 AI 助手，负责回答用户的问题并协助完成工作任务。
保持专业、简洁、有用的回复风格。如果不确定答案，请明确说明。`;

/** 多轮对话历史项(role 限定 user/assistant) */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  sessionId?: string;
  /** 调用方显式传入的 systemPrompt(persona.systemPrompt 优先,降级至此) */
  systemPrompt?: string;
  /** 多轮历史(Matrix bot 由 store 维护;HTTP chat 由前端传入) */
  history?: ChatHistoryMessage[];
  /** trace 来源标记(openclaw-chat / matrix-bot) */
  traceSource?: string;
}

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface ChatResult {
  ok: boolean;
  /** HTTP 等效状态码:200 成功(含 guardrail 拦截)/403 未授权/503 未配置/502 调用失败 */
  status: 200 | 403 | 503 | 502;
  reply?: string;
  model?: string;
  usage?: ChatUsage;
  /** guardrail 命中标记 */
  blocked?: boolean;
  /** 失败原因(403/503/502) */
  reason?: string;
}

/** guardrail 命中默认拒答话术 */
const DEFAULT_REFUSAL = '抱歉,该请求不在我的服务范围内。';

export class ChatService {
  constructor(
    private readonly litellmClient: LiteLLMClient | null,
    private readonly personaProvider: IPersonaProvider | null | undefined,
    private readonly aiGatewayRepo: AiGatewayRepository | null,
    private readonly grantChecker?: ModelGrantChecker | null
  ) {}

  /** LiteLLM 是否就绪 */
  isConfigured(): boolean {
    return !!this.litellmClient?.isConfigured();
  }

  /** guardrail 检查(命中→blocked+refusal;无 persona/失败→放行) */
  async checkGuardrail(
    instanceId: string | null | undefined,
    message: string
  ): Promise<{ blocked: boolean; refusal: string }> {
    if (!this.personaProvider || !instanceId) return { blocked: false, refusal: '' };
    try {
      const persona = await this.personaProvider.getPersona(instanceId);
      if (!persona.hasPersona || !persona.guardrails?.length) {
        return { blocked: false, refusal: '' };
      }
      const result = checkGuardrails(message, persona.guardrails);
      if (result.blocked) {
        return { blocked: true, refusal: persona.refusalResponse || DEFAULT_REFUSAL };
      }
      return { blocked: false, refusal: '' };
    } catch {
      return { blocked: false, refusal: '' };
    }
  }

  /** 解析 systemPrompt:persona.systemPrompt 优先 > body > 默认(容错不抛) */
  async resolveSystemPrompt(
    instanceId: string | null | undefined,
    bodySystemPrompt?: string
  ): Promise<string> {
    if (this.personaProvider && instanceId) {
      try {
        const persona = await this.personaProvider.getPersona(instanceId);
        if (persona.hasPersona && persona.systemPrompt) {
          return persona.systemPrompt;
        }
      } catch {
        /* 降级到 body/默认 */
      }
    }
    return bodySystemPrompt || DEFAULT_SYSTEM_PROMPT;
  }

  /** 清洗历史:只放行 role∈{user,assistant}+非空 string content;截断最近 20 轮(40 条) */
  sanitizeHistory(raw: unknown): ChatHistoryMessage[] {
    if (!Array.isArray(raw)) return [];
    const cleaned: ChatHistoryMessage[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = (item as { role?: unknown }).role;
      const c = (item as { content?: unknown }).content;
      if (r !== 'user' && r !== 'assistant') continue;
      if (typeof c !== 'string' || c.trim().length === 0) continue;
      cleaned.push({ role: r, content: c });
    }
    return cleaned.slice(-40);
  }

  /** 授权校验:enforce 模式下未授权返 deny;off/log/无校验器→放行 */
  async isAuthorized(
    instanceId: string | null | undefined,
    modelName: string
  ): Promise<{ allowed: boolean; reason: string }> {
    if (!this.grantChecker) return { allowed: true, reason: 'no checker' };
    const d = await this.grantChecker.check(instanceId, modelName);
    return { allowed: d.decision !== 'deny', reason: d.reason };
  }

  /** per-instance virtual key(无则降级 master key) */
  async resolveInstanceApiKey(instanceId: string | null | undefined): Promise<string | undefined> {
    if (!instanceId || !this.aiGatewayRepo) return undefined;
    try {
      const row = await this.aiGatewayRepo.getInstanceKey(instanceId);
      if (row && row.syncStatus === 'synced' && row.litellmKey) return row.litellmKey;
    } catch {
      /* 降级到默认 key */
    }
    return undefined;
  }

  /**
   * 核心对话:guardrail → 配置检查 → persona/history/授权/key → LiteLLM → trace 落库。
   * 不抛错,所有失败转 ChatResult{ok:false,status}。调用方按 status 决定 HTTP/协议响应。
   */
  async chat(
    instanceId: string | null | undefined,
    message: string,
    opts: ChatOptions = {}
  ): Promise<ChatResult> {
    // 1. guardrail 兜底(#1)
    const guard = await this.checkGuardrail(instanceId, message);
    if (guard.blocked) {
      return { ok: true, status: 200, reply: guard.refusal, model: 'guardrail', blocked: true };
    }

    // 2. LiteLLM 未配置 → 503(不 mock 兜底,故障暴露)
    if (!this.isConfigured()) {
      return { ok: false, status: 503, reason: 'LiteLLM 未配置,对话服务不可用' };
    }

    try {
      const systemPrompt = await this.resolveSystemPrompt(instanceId, opts.systemPrompt);
      const history = this.sanitizeHistory(opts.history);
      const modelName = opts.model || DEFAULT_CHAT_MODEL;

      // 3. 模型授权白名单
      const authz = await this.isAuthorized(instanceId, modelName);
      if (!authz.allowed) {
        return { ok: false, status: 403, reason: authz.reason };
      }

      // 4. per-instance virtual key
      const apiKey = await this.resolveInstanceApiKey(instanceId);

      const result = await this.litellmClient!.chatCompletion({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message },
        ],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        user: opts.userId || 'openclaw-user',
        metadata: { source: opts.traceSource || 'openclaw-chat' },
        ...(apiKey ? { apiKey } : {}),
      });

      const completion = result as {
        id?: string;
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const reply = completion?.choices?.[0]?.message?.content ?? '抱歉，未能获取到回复。';

      // 5. trace 落库(非阻塞)
      if (this.aiGatewayRepo) {
        const traceId = completion?.id || newId('trc');
        this.aiGatewayRepo
          .insertTrace({
            traceId,
            sessionId: opts.sessionId || 'openclaw-fallback',
            requestId: traceId,
            userId: opts.userId || 'openclaw-user',
            requestedModel: modelName,
            actualModel: completion?.model ?? undefined,
            providerType: 'litellm',
            status: 'success',
            promptTokens: completion?.usage?.prompt_tokens ?? 0,
            completionTokens: completion?.usage?.completion_tokens ?? 0,
            latencyMs: 0,
          })
          .catch(() => {
            /* non-blocking */
          });
      }

      return {
        ok: true,
        status: 200,
        reply,
        model: completion?.model,
        usage: completion?.usage,
      };
    } catch {
      // LiteLLM 调用失败 → 502(不 mock 兜底,故障暴露)
      return { ok: false, status: 502, reason: '对话服务调用失败' };
    }
  }
}
