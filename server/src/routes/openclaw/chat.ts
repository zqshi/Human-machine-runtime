/**
 * OpenClaw Chat Completion — 用户端对话端点
 *
 * 优先调用 LiteLLM；LiteLLM 不可用时自动返回 mock 回复。
 * mock 模式确保前端全链路可演示，不依赖任何外部服务。
 */
import { Hono } from 'hono';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { ModelGrantChecker } from '../../contexts/gateway/model-grant-checker.js';
import { newId } from '../../shared/utils.js';
import { stream } from 'hono/streaming';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_SYSTEM_PROMPT = `你是企业 AI 助手，负责回答用户的问题并协助完成工作任务。
保持专业、简洁、有用的回复风格。如果不确定答案，请明确说明。`;

/* ─── Mock 回复引擎 ─── */

interface MockReply {
  reply: string;
  model: string;
}

function generateMockReply(message: string): MockReply {
  const lower = message.toLowerCase();

  // Agent 创建意图
  if (/创建.*(agent|助手|机器人|数字员工)/i.test(lower) || /create.*agent/i.test(lower)) {
    const name =
      message.match(/(?:创建|新建|搭建)(?:一个)?[「"']?([^「"'，,。\s]{2,10})/)?.[1] || 'AI 助手';
    return {
      reply: `好的，我来帮你创建 **${name}** Agent。\n\n我已经为你准备了创建表单，你可以：\n1. 设置 Agent 名称和描述\n2. 选择预置模板快速启动\n3. 进入编排配置页面定制 System Prompt、工具和技能\n\n点击下方卡片开始创建 👇`,
      model: 'mock-dev',
    };
  }

  // Skill 创建意图
  if (/创建.*(skill|技能|能力)/i.test(lower) || /create.*skill/i.test(lower)) {
    const name =
      message.match(/(?:创建|新建)(?:一个)?[「"']?([^「"'，,。\s]{2,10})/)?.[1] || '自定义技能';
    return {
      reply: `收到，开始创建 **${name}** 技能。\n\n技能是可复用的 AI 能力模块，可以被多个 Agent 调用。你可以：\n1. 定义技能的提示词和行为规范\n2. 配置输入/输出参数\n3. 在线测试运行效果\n\n点击下方卡片进入配置 👇`,
      model: 'mock-dev',
    };
  }

  // App 创建意图
  if (/创建.*(app|应用|看板|系统)/i.test(lower) || /create.*app/i.test(lower)) {
    const name =
      message.match(/(?:创建|搭建|新建)(?:一个)?[「"']?([^「"'，,。\s]{2,10})/)?.[1] ||
      '自定义应用';
    return {
      reply: `好的，开始构建 **${name}** 应用。\n\n你可以通过自然语言描述需求，AI 将自动：\n1. 生成页面布局和交互逻辑\n2. 接入数据源和 API\n3. 提供实时预览\n\n点击下方卡片开始 👇`,
      model: 'mock-dev',
    };
  }

  // MCP 创建意图
  if (/创建.*(mcp|工具|接入)/i.test(lower) || /(?:接入|连接).*(api|数据库|gateway)/i.test(lower)) {
    let modeHint = '';
    if (/openapi|swagger|api.*文档/i.test(lower))
      modeHint = '\n\n已识别到 **OpenAPI 导入** 模式，提供 Swagger 文档链接即可自动解析。';
    else if (/数据库|database|db/i.test(lower))
      modeHint = '\n\n已识别到 **Database 直连** 模式，填写连接信息后自动探测表结构。';
    else if (/gateway|网关/i.test(lower))
      modeHint = '\n\n已识别到 **Gateway 对接** 模式，连接 Admin API 自动发现路由。';
    return {
      reply: `好的，帮你创建 MCP 工具接入。\n\nMCP (Model Context Protocol) 工具将外部 API 或数据库转化为 Agent 可调用的标准化工具。${modeHint}\n\n点击下方卡片开始配置 👇`,
      model: 'mock-dev',
    };
  }

  // 通用回复
  const replies = [
    `关于「${message.slice(0, 20)}${message.length > 20 ? '...' : ''}」的问题，我来分析一下：\n\n这是一个很好的问题。基于我的理解：\n1. 首先需要明确需求边界\n2. 其次评估可行方案\n3. 最后制定执行计划\n\n需要我进一步展开哪个方面？`,
    `收到你的消息。让我来处理：\n\n**分析：**\n${message.slice(0, 30)}${message.length > 30 ? '...' : ''}\n\n**建议：**\n- 可以尝试分步骤拆解问题\n- 结合已有工具和资源\n- 必要时创建专门的 Agent 来处理\n\n你觉得这个方向怎么样？`,
    `好的，我理解你的需求。\n\n针对「${message.slice(0, 15)}」这个场景，我有以下想法：\n\n1. **快速方案**：直接使用现有模板\n2. **定制方案**：创建专属 Agent/Skill\n3. **集成方案**：接入外部工具和数据源\n\n需要我帮你执行哪个方案？`,
  ];
  return {
    reply: replies[Math.floor(Date.now() / 1000) % replies.length],
    model: 'mock-dev',
  };
}

/* ─── 路由 ─── */

export function createOpenclawChatRoutes(
  litellmClient: LiteLLMClient | null,
  aiGatewayRepo: AiGatewayRepository | null,
  grantChecker?: ModelGrantChecker | null
) {
  const app = new Hono();

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

  /** 非流式 chat completion — LiteLLM 优先，不可用则 mock */
  app.post('/chat', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.message) return c.json({ error: 'message required' }, 400);

    // 尝试 LiteLLM
    if (litellmClient && litellmClient.isConfigured()) {
      try {
        const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        const history = Array.isArray(body.history) ? body.history : [];
        const modelName = body.model || DEFAULT_MODEL;

        // 模型授权白名单校验（enforce 模式下拦截未授权的数字员工实例）
        const authz = await isAuthorized(body.instanceId, modelName);
        if (!authz.allowed) {
          return c.json(
            { error: 'model not authorized for this agent', reason: authz.reason },
            403
          );
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
        // LiteLLM 调用失败 → 继续走 mock
      }
    }

    // Mock 回复 — 无需外部服务
    const mock = generateMockReply(body.message);
    return c.json({ reply: mock.reply, model: mock.model, mock: true });
  });

  /** 流式 chat completion (SSE) — mock 模式逐字输出 */
  app.post('/chat/stream', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.message) return c.json({ error: 'message required' }, 400);

    // 尝试 LiteLLM
    if (litellmClient && litellmClient.isConfigured()) {
      try {
        const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        const history = Array.isArray(body.history) ? body.history : [];
        const modelName = body.model || DEFAULT_MODEL;

        // 模型授权白名单校验
        const authz = await isAuthorized(body.instanceId, modelName);
        if (!authz.allowed) {
          return c.json(
            { error: 'model not authorized for this agent', reason: authz.reason },
            403
          );
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
        // LiteLLM 失败 → 继续走 mock stream
      }
    }

    // Mock stream
    const mock = generateMockReply(body.message);
    return stream(c, async (s) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      const chunkSize = 8;
      for (let i = 0; i < mock.reply.length; i += chunkSize) {
        const chunk = mock.reply.slice(i, i + chunkSize);
        await s.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }
      await s.write('data: [DONE]\n\n');
    });
  });

  return app;
}
