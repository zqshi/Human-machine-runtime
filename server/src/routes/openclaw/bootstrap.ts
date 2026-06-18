import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { SSEEvent } from '../../shared/event-bus.js';
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';
import type { AgentRuntimeService } from '../../contexts/agent-core/agent-runtime-service.js';
import type { AgentRuntimeAdapterRegistry } from '../../contexts/agent-core/domain/agent-runtime-adapter.js';

export function createOpenclawBootstrapRoutes(
  repo: OpenclawRepository,
  agentRuntimeService?: AgentRuntimeService,
  agentAdapterRegistry?: AgentRuntimeAdapterRegistry
) {
  const app = new Hono();

  app.get('/bootstrap', (c) => {
    return c.json({
      quickCommands: [
        { id: 'qc1', icon: '📊', label: '查看报表', desc: '生成并查看今日业务报表' },
        { id: 'qc2', icon: '📝', label: '创建任务', desc: '快速创建一个新任务' },
        { id: 'qc3', icon: '🔍', label: '搜索知识', desc: '在知识库中搜索' },
        { id: 'qc4', icon: '⚙️', label: '系统配置', desc: '查看系统配置状态' },
      ],
      proactiveActivities: [
        {
          id: 'pa1',
          icon: '✅',
          iconColor: '#34C759',
          action: '完成了财务月报',
          detail: '自动汇总本月数据',
          time: '10 分钟前',
          category: 'finance',
        },
        {
          id: 'pa2',
          icon: '🔄',
          iconColor: '#007AFF',
          action: '同步了客户数据',
          detail: '从 CRM 拉取最新数据',
          time: '30 分钟前',
          category: 'data',
        },
      ],
      proactiveInsights: [
        {
          id: 'pi1',
          icon: '💡',
          color: '#FF9500',
          title: '成本优化建议',
          description: '检测到 3 个可优化的 API 调用路径',
          urgency: 'medium',
        },
        {
          id: 'pi2',
          icon: '⚠️',
          color: '#FF3B30',
          title: '异常流量提醒',
          description: '近 1 小时请求量上升 150%',
          urgency: 'high',
        },
      ],
    });
  });

  app.get('/events', (c) => {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'connected', data: '{}' });

      const handler = (payload: SSEEvent) => {
        stream
          .writeSSE({ event: payload.type, data: JSON.stringify(payload.data) })
          .catch(() => {});
      };

      appEventBus.onSSE(handler);

      stream.onAbort(() => {
        appEventBus.offSSE(handler);
      });

      // keep alive — send comment every 30s to prevent proxy/LB timeout
      while (true) {
        await stream.sleep(30_000);
        await stream.writeSSE({ event: 'ping', data: '{}' });
      }
    });
  });

  app.post('/agent/execute', async (c) => {
    const { userText, responseText, sessionId, tenantId } = await c.req.json<{
      userText: string;
      responseText: string;
      sessionId: string;
      tenantId?: string;
    }>();

    if (agentRuntimeService) {
      // 传入 tenantId 激活 AgentExecutor 工具调用兜底（P3）：无 task/app/doc/board 意图时
      // 按消息匹配已注册工具并调用（registry.invoke 含租户隔离校验）。
      const result = await agentRuntimeService.execute(userText, responseText, sessionId, tenantId);
      return c.json(result);
    }

    return c.json({ intent: null });
  });

  app.post('/agent/dispatch', async (c) => {
    if (!agentAdapterRegistry) {
      return c.json({ error: 'agent adapter registry not available' }, 503);
    }
    const body = await c.req.json<{
      name: string;
      description: string;
      input?: Record<string, unknown>;
      priority?: string;
      framework?: string;
    }>();
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: '',
      name: body.name,
      description: body.description ?? '',
      priority: (body.priority as 'normal') ?? 'normal',
      input: body.input ?? {},
    };
    const result = await agentAdapterRegistry.dispatchTask(task, body.framework as never);
    return c.json(result);
  });

  app.get('/agent/adapters', async (c) => {
    if (!agentAdapterRegistry) {
      return c.json({ adapters: [] });
    }
    const frameworks = agentAdapterRegistry.listRegistered();
    const health = await agentAdapterRegistry.healthCheckAll();
    return c.json({ adapters: health, frameworks });
  });

  /* ──── Knowledge Patterns ──── */

  app.get('/knowledge/patterns', async (c) => {
    const keyword = c.req.query('keyword');
    let items = await repo.list('knowledge_pattern');
    if (keyword) {
      const q = keyword.toLowerCase();
      items = items.filter((p) =>
        (p.keywords as string[] | undefined)?.some((k) => k.toLowerCase().includes(q))
      );
    }
    return c.json({ items });
  });

  app.post('/knowledge/patterns', async (c) => {
    const body = await c.req.json();
    const pattern = { id: newId('kp'), ...body, usageCount: 0, createdAt: Date.now() };
    await repo.upsert('knowledge_pattern', pattern.id, pattern);
    return c.json(pattern, 201);
  });

  /* ──── Evaluation Scorecards ──── */

  app.get('/evaluation/scorecards', async (c) => {
    const type = c.req.query('type');
    let items = await repo.list('scorecard');
    if (type) items = items.filter((s) => s.type === type);
    return c.json({ items });
  });

  app.post('/evaluation/scorecards', async (c) => {
    const body = await c.req.json();
    const scorecard = { id: newId('sc'), ...body };
    await repo.upsert('scorecard', scorecard.id, scorecard);
    return c.json(scorecard, 201);
  });

  return app;
}
