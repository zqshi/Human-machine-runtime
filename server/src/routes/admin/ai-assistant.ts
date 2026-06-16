import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { AnalyticsService } from '../../contexts/analytics/analytics-service.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { SkillService } from '../../contexts/shared-assets/skill-service.js';
import type { AuditService } from '../../contexts/audit-observability/audit-service.js';
import type { ClawManagerClient } from '../../contexts/gateway/clients/claw-manager-client.js';
import { parseBody, badRequest } from '../../shared/validation.js';
import { newId } from '../../shared/utils.js';
import { logger } from '../../app/logger.js';
import type { Principal } from '../../middleware/auth.js';

function getCallerUser(c: Context): Principal | undefined {
  return c.get('user') as Principal | undefined;
}

const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1),
});

function buildSystemPrompt(user: Principal | undefined): string {
  const roleLine = user
    ? `当前操作者: ${user.username}, 角色: ${user.role || 'admin'}, 租户: ${user.tenantId || '平台级'}`
    : '当前操作者: 未知';

  return `你是管理后台的 AI 助手。你可以帮助管理员：
- 查看和分析平台运行数据（实例状态、Token消耗、告警信息等）
- 解答数字员工管理、技能配置、AI Gateway 相关问题
- 提供运维建议和最佳实践
- 解读监控指标和异常告警

${roleLine}

请基于 [平台实时数据] 中的信息回答问题。如果数据中没有相关信息，说明暂无该数据。
用简洁专业的中文回答，必要时给出具体操作建议。不要编造数据。`;
}

interface AssistantDeps {
  litellmClient: LiteLLMClient | undefined;
  analyticsService: AnalyticsService;
  clawManagerClient: ClawManagerClient | undefined;
  aiGatewayRepo: AiGatewayRepository | undefined;
  skillService: SkillService | undefined;
  auditService: AuditService | undefined;
}

async function resolveModel(
  aiGatewayRepo: AiGatewayRepository | undefined,
  litellmClient: LiteLLMClient
): Promise<string> {
  if (aiGatewayRepo) {
    try {
      const models = await aiGatewayRepo.listModels();
      const active = models.find((m) => m.isActive);
      if (active?.displayName) return active.displayName;
    } catch {
      /* fallback */
    }
  }

  try {
    const res = (await litellmClient.listModels()) as { data?: { id: string }[] };
    if (res?.data?.length) return res.data[0].id;
  } catch {
    /* fallback */
  }

  return 'gpt-4o-mini';
}

async function buildContextSummary(deps: AssistantDeps): Promise<string> {
  const sections: string[] = [];

  const [instancesResult, traceStatsResult, skillsResult, auditsResult, alertsResult] =
    await Promise.allSettled([
      deps.clawManagerClient?.isConfigured()
        ? deps.clawManagerClient.listInstances()
        : Promise.reject(new Error('claw-manager not configured')),
      deps.aiGatewayRepo?.getTraceStats(),
      deps.skillService?.listSharedAssets(),
      deps.auditService?.list(10),
      deps.analyticsService.getAlerts(),
    ]);

  if (instancesResult.status === 'fulfilled') {
    const items = instancesResult.value.items ?? [];
    const running = items.filter((i) => i.status === 'running').length;
    const stopped = items.filter((i) => i.status === 'stopped').length;
    const creating = items.filter((i) => i.status === 'creating').length;
    const failed = items.filter((i) => i.status === 'failed' || i.status === 'error').length;
    sections.push(
      `## 数字员工实例\n- 总数: ${items.length}\n- 运行中: ${running}, 已停止: ${stopped}, 创建中: ${creating}, 失败: ${failed}`
    );
    if (items.length > 0 && items.length <= 50) {
      const list = items
        .map(
          (i) =>
            `  · ${i.name || i.podName} | 状态: ${i.status} | 节点: ${i.nodeName || '-'} | Pod: ${i.podName}`
        )
        .join('\n');
      sections.push(list);
    }
  } else {
    sections.push('## 数字员工实例\n- claw-manager 数据源不可用');
  }

  if (traceStatsResult.status === 'fulfilled' && traceStatsResult.value) {
    const stats = traceStatsResult.value;
    sections.push(
      `## AI 调用统计\n- 总调用数: ${stats.totalCalls}\n- 总 Token: ${stats.totalTokens}\n- 平均延迟: ${stats.avgLatency}ms\n- 错误率: ${stats.errorRate.toFixed(1)}%`
    );
  }

  if (skillsResult.status === 'fulfilled' && skillsResult.value) {
    const skills = skillsResult.value;
    sections.push(`## 技能资产\n- 共享技能数: ${skills.length}`);
  }

  if (alertsResult.status === 'fulfilled') {
    const { activeAlerts, alerts } = alertsResult.value;
    if (activeAlerts > 0) {
      const alertLines = alerts
        .slice(0, 5)
        .map((a) => `  · [${a.level}] ${a.message}`)
        .join('\n');
      sections.push(`## 活跃告警 (${activeAlerts})\n${alertLines}`);
    } else {
      sections.push('## 告警\n- 无活跃告警');
    }
  }

  if (auditsResult.status === 'fulfilled' && auditsResult.value) {
    const logs = auditsResult.value;
    if (logs.length > 0) {
      const logLines = logs
        .slice(0, 5)
        .map(
          (l) =>
            `  · [${new Date(l.at).toLocaleString('zh-CN')}] ${l.actor?.username || '-'}: ${l.action} ${l.type || ''}`
        )
        .join('\n');
      sections.push(`## 最近审计日志\n${logLines}`);
    }
  }

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  return `\n\n[平台实时数据 — ${now}]\n${sections.join('\n\n')}`;
}

