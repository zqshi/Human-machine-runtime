/**
 * OpenClaw Chat Completion — 用户端对话端点
 *
 * 调用 LiteLLM 真实模型;LiteLLM 未配置或调用失败时返回明确错误(503/502),
 * 不再 mock 兜底(真实投产:故障暴露而非假数据掩盖)。
 */
import { Hono } from 'hono';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { ModelGrantChecker } from '../../contexts/gateway/model-grant-checker.js';
import { checkGuardrails } from '../../contexts/agent-core/domain/guardrail-checker.js';
import type { IPersonaProvider } from '../../contexts/agent-core/domain/persona-provider.js';
import { newId } from '../../shared/utils.js';
import { stream } from 'hono/streaming';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_SYSTEM_PROMPT = `你是企业 AI 助手，负责回答用户的问题并协助完成工作任务。
保持专业、简洁、有用的回复风格。如果不确定答案，请明确说明。`;

/* ─── 路由 ─── */

export function createOpenclawChatRoutes(
  litellmClient: LiteLLMClient | null,
  aiGatewayRepo: AiGatewayRepository | null,
  grantChecker?: ModelGrantChecker | null,
  personaProvider?: IPersonaProvider | null
) {
  const app = new Hono();

  /**
   * 后端 guardrail 兜底(T15,#1):openclaw chat 经 LiteLLM 不经 harness,
   * 复用 v1.9 T3 PersonaProvider 取 instance guardrails + checkGuardrails。
   * 命中 block → 返回拒答话术;容错不抛(任何失败放行,不阻断主链路)。
   * 无 personaProvider/instanceId/guardrails → 放行。
   */
  async function checkGuardrail(
    instanceId: string | null | undefined,
    message: string
  ): Promise<{ blocked: boolean; refusal: string }> {
    if (!personaProvider || !instanceId) return { blocked: false, refusal: '' };
    try {
      const persona = await personaProvider.getPersona(instanceId);
      if (!persona.hasPersona || !persona.guardrails?.length) {
        return { blocked: false, refusal: '' };
      }
      const result = checkGuardrails(message, persona.guardrails);
      if (result.blocked) {
        return {
          blocked: true,
          refusal: persona.refusalResponse || '抱歉,该请求不在我的服务范围内。',
        };
      }
      return { blocked: false, refusal: '' };
    } catch {
      return { blocked: false, refusal: '' };
    }
  }

  /**
   * 授权校验：enforce 模式下未授权返回 false（调用方应 403）。
   * off/log 模式或缺校验器时放行。
   */
  async function isAuthorized(
    instanceId: string | null | undefined,
    modelName: string
  ): Promise<{ allowed: boolean; reason: string }> {
    if (!grantChecker) return { allowed: true, reason: 'no checker' };
    const d = await grantChecker.check(instanceId, modelName);
    return { allowed: d.decision !== 'deny', reason: d.reason };
  }

  /**
   * 取该 instance 的 LiteLLM virtual key（per-instance 模型隔离）。
   * 无 key（未同步/统一助手）返回 undefined，降级用默认 master key。
   */
  async function resolveInstanceApiKey(
    instanceId: string | null | undefined
  ): Promise<string | undefined> {
    if (!instanceId || !aiGatewayRepo) return undefined;
    try {
      const row = await aiGatewayRepo.getInstanceKey(instanceId);
      if (row && row.syncStatus === 'synced' && row.litellmKey) return row.litellmKey;
    } catch {
      /* 降级到默认 key */
    }
    return undefined;
  }

  /** 非流式 chat completion — LiteLLM 真实调用,未配置/失败返 503/502 */
  app.post('/chat', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.message) return c.json({ error: 'message required' }, 400);

    // T15 后端 guardrail 兜底(覆盖 LiteLLM + mock 两条路径,#1)
    const guard = await checkGuardrail(body.instanceId, body.message);
    if (guard.blocked) return c.json({ reply: guard.refusal, model: 'guardrail', blocked: true });

    // LiteLLM 未配置 → 503(真实投产:不 mock 兜底,故障暴露)
    if (!litellmClient || !litellmClient.isConfigured()) {
      return c.json({ error: 'LiteLLM 未配置,对话服务不可用' }, 503);
    }

    try {
      const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      const history = Array.isArray(body.history) ? body.history : [];
      const modelName = body.model || DEFAULT_MODEL;

      // 模型授权白名单校验（enforce 模式下拦截未授权的数字员工实例）
      const authz = await isAuthorized(body.instanceId, modelName);
      if (!authz.allowed) {
        return c.json({ error: 'model not authorized for this agent', reason: authz.reason }, 403);
      }

      // per-instance virtual key（LiteLLM 层模型隔离）；无则降级 master key
      const apiKey = await resolveInstanceApiKey(body.instanceId);

      const result = await litellmClient.chatCompletion({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: body.message },
        ],
        temperature: body.temperature ?? 0.7,
        max_tokens: body.maxTokens ?? 1024,
        user: body.userId || 'openclaw-user',
        metadata: { source: 'openclaw-chat' },
        ...(apiKey ? { apiKey } : {}),
      });

      const completion = result as {
        id?: string;
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const reply = completion?.choices?.[0]?.message?.content ?? '抱歉，未能获取到回复。';

      if (aiGatewayRepo) {
        const traceId = completion?.id || newId('trc');
        aiGatewayRepo
          .insertTrace({
            traceId,
            sessionId: body.sessionId || 'openclaw-fallback',
            requestId: traceId,
            userId: body.userId || 'openclaw-user',
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

      return c.json({ reply, model: completion?.model, usage: completion?.usage });
    } catch {
      // LiteLLM 调用失败 → 502(真实投产:不 mock 兜底,故障暴露)
      return c.json({ error: '对话服务调用失败,请稍后重试' }, 502);
    }
  });

  /** 流式 chat completion (SSE) — LiteLLM 真实调用,未配置/失败返 503/502 */
  app.post('/chat/stream', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.message) return c.json({ error: 'message required' }, 400);

    // T15 后端 guardrail 兜底
    const guard = await checkGuardrail(body.instanceId, body.message);
    if (guard.blocked) {
      return stream(c, async (s) => {
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        await s.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: guard.refusal } }] })}\n\n`
        );
        await s.write('data: [DONE]\n\n');
      });
    }

    // LiteLLM 未配置 → 503(真实投产:不 mock 兜底)
    if (!litellmClient || !litellmClient.isConfigured()) {
      return c.json({ error: 'LiteLLM 未配置,对话服务不可用' }, 503);
    }

    try {
      const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      const history = Array.isArray(body.history) ? body.history : [];
      const modelName = body.model || DEFAULT_MODEL;

      // 模型授权白名单校验
      const authz = await isAuthorized(body.instanceId, modelName);
      if (!authz.allowed) {
        return c.json({ error: 'model not authorized for this agent', reason: authz.reason }, 403);
      }

      // per-instance virtual key（LiteLLM 层模型隔离）；无则降级 master key
      const apiKey = await resolveInstanceApiKey(body.instanceId);

      const result = await litellmClient.chatCompletion({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: body.message },
        ],
        temperature: body.temperature ?? 0.7,
        max_tokens: body.maxTokens ?? 1024,
        user: body.userId || 'openclaw-user',
        metadata: { source: 'openclaw-chat-stream' },
        ...(apiKey ? { apiKey } : {}),
      });

      const completion = result as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = completion?.choices?.[0]?.message?.content ?? '';

      return stream(c, async (s) => {
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        const chunkSize = 20;
        for (let i = 0; i < reply.length; i += chunkSize) {
          const chunk = reply.slice(i, i + chunkSize);
          await s.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`
          );
        }
        await s.write('data: [DONE]\n\n');
      });
    } catch {
      // LiteLLM 失败 → 502(真实投产:不 mock stream 兜底,故障暴露)
      return c.json({ error: '对话服务调用失败,请稍后重试' }, 502);
    }
  });

  return app;
}
