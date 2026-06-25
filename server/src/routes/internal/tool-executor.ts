import { Hono } from 'hono';
import { z } from 'zod';
import type { SystemConfigService } from '../../contexts/system-config/system-config-service.js';
import type {
  ToolInvocationRequest,
  ToolInvocationResult,
} from '../../contexts/tool-management/tool-registry.js';

const toolCheckSchema = z.object({
  instanceId: z.string().optional(),
  tenantId: z.string().min(1),
  toolName: z.string().min(1),
  input: z.record(z.unknown()).default({}),
});

/**
 * T18b 选项A:/tool-invoke 入参 schema(对齐 ToolInvocationRequest)。
 * worker 外部/MCP 工具执行转发:toolId(definitionId)+params+context(tenantId/instanceId/callerId)。
 */
const toolInvokeSchema = z.object({
  toolId: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  context: z.object({
    tenantId: z.string().min(1),
    instanceId: z.string().optional(),
    callerId: z.string().optional(),
    timeout: z.number().optional(),
  }),
});

/** worker 外部工具执行转发的 ToolRegistryService 最小接口(结构化类型,便于 mock + 解耦)。 */
interface ToolExecutorPort {
  invoke(req: ToolInvocationRequest): Promise<ToolInvocationResult>;
}

/**
 * 内置工具风险策略(T18b-A)。
 *
 * claude-agent-sdk 内置工具(Bash/Read/Write/Edit/Glob/Grep/WebSearch/WebFetch)无
 * ToolDefinition,approvalGate.checkAndMaybeBlock 不认识(invoke:109 getDefinition 返回 null)。
 * 故 tool-check 用此表判定:
 *   - high(Bash/Write/Edit):canUseTool 同步钩子无法 pending 等人工审批 → deny(拒绝执行)
 *   - low(Read/Glob/Grep/WebSearch/WebFetch):放行
 *   - 未在表中(外部/custom 工具):保守 deny(留 T18a 第二阶段 MCP custom tool 覆盖)
 *
 * 与 T18b-C restrictToReadonlyTools 同向:enforce 开启时实例路径 high-risk 工具被拒。
 */
const BUILTIN_TOOL_RISK: Record<string, 'high' | 'low'> = {
  Bash: 'high',
  Write: 'high',
  Edit: 'high',
  Read: 'low',
  Glob: 'low',
  Grep: 'low',
  WebSearch: 'low',
  WebFetch: 'low',
};

/**
 * createInternalToolExecutorRoutes — worker↔server 工具调用 RPC(T18b-A)。
 *
 * 让 #7 审批 gate 对 claude-agent-sdk 实例主链路生效:worker canUseTool 钩子拦截
 * 工具调用 → fetch POST /tool-check → 本路由判定 allow/deny → 返回 PermissionResult。
 *
 * 范围(本轮 canUseTool 审批闭环):
 *   - 内置工具风险表 + tool.approval.enforce feature flag(同 approvalGate 向后兼容)
 *   - 不含:外部工具(MCP custom tool)审批/凭证/计费 → T18a 第二阶段(MCP 执行转发)
 *   - 不含:callLog 落库 → worker 需捕获 SDK tool_use_result + 内置工具 schema 加
 *     toolName 列(definitionId notNull 无 toolName),留后续
 *
 * 详见 docs/architecture/t18-tool-executor-mainline-gap.md T18b-A 实施记录。
 */
export function createInternalToolExecutorRoutes(
  configService: SystemConfigService,
  toolRegistryService?: ToolExecutorPort
) {
  const app = new Hono();

  /**
   * POST /tool-check — worker canUseTool 钩子调用,判定工具是否允许执行。
   * 入参:{instanceId?, tenantId, toolName, input}
   * 返回:{allowed, reason}
   */
  app.post('/tool-check', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'json body required' }, 400);
    const parsed = toolCheckSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    const { tenantId, toolName } = parsed.data;

    // feature flag 未启用 → 放行(向后兼容,同 approvalGate.checkAndMaybeBlock :53-57)
    const enforced = await configService.isFeatureEnabled('tool.approval.enforce', tenantId);
    if (!enforced) {
      return c.json({ allowed: true, reason: 'tool.approval.enforce off' });
    }

    const risk = BUILTIN_TOOL_RISK[toolName];
    if (risk === 'low') {
      return c.json({ allowed: true, reason: '' });
    }
    if (risk === 'high') {
      return c.json({
        allowed: false,
        reason: `builtin tool "${toolName}" is high-risk; denied on claude-agent-sdk instance path (canUseTool sync cannot pending-approve; use AgentExecutor path for human review)`,
      });
    }
    // 未识别工具(外部/custom)→ 保守 deny(留 T18a 第二阶段 MCP custom tool 覆盖)
    return c.json({
      allowed: false,
      reason: `tool "${toolName}" not in builtin risk table; denied (external tool approval留 T18a 第二阶段)`,
    });
  });

  /**
   * POST /tool-invoke — T18b 选项A:worker 外部/MCP 工具执行转发,收口到 ToolRegistryService.invoke。
   *
   * 让 #7 审批 gate / 凭证解密 / 租户隔离 / 调用计数对外部工具生效(内置工具 Bash/Read 等仍由
   * SDK 内置执行器跑 + canUseTool 审批)。invoke 内部落 tool_call_logs(definitionId),
   * 外部工具 callLog 经此端点覆盖;内置工具 callLog 留后续(T18a 已记)。
   * 详见 docs/architecture/t18-tool-executor-mainline-gap.md T18b-A。
   */
  app.post('/tool-invoke', async (c) => {
    if (!toolRegistryService) {
      return c.json({ error: 'tool registry service not configured' }, 503);
    }
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'json body required' }, 400);
    const parsed = toolInvokeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }
    try {
      const result = await toolRegistryService.invoke(parsed.data);
      return c.json(result);
    } catch {
      // 不裸露内部错误细节给 worker(跨进程调用,错误可能含敏感信息)
      return c.json({ error: 'tool invocation failed' }, 500);
    }
  });

  return app;
}