export function createAdminAssistantRoutes(
  litellmClient: LiteLLMClient | undefined,
  analyticsService: AnalyticsService,
  clawManagerClient: ClawManagerClient | undefined,
  aiGatewayRepo?: AiGatewayRepository,
  skillService?: SkillService,
  auditService?: AuditService
) {
  const deps: AssistantDeps = {
    litellmClient,
    analyticsService,
    clawManagerClient,
    aiGatewayRepo,
    skillService,
    auditService,
  };

  const app = new Hono();

  app.post('/chat', async (c) => {
    const parsed = await parseBody(c, chatSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);

    if (!litellmClient || !litellmClient.isConfigured()) {
      return c.json({
        reply:
          '当前 AI 模型服务不可用。请确保:\n1. LiteLLM 服务已启动\n2. port-forward 已建立 (localhost:14000)\n3. 环境变量 LITELLM_BASE_URL 和 LITELLM_API_KEY 已配置',
      });
    }

    const caller = getCallerUser(c);
    const callerName = caller?.username || 'admin';

    const [contextSummary, modelName] = await Promise.all([
      buildContextSummary(deps),
      resolveModel(aiGatewayRepo, litellmClient),
    ]);

    const startTime = Date.now();

    try {
      const result = await litellmClient.chatCompletion({
        model: modelName,
        messages: [
          { role: 'system', content: buildSystemPrompt(caller) + contextSummary },
          ...parsed.data.messages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
        user: callerName,
        metadata: { source: 'admin-assistant', user: callerName },
      });

      const latencyMs = Date.now() - startTime;
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
            sessionId: 'admin-assistant',
            requestId: traceId,
            userId: callerName,
            requestedModel: modelName,
            actualModel: completion?.model ?? undefined,
            providerType: 'litellm',
            status: 'success',
            promptTokens: completion?.usage?.prompt_tokens ?? 0,
            completionTokens: completion?.usage?.completion_tokens ?? 0,
            latencyMs,
            createdAt: new Date(startTime),
            completedAt: new Date(),
          })
          .catch((err) => logger.warn({ err }, 'admin-assistant: trace record failed'));
      }

      return c.json({ reply });
    } catch (e) {
      const latencyMs = Date.now() - startTime;
      const msg = e instanceof Error ? e.message : 'unknown';
      logger.error(`AI assistant chat error: ${msg}`);

      if (aiGatewayRepo) {
        aiGatewayRepo
          .insertTrace({
            traceId: newId('trc'),
            sessionId: 'admin-assistant',
            requestId: newId('req'),
            userId: callerName,
            requestedModel: modelName,
            providerType: 'litellm',
            status: 'error',
            promptTokens: 0,
            completionTokens: 0,
            latencyMs,
            createdAt: new Date(startTime),
            completedAt: new Date(),
          })
          .catch(() => {});
      }

      const isConnectionError =
        msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('timeout');
      if (isConnectionError) {
        return c.json(
          {
            reply:
              'AI 模型服务连接失败。请检查:\n1. LiteLLM port-forward 是否正常 (localhost:14000)\n2. 运行 `./dev-portforward.sh status` 查看状态',
          },
          503
        );
      }

      return c.json({ reply: `请求 AI 服务时出错: ${msg}` }, 500);
    }
  });

  app.get('/context', async (c) => {
    const summary = await buildContextSummary(deps);
    return c.json({ summary });
  });

  return app;
}
