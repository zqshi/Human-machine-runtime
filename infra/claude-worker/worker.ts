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
 */

import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

interface TaskPayload {
  prompt: string;
  sessionId?: string;
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
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

  let capturedSessionId: string | undefined = task.sessionId;

  try {
    const stream = query({ prompt: task.prompt, options });

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
