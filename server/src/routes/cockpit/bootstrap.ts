import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { streamSSE } from 'hono/streaming';
import { newId, AppError } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { SSEEvent } from '../../shared/event-bus.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';
import { filteredResponse } from './pagination.js';
import type { AgentCore } from '../../contexts/agent-core/agent-core.js';
import type { Principal } from '../../middleware/auth.js';
import { ensureViteSandbox } from '../../contexts/tool-management/executors/vite-scaffold.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

const dispatchSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  input: z.record(z.unknown()).optional().default({}),
  priority: z.string().optional().default('normal'),
  /** 可选指定框架;缺省由 sandbox.selectBestAdapter 选 tool-loop(实例任务真执行) */
  framework: z.string().optional(),
});

export function createCockpitBootstrapRoutes(repo: CockpitRepository, agentCore?: AgentCore) {
  const app = new Hono();

  app.get('/bootstrap', (c) => {
    return c.json({
      quickCommands: [
        { id: 'qc1', icon: '📊', label: '查看报表', desc: '生成并查看今日业务报表' },
        { id: 'qc2', icon: '📝', label: '创建任务', desc: '快速创建一个新任务' },
        { id: 'qc3', icon: '🔍', label: '搜索知识', desc: '在知识库中搜索' },
        { id: 'qc4', icon: '⚙️', label: '系统配置', desc: '查看系统配置状态' },
      ],
      // proactiveActivities/proactiveInsights 移除假数据(无真实活动数据源)。
      // 接真实活动数据源(audit 近期事件/analytics)后可恢复,见去mock计划。
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

    if (agentCore) {
      // 传入 tenantId 激活 AgentExecutor 工具调用兜底（P3）：无 task/app/doc/board 意图时
      // 按消息匹配已注册工具并调用（registry.invoke 含租户隔离校验）。
      const result = await agentCore.harness.execute(userText, responseText, sessionId, tenantId);
      return c.json(result);
    }

    return c.json({ intent: null });
  });

  app.post('/agent/dispatch', async (c) => {
    if (!agentCore) {
      return c.json({ error: 'agent core not available' }, 503);
    }
    const raw = await c.req.json().catch(() => null);
    if (!raw) return c.json({ error: 'json body required' }, 400);
    const parsed = dispatchSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;
    // 安全修复:tenantId 从 auth principal 取(非 body 硬编码 ''),保证租户隔离生效
    const user = getUser(c);
    const tenantId = user.tenantId || 'default';
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      name: body.name,
      description: body.description,
      priority: (body.priority as 'normal') ?? 'normal',
      input: body.input,
    };
    try {
      const result = await agentCore.harness.dispatchTask(task, body.framework as never);
      return c.json(result);
    } catch (err) {
      // v1.9:guardrail block 拦截(#1)→ 返回拒答回复,不冒泡为 500
      if (err instanceof AppError && err.code === 'GUARDRAIL_BLOCKED') {
        return c.json({ blocked: true, reply: err.message }, 403);
      }
      throw err;
    }
  });

  app.get('/agent/status/:id', async (c) => {
    if (!agentCore) {
      return c.json({ error: 'agent core not available' }, 503);
    }
    const id = c.req.param('id');
    const status = await agentCore.harness.getTaskStatus(id);
    return c.json(status);
  });

  app.get('/agent/adapters', async (c) => {
    if (!agentCore) {
      return c.json({ adapters: [] });
    }
    const frameworks = agentCore.sandbox.listRegistered();
    const health = await agentCore.sandbox.healthCheckAll();
    return c.json({ adapters: health, frameworks });
  });

  // 路径B:查看实例 sandbox 工作目录文件(让前端展示 LLM 经 tool-loop 真实创建的文件)。
  // 只读,经 executor-factory 同款选择逻辑(OpenSandbox 配置→容器隔离,否则 node-fs),
  // 保证读取与 LLM 写入走同一执行器(否则写入容器内、读取宿主文件系,前端看不到文件)。
  app.get('/agent/sandbox/:instanceId/files', async (c) => {
    const instanceId = c.req.param('instanceId');
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceId)) {
      return c.json({ error: 'invalid instanceId' }, 400);
    }
    const relPath = c.req.query('path') || '.';
    // 用 factory 单例(与 LLM 写入共享 sandbox 缓存,否则新实例新 sandbox 看不到文件)
    const { sandboxExecutorSingleton } =
      await import('../../contexts/tool-management/executors/executor-factory.js');
    const executor = sandboxExecutorSingleton;
    const trimmed = relPath.replace(/\/+$/, '');
    const looksLikeFile = trimmed !== '.' && trimmed !== '..' && /\.[^/]+$/.test(trimmed);
    const result = looksLikeFile
      ? await executor.execute({ op: 'read_file' }, { path: relPath, __callerId: instanceId })
      : await executor.execute(
          { op: 'list_files' },
          { path: trimmed || '.', __callerId: instanceId }
        );
    return c.json(result);
  });

  // 路径B 应用预览:在 sandbox 内 npm install + 启动 vite dev,返回可访问 URL。
  // 仅 OpenSandbox 容器支持命令执行(node-fs 版无)。预览是长驻进程,首次启动慢(npm install)。
  app.post('/agent/sandbox/:instanceId/preview', async (c) => {
    const instanceId = c.req.param('instanceId');
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceId)) {
      return c.json({ error: 'invalid instanceId' }, 400);
    }
    const { sandboxExecutorSingleton } =
      await import('../../contexts/tool-management/executors/executor-factory.js');
    const executor = sandboxExecutorSingleton;
    // 仅 OpenSandboxExecutor 有 getSandboxForCommand(node-fs 版无命令执行能力)
    if (
      typeof (executor as { getSandboxForCommand?: unknown }).getSandboxForCommand !== 'function'
    ) {
      return c.json({ error: 'preview requires OpenSandbox (configure OPENSANDBOX_DOMAIN)' }, 503);
    }
    try {
      const sb = await (
        executor as { getSandboxForCommand: (id: string) => Promise<unknown> }
      ).getSandboxForCommand(instanceId);
      const sandbox = sb as {
        files: { search: (p: { path: string }) => Promise<unknown[]> };
        commands: {
          run: (
            cmd: string,
            opts?: { timeoutSeconds?: number; workingDirectory?: string; background?: boolean }
          ) => Promise<{ logs?: { stdout?: { text: string }[]; stderr?: { text: string }[] } }>;
        };
        getEndpointUrl: (port: number) => Promise<string> | string;
      };
      // 1. 确保 sandbox 有可运行的 vite 脚手架(轻应用兜底):
      //    LLM 经 write_file 只建业务文件(如 src/App.tsx),常漏 package.json/index.html/vite.config
      //    → 预览报 "no package.json" 或 vite dev 起不来。无 package.json 则注入最小可运行脚手架,
      //    LLM 业务文件叠加其上(同名覆盖)。逻辑提纯在 vite-scaffold.ts(§12 信号6:route 不堆逻辑)。
      const { injected } = await ensureViteSandbox(sandbox as never);
      const scaffoldNote = injected
        ? '[scaffold] 注入 vite+React+TS 脚手架(工作区无 package.json)\n'
        : '';
      // 2. npm install(前台同步,超时 120s;复用缓存则秒过)
      const installRes = await sandbox.commands.run(
        'cd /workspace && npm install --no-audit --prefer-offline 2>&1 | tail -3',
        { timeoutSeconds: 120, workingDirectory: '/workspace' }
      );
      const installLog =
        scaffoldNote + (installRes.logs?.stdout ?? []).map((l) => l.text).join('\n');
      // 3. 启动 vite dev。先清残留进程(上次预览的 background vite 未杀会占 5173,
      //    导致新 vite 退到 5174 而 probe 固定查 5173 → 误判未就绪)。
      try {
        await sandbox.commands.run('pkill -f "vite" 2>/dev/null; sleep 1', { timeoutSeconds: 8 });
        await sandbox.commands.run('npm run dev', {
          background: true,
          workingDirectory: '/workspace',
        });
        // 等 vite 就绪(首次启动需编译 + 依赖优化,给 12s)
        await sandbox.commands.run('sleep 12', { timeoutSeconds: 18 });
        // 验证 5173 真在监听(连一下),失败则捕获 vite 真实输出辅助定位
        const probe = await sandbox.commands.run(
          'curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null || echo fail',
          { timeoutSeconds: 10 }
        );
        const code = (probe.logs?.stdout ?? [])
          .map((l) => l.text)
          .join('')
          .trim();
        if (!code || code === 'fail' || code === '000') {
          // 前台同步跑 vite 3s 捕获真实启动输出(stderr 通常含报错原因)
          const diag = await sandbox.commands.run(
            'cd /workspace && timeout 6 npm run dev 2>&1 | head -25 || true',
            { timeoutSeconds: 12, workingDirectory: '/workspace' }
          );
          const devLog =
            (diag.logs?.stdout ?? []).map((l) => l.text).join('\n') +
            (diag.logs?.stderr ?? []).map((l) => l.text).join('\n');
          return c.json({
            success: false,
            installLog,
            error: `dev server 未就绪(端口5173无响应)。vite 启动输出:\n${devLog.slice(0, 800)}`,
          });
        }
      } catch (e) {
        return c.json({
          success: false,
          installLog,
          error: `dev server 启动失败(${e instanceof Error ? e.message : String(e)};可能 package.json 无 dev 脚本/vite 依赖,请让 AI 创建含 vite 的项目)`,
        });
      }
      // 4. 返回 sandbox endpoint URL(OpenSandbox 端口转发 5173)
      const url = await sandbox.getEndpointUrl(5173);
      return c.json({ success: true, url, installLog: installLog.slice(0, 500) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  /* ──── Knowledge Patterns ──── */

  app.get('/knowledge/patterns', async (c) => {
    const keyword = c.req.query('keyword');
    return c.json(
      await filteredResponse(
        repo,
        'knowledge_pattern',
        (key) => c.req.query(key),
        (items) => {
          if (!keyword) return items;
          const q = keyword.toLowerCase();
          return items.filter((p) =>
            (p.keywords as string[] | undefined)?.some((kw) => kw.toLowerCase().includes(q))
          );
        }
      )
    );
  });

  app.post('/knowledge/patterns', async (c) => {
    const body = await c.req.json();
    const pattern = { id: newId('kp'), ...body, usageCount: 0, createdAt: Date.now() };
    await repo.upsert('knowledge_pattern', pattern.id, pattern);
    return c.json(pattern, 201);
  });

  return app;
}
