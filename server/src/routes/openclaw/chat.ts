/**
 * OpenClaw Chat Completion — 用户端对话端点
 *
 * 薄路由层:参数校验 → 调 ChatService(对话能力核心) → 按 ChatResult.status 返回。
 * 对话逻辑(persona/guardrail/history/授权/per-instance key/LiteLLM/trace)下沉 ChatService,
 * 与 RuntimeProxyService(Matrix bot 对话)共用同一对话能力(DRY)。
 *
 * 行为与重构前一致(T24 persona/T49 history/T15 guardrail):LiteLLM 未配置/失败返 503/502,
 * 不 mock 兜底(故障暴露)。
 */
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { ModelGrantChecker } from '../../contexts/gateway/model-grant-checker.js';
import type { IPersonaProvider } from '../../contexts/agent-core/domain/persona-provider.js';
import { ChatService } from '../../contexts/agent-core/application/chat-service.js';

/* ─── 路由 ─── */

export function createOpenclawChatRoutes(
  litellmClient: LiteLLMClient | null,
  aiGatewayRepo: AiGatewayRepository | null,
  grantChecker?: ModelGrantChecker | null,
  personaProvider?: IPersonaProvider | null
) {
  const app = new Hono();
  const chatService = new ChatService(litellmClient, personaProvider, aiGatewayRepo, grantChecker);

  /** 非流式 chat completion — LiteLLM 真实调用,未配置/失败返 503/502 */
  app.post('/chat', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.message) return c.json({ error: 'message required' }, 400);

    const result = await chatService.chat(body.instanceId, body.message, {
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      userId: body.userId,
      sessionId: body.sessionId,
      systemPrompt: body.systemPrompt,
      history: body.history,
      traceSource: 'openclaw-chat',
    });

    if (result.blocked) {
      return c.json({ reply: result.reply, model: 'guardrail', blocked: true });
    }
    if (result.status === 503) return c.json({ error: result.reason }, 503);
    if (result.status === 403) {
      return c.json({ error: 'model not authorized for this agent', reason: result.reason }, 403);
    }
    if (result.status === 502) {
      return c.json({ error: '对话服务调用失败，请稍后重试' }, 502);
    }
    return c.json({ reply: result.reply, model: result.model, usage: result.usage });
  });

  /** 流式 chat completion (SSE) — LiteLLM 真实调用,未配置/失败返 503/502 */
  app.post('/chat/stream', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.message) return c.json({ error: 'message required' }, 400);

    const result = await chatService.chat(body.instanceId, body.message, {
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      userId: body.userId,
      sessionId: body.sessionId,
      systemPrompt: body.systemPrompt,
      history: body.history,
      traceSource: 'openclaw-chat-stream',
    });

    // guardrail 命中 → 流式返拒答话术
    if (result.blocked) {
      return stream(c, async (s) => {
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        await s.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: result.reply } }] })}\n\n`
        );
        await s.write('data: [DONE]\n\n');
      });
    }
    if (result.status === 503) return c.json({ error: result.reason }, 503);
    if (result.status === 403) {
      return c.json({ error: 'model not authorized for this agent', reason: result.reason }, 403);
    }
    if (result.status === 502) {
      return c.json({ error: '对话服务调用失败，请稍后重试' }, 502);
    }

    const reply = result.reply ?? '';
    return stream(c, async (s) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      const chunkSize = 20;
      for (let i = 0; i < reply.length; i += chunkSize) {
        const chunk = reply.slice(i, i + chunkSize);
        await s.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }
      await s.write('data: [DONE]\n\n');
    });
  });

  return app;
}
