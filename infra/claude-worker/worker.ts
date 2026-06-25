/**
 * Claude Agent SDK Worker
 *
 * 独立 Docker 容器内运行,接收 CLAUDE_TASK_JSON 环境变量,调用 Claude Agent SDK
 * query() 执行任务,按行(stdout)输出 NDJSON 事件供宿主进程(DockerWorkerRunner)消费。
 *
 * 事件协议:
 *   {"type":"session_id","sessionId":"sess_xxx"}     — 首次任务或 resume 后会话建立
 *   {"type":"progress","progress":50,"usage":{...}}   — 进度更新
 *   {"type":"result","result":"...","stopReason":"end_turn"} — 最终结果
 *   {"type":"done","sessionId":"sess_xxx"}            — 任务完成(成功)
 *   {"type":"error","message":"..."}                  — 任务失败(进程将以 exit 1 退出)
 *
 * 退出码:
 *   0 — 正常完成(无论 result 还是 error 事件)
 *   1 — 抛出未捕获异常 / API 故障 / 超时
 *   2 — CLAUDE_TASK_JSON 缺失或格式错误
 *
 * ⚠️ 工具执行脱节(T18b,见 docs/architecture/t18-tool-executor-mainline-gap.md):
 * 本进程内 claude-agent-sdk 用内置执行器自行执行 allowedTools(Bash/Read/...),
 * 不回调宿主 server。故审批/日志/凭证/计费对本 worker 路径失效。宿主侧
 * restrictToReadonlyTools 开关可限制只读工具;完整治本(canUseTool→server RPC)
 * 见 T18b-A,需重建本镜像 + CLAUDE_WORKER_E2E=1 容器验证。
 */

import {
  query,
  tool,
  createSdkMcpServer,
  type Options,
  type SDKMessage,
  type PermissionResult,
} from '@anthropic-ai/claude-agent-sdk';

// T18b-A:worker↔server 工具 RPC。env 由 docker-worker-runner --env-file 注入。
// 未配(空)则 canUseTool/custom tool 不注入,worker 降级无审批无外部工具执行(向后兼容,同 T18b-C 前)。
const INTERNAL_SECRET = process.env.INTERNAL_TOOL_SECRET ?? '';
const CALLBACK_URL = process.env.WORKER_CALLBACK_URL ?? '';

/**
 * checkToolWithServer — worker canUseTool 钩子调 server /api/internal/tool-check 审批(T18b-A)。
 * 导出为纯函数便于单测(mock fetch)。secret/URL 未配则 allow(降级无审批,向后兼容)。
 * server 不可达 → 保守 deny(避免无审批执行高风险工具)。
 */
