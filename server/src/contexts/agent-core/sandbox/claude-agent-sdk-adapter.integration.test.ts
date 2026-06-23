/**
 * claude-worker 端到端集成测试
 *
 * 验证链路:claude-worker 容器(Docker) → Claude Agent SDK → Claude Code 子进程 → ANTHROPIC_BASE_URL 指向的 fake Anthropic server
 *
 * 触发方式:
 *   bash ../scripts/build-claude-worker.sh    # 先构建镜像
 *   CLAUDE_WORKER_E2E=1 npx vitest run --config vitest.integration.config.ts
 *
 * 默认 skip:CI unit 套件不跑本测试,需显式 CLAUDE_WORKER_E2E=1。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  startFakeAnthropicServer,
  type FakeAnthropicServer,
} from '../../../../../infra/claude-worker/test/fake-anthropic-server.js';

const E2E_ENABLED = !!process.env.CLAUDE_WORKER_E2E;
const WORKER_IMAGE = process.env.CLAUDE_WORKER_IMAGE ?? 'claude-worker:latest';

// 集成测试需 Docker + 镜像 + 显式开关,缺一则跳过
const SKIP = !E2E_ENABLED;

interface CollectedEvent {
  type: string;
  [k: string]: unknown;
}

function runWorker(opts: {
  anthropicBaseUrl: string;
  anthropicApiKey: string;
  taskPayload: object;
  workspace: string;
}): Promise<{ events: CollectedEvent[]; exitCode: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const envFile = join(opts.workspace, '.env');
    writeFileSync(
      envFile,
      `ANTHROPIC_API_KEY=${opts.anthropicApiKey}\n` +
        `ANTHROPIC_BASE_URL=${opts.anthropicBaseUrl}\n` +
        `CLAUDE_TASK_JSON=${JSON.stringify(opts.taskPayload)}\n`,
      { mode: 0o600 }
    );

    const args = [
      'run',
      '--rm',
      '-i',
      '--name',
      `claude-worker-itest-${Date.now()}`,
      '--memory',
      '512m',
      '--cpus',
      '0.5',
      '--network',
      'host', // 让容器能访问 host 127.0.0.1 的 fake server
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '-v',
      `${opts.workspace}:/workspace`,
      '--env-file',
      envFile,
      WORKER_IMAGE,
    ];

    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const events: CollectedEvent[] = [];
    let stdoutBuf = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8');
      // 按行解析 NDJSON
      let nl: number;
      while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          events.push(JSON.parse(line));
        } catch {
          // 非 JSON 行(stderr 误入/调试输出)忽略
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      // 处理 stdout 尾部
      if (stdoutBuf.trim()) {
        try {
          events.push(JSON.parse(stdoutBuf.trim()));
        } catch {
          // ignore
        }
      }
      resolve({ events, exitCode: code ?? -1, stderr });
    });
  });
}

describe.skipIf(SKIP)('claude-worker 端到端集成测试', () => {
  let fake: FakeAnthropicServer;
  let workspace: string;

  beforeAll(async () => {
    fake = await startFakeAnthropicServer({
      responseText: 'Task completed successfully.',
      inputTokens: 100,
      outputTokens: 50,
      model: 'claude-sonnet-4-6',
    });
    workspace = mkdtempSync(join(tmpdir(), 'hmr-itest-'));
  }, 60_000);

  afterAll(async () => {
    await fake.close();
    try {
      rmSync(workspace, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('fake Anthropic server 已启动并监听', () => {
    expect(fake.port).toBeGreaterThan(0);
    expect(fake.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('claude-worker 容器完成 prompt → emit session_id / result / done', async () => {
    const { events, exitCode, stderr } = await runWorker({
      anthropicBaseUrl: fake.url,
      anthropicApiKey: 'sk-ant-fake-test-key',
      taskPayload: {
        prompt: 'say hi',
        allowedTools: [],
        model: 'claude-sonnet-4-6',
        maxTurns: 1,
        maxBudgetUsd: 1,
      },
      workspace,
    });

    // 容器退出码 0
    expect(exitCode, `stderr: ${stderr}`).toBe(0);

    // 至少触发 session_id 事件
    const sessionEvent = events.find((e) => e.type === 'session_id');
    expect(sessionEvent, `events: ${JSON.stringify(events)}`).toBeDefined();
    expect(typeof sessionEvent!.sessionId).toBe('string');
    expect(sessionEvent!.sessionId).toMatch(/^sess_/);

    // result 事件包含 stopReason
    const resultEvent = events.find((e) => e.type === 'result');
    expect(resultEvent).toBeDefined();
    expect(typeof resultEvent!.result).toBe('string');
    expect(resultEvent!.stopReason).toBe('end_turn');

    // done 事件
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  }, 90_000);

  it('worker 容器内的 HTTP 请求命中 fake Anthropic server', async () => {
    const before = fake.requests.length;
    await runWorker({
      anthropicBaseUrl: fake.url,
      anthropicApiKey: 'sk-ant-fake-test-key',
      taskPayload: {
        prompt: 'verify upstream routing',
        allowedTools: [],
        model: 'claude-sonnet-4-6',
        maxTurns: 1,
        maxBudgetUsd: 1,
      },
      workspace,
    });
    expect(fake.requests.length).toBeGreaterThan(before);
  }, 90_000);
});

// 当 SKIP 时打印一次提示,方便 CI 日志判断
describe.skipIf(!SKIP)('claude-worker 集成测试(CLAUDE_WORKER_E2E 未启用,跳过)', () => {
  it('placeholder', () => {
    expect(SKIP).toBe(true);
  });
});
