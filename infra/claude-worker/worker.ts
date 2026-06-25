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

import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

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