export async function checkToolWithServer(
  url: string,
  secret: string,
  payload: { instanceId?: string; tenantId: string; toolName: string; input: Record<string, unknown> }
): Promise<{ allowed: boolean; reason: string }> {
  if (!secret || !url) return { allowed: true, reason: 'internal RPC not configured, fallback allow' };
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/internal/tool-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { allowed: false, reason: `tool-check HTTP ${res.status}` };
    const data = (await res.json()) as { allowed?: boolean; reason?: string };
    return { allowed: Boolean(data.allowed), reason: data.reason ?? '' };
  } catch (err) {
    return { allowed: false, reason: `tool-check failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * invokeToolWithServer — T18b 选项A:custom tool handler 调 server /api/internal/tool-invoke 执行外部工具(T18b-A)。
 *
 * 让外部/MCP 工具执行收口到 ToolRegistryService.invoke(审批/凭证解密/租户隔离/计费/callLog 全生效)。
 * 导出为纯函数便于单测(mock fetch)。返回 MCP CallToolResult(content text 块),供 SDK custom tool handler。
 * server 不可达/未配 → 返回 error 文本块(SDK 据此告知 Agent 工具失败,非静默)。
 *
 * CallToolResult 结构对齐 @modelcontextprotocol/sdk/types.js(本地等价类型,避免 worker 强依赖 MCP SDK)。
 */
export interface CallToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function invokeToolWithServer(
  url: string,
  secret: string,
  payload: {
    toolId: string;
    params: Record<string, unknown>;
    context: { tenantId: string; instanceId?: string; callerId?: string };
  }
): Promise<CallToolResult> {
  if (!secret || !url) {
    return {
      content: [{ type: 'text', text: 'tool-invoke not configured (INTERNAL_TOOL_SECRET/WORKER_CALLBACK_URL missing)' }],
      isError: true,
    };
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/internal/tool-invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return { content: [{ type: 'text', text: `tool-invoke HTTP ${res.status}` }], isError: true };
    }
    const data = (await res.json()) as {
      success?: boolean;
      output?: unknown;
      error?: string;
      pendingApproval?: { approvalId: string; reason: string };
    };
    // 审批 gate 拦截 → 告知 Agent 待审批(非静默失败)
    if (data.pendingApproval) {
      return {
        content: [{ type: 'text', text: `tool pending approval: ${data.pendingApproval.reason} (approvalId: ${data.pendingApproval.approvalId})` }],
        isError: true,
      };
    }
    if (!data.success) {
      return { content: [{ type: 'text', text: `tool failed: ${data.error ?? 'unknown error'}` }], isError: true };
    }
    // 成功:output 序列化为文本块(SDK 工具结果约定为 content 数组)
    const text = typeof data.output === 'string' ? data.output : JSON.stringify(data.output ?? '');
    return { content: [{ type: 'text', text }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `tool-invoke failed: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

interface TaskPayload {
  prompt: string;
  sessionId?: string;
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  /** D2:RAG 上下文块(Harness 召回的知识库/记忆),拼 prompt 时前置为 <context> 块 */
  ragContext?: string;
  /** v1.4:skill 内容块(组装层 boundSkills 召回),拼 prompt 时前置为 <skills> 块 */
  skillsContext?: string;
  /** T18b-A:实例 ID + 租户 ID,canUseTool/custom tool 回连 server 审批+执行用 */
  instanceId?: string;
  tenantId?: string;
  /**
   * T18b 选项A:外部工具定义列表(worker 注入为 custom tool)。
   * 每项 {toolId, name, description, inputSchema};handler 内调 invokeToolWithServer。
   * 由 docker-worker-runner 从 AgentDefinition.boundTools 解析透传(留 T29 runner 接线)。
   */
  externalTools?: Array<{
    toolId: string;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

function emit(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function main(): Promise<void> {
  const taskJson = process.env.CLAUDE_TASK_JSON;
  if (!taskJson) {
    process.stderr.write('CLAUDE_TASK_JSON env var is required\n');
    process.exit(2);
  }

  let task: TaskPayload;
  try {
    task = JSON.parse(taskJson) as TaskPayload;
  } catch (err) {
    process.stderr.write(`CLAUDE_TASK_JSON is not valid JSON: ${err}\n`);
    process.exit(2);
  }

  if (!task.prompt || typeof task.prompt !== 'string') {
    process.stderr.write('task.prompt is required and must be a string\n');
    process.exit(2);
  }

  const allowedTools = task.allowedTools ?? [
    'Bash',
    'Write',
    'Edit',
    'Read',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
  ];

  const options: Options = {
    cwd: '/workspace',
    allowedTools,
    permissionMode: 'dontAsk',
    maxTurns: task.maxTurns ?? 20,
    maxBudgetUsd: task.maxBudgetUsd ?? 5,
    model: task.model ?? 'claude-sonnet-4-6',
  };

  // T18b-A:内部密钥配置时注入 canUseTool 审批钩子(回连 server /api/internal/tool-check)。
  // 未配则不注入,worker 降级无审批(向后兼容)。让 #7 审批 gate 对实例主链路生效。
  if (INTERNAL_SECRET && CALLBACK_URL) {
    options.canUseTool = async (toolName, input): Promise<PermissionResult> => {
      const result = await checkToolWithServer(CALLBACK_URL, INTERNAL_SECRET, {
        instanceId: task.instanceId,
        tenantId: task.tenantId ?? 'default',
        toolName,
        input,
      });
      if (result.allowed) {
        return { behavior: 'allow', updatedInput: input };
      }
      return { behavior: 'deny', message: result.reason };
    };
  }

  // T18b 选项A:外部工具(MCP/custom tool)执行转发。把 task.externalTools 注册为 SDK custom tool,
  // handler 内调 invokeToolWithServer → server /api/internal/tool-invoke 收口 ToolRegistryService.invoke
  // (审批/凭证/租户隔离/计费/callLog 对外部工具生效)。内置工具仍 SDK 内置执行器跑。
  // externalTools 由 docker-worker-runner 从 AgentDefinition.boundTools 解析透传(留 runner 接线)。
  if (task.externalTools?.length && INTERNAL_SECRET && CALLBACK_URL) {
    const tenantId = task.tenantId ?? 'default';
    const instanceId = task.instanceId;
    const sdkTools = task.externalTools.map((t) =>
      tool(t.name, t.description, t.inputSchema as never, async (args) => {
        return invokeToolWithServer(CALLBACK_URL, INTERNAL_SECRET, {
          toolId: t.toolId,
          params: args as Record<string, unknown>,
          context: { tenantId, instanceId, callerId: 'worker' },
        });
      })
    );
    options.mcpServers = {
      // createSdkMcpServer 期望 SdkMcpToolDefinition<any>[];inputSchema 经 JSON 透传为裸对象,
      // 运行时 SDK 不深究 schema 形态(MCP 协议内部转 JSON schema),故 as never 绕过 Zod 泛型静态检查。
      'hmr-external-tools': createSdkMcpServer({
        name: 'hmr-external-tools',
        tools: sdkTools as never,
      }),
    };
  }

  if (task.sessionId) {
    options.resume = task.sessionId;
  }

  // D2:RAG 上下文作为 <context> 块前置注入 prompt;v1.4:skill 内容作为 <skills> 块前置。
  // SDK 0.1.0 query 只收单 prompt 字符串(无 systemPrompt),故拼进 prompt,XML 标签隔离降干扰。
  const blocks: string[] = [];
  if (task.skillsContext) blocks.push(`<skills>\n${task.skillsContext}\n</skills>`);
  if (task.ragContext) blocks.push(`<context>\n${task.ragContext}\n</context>`);
  const finalPrompt = blocks.length > 0 ? `${blocks.join('\n\n')}\n\n${task.prompt}` : task.prompt;

  let capturedSessionId: string | undefined = task.sessionId;

  try {
    const stream = query({ prompt: finalPrompt, options });

    for await (const message of stream as AsyncIterable<SDKMessage>) {
      const m = message as Record<string, unknown>;
      const type = m.type;
      const subtype = m.subtype;

      if (type === 'system' && subtype === 'init' && typeof m.session_id === 'string') {
        capturedSessionId = m.session_id;
        emit({ type: 'session_id', sessionId: capturedSessionId });
      } else if (type === 'system' && subtype === 'task_progress') {
        emit({
          type: 'progress',
          progress: typeof m.progress === 'number' ? m.progress : 50,
          usage: m.usage,
        });
      } else if ('result' in m && typeof m.result === 'string') {
        emit({
          type: 'result',
          result: m.result,
          stopReason: typeof m.stop_reason === 'string' ? m.stop_reason : 'unknown',
          usage: m.usage,
        });
      }
      // 其他 message 类型(assistant text deltas 等)不转发,避免 stdout 噪声
    }

    emit({ type: 'done', sessionId: capturedSessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', message });
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err}\n`);
  process.exit(1);
});
