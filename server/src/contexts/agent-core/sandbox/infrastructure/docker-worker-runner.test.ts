import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, PassThrough } from 'stream';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DockerWorkerRunner, type Spawner, type WorkerRunOptions } from './docker-worker-runner.js';

/** 可控的 fake child_process.spawn 返回值 */
function makeFakeChild() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: (signal?: NodeJS.Signals) => boolean;
    killed: boolean;
  };
  child.stdout = stdout;
  child.stderr = stderr;
  child.killed = false;
  child.kill = vi.fn((signal?: NodeJS.Signals) => {
    child.killed = true;
    setImmediate(() => child.emit('close', null, signal ?? 'SIGTERM'));
    return true;
  });
  return child;
}

function makeSpawner(child: ReturnType<typeof makeFakeChild>): Spawner {
  return {
    spawn: vi.fn(() => child),
  };
}

function makeOpts(overrides: Partial<WorkerRunOptions> = {}): WorkerRunOptions {
  return {
    taskId: 'cld_test01',
    prompt: 'say hi',
    sessionId: undefined,
    instanceId: 'inst-1',
    tenantId: 'tn_demo',
    cwd: '/tmp/hmr-tasks/cld_test01',
    allowedTools: ['Bash', 'Write', 'Read'],
    model: 'claude-sonnet-4-6',
    maxTurns: 5,
    maxBudgetUsd: 2,
    timeoutMs: 30_000,
    apiKey: 'sk-ant-test',
    workerImage: 'claude-worker:latest',
    ...overrides,
  };
}

describe('DockerWorkerRunner - 命令构造', () => {
  it('spawn 调用 docker run 并包含核心参数', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const promise = runner.run(makeOpts(), {}, new AbortController());
    // 让 spawn 同步返回后,触发 exit 让 promise 完成
    child.emit('close', 0, null);
    await promise;

    expect(spawner.spawn).toHaveBeenCalledTimes(1);
    const [cmd, args] = spawner.spawn.mock.calls[0]!;
    expect(cmd).toBe('docker');
    expect(args).toContain('run');
    expect(args).toContain('--rm');
    expect(args).toContain('--name');
    expect(args).toContain('claude-worker-cld_test01');
    expect(args).toContain('--memory');
    expect(args).toContain('2g');
    expect(args).toContain('--cpus');
    expect(args).toContain('1.0');
    expect(args).toContain('--network');
    expect(args).toContain('bridge');
    expect(args).toContain('--cap-drop');
    expect(args).toContain('ALL');
    expect(args).toContain('--security-opt');
    expect(args).toContain('no-new-privileges');
    expect(args).toContain('claude-worker:latest');
  });

  it('挂载 cwd 到 /workspace', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const promise = runner.run(makeOpts({ cwd: '/data/tasks/cld_x' }), {}, new AbortController());
    child.emit('close', 0, null);
    await promise;

    const args = spawner.spawn.mock.calls[0]![1] as string[];
    const volumeIdx = args.indexOf('-v');
    expect(volumeIdx).toBeGreaterThan(-1);
    expect(args[volumeIdx + 1]).toBe('/data/tasks/cld_x:/workspace');
  });

  it('注入 ANTHROPIC_API_KEY 和 CLAUDE_TASK_JSON 通过 --env-file(避免 ps/proc 暴露)', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    // 清掉历史残留再开跑
    try {
      await import('fs').then((m) => m.unlinkSync(envFilePath));
    } catch {
      // ignore
    }

    // 在 spawn 触发后、close 之前读 env file,此时 finalize 还没跑
    let captured: string | null = null;
    const origSpawn = spawner.spawn;
    spawner.spawn = vi.fn((...args) => {
      const result = origSpawn(...args);
      // spawn 调用意味着 env file 已写入
      try {
        captured = readFileSync(envFilePath, 'utf8');
      } catch {
        captured = null;
      }
      return result;
    });

    const promise = runner.run(makeOpts(), {}, new AbortController());
    child.emit('close', 0, null);
    await promise;

    const args = spawner.spawn.mock.calls[0]![1] as string[];
    // 不应再出现命令行 -e ANTHROPIC_API_KEY / -e CLAUDE_TASK_JSON
    const envPairs = args.filter((_, i, arr) => i > 0 && arr[i - 1] === '-e');
    expect(envPairs.some((e) => e.startsWith('ANTHROPIC_API_KEY='))).toBe(false);
    expect(envPairs.some((e) => e.startsWith('CLAUDE_TASK_JSON='))).toBe(false);
    // 应改用 --env-file
    const envFileIdx = args.indexOf('--env-file');
    expect(envFileIdx).toBeGreaterThan(-1);
    expect(args[envFileIdx + 1]).toBe(envFilePath);

    // 验证 env file 内容(在 finalize 清理前已捕获)
    expect(captured).not.toBeNull();
    expect(captured!).toContain('ANTHROPIC_API_KEY=sk-ant-test');
    const taskLine = captured!
      .split('\n')
      .find((l) => l.startsWith('CLAUDE_TASK_JSON='))!
      .slice('CLAUDE_TASK_JSON='.length);
    const task = JSON.parse(taskLine);
    expect(task.prompt).toBe('say hi');
    expect(task.allowedTools).toEqual(['Bash', 'Write', 'Read']);
    expect(task.model).toBe('claude-sonnet-4-6');
    expect(task.maxTurns).toBe(5);
    expect(task.maxBudgetUsd).toBe(2);
    expect(task.sessionId).toBeUndefined();
  });

  it('anthropicBaseUrl 有值时 env file 注入 ANTHROPIC_BASE_URL(私有化经企业代理转发)', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    try {
      await import('fs').then((m) => m.unlinkSync(envFilePath));
    } catch {
      // ignore
    }
    let captured: string | null = null;
    const origSpawn = spawner.spawn;
    spawner.spawn = vi.fn((...args) => {
      const result = origSpawn(...args);
      try {
        captured = readFileSync(envFilePath, 'utf8');
      } catch {
        captured = null;
      }
      return result;
    });

    const promise = runner.run(
      makeOpts({ anthropicBaseUrl: 'http://litellm:4000' }),
      {},
      new AbortController()
    );
    child.emit('close', 0, null);
    await promise;

    expect(captured).not.toBeNull();
    expect(captured!).toContain('ANTHROPIC_API_KEY=sk-ant-test');
    expect(captured!).toContain('ANTHROPIC_BASE_URL=http://litellm:4000');
    expect(captured!).toContain('CLAUDE_TASK_JSON=');
  });

  it('anthropicBaseUrl 缺省时 env file 不含 ANTHROPIC_BASE_URL(SDK 直连)', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    try {
      await import('fs').then((m) => m.unlinkSync(envFilePath));
    } catch {
      // ignore
    }
    let captured: string | null = null;
    const origSpawn = spawner.spawn;
    spawner.spawn = vi.fn((...args) => {
      const result = origSpawn(...args);
      try {
        captured = readFileSync(envFilePath, 'utf8');
      } catch {
        captured = null;
      }
      return result;
    });

    const promise = runner.run(makeOpts(), {}, new AbortController());
    child.emit('close', 0, null);
    await promise;

    expect(captured).not.toBeNull();
    expect(captured!).toContain('ANTHROPIC_API_KEY=sk-ant-test');
    expect(captured!).not.toContain('ANTHROPIC_BASE_URL');
  });

  it('ragContext 有值时 CLAUDE_TASK_JSON payload 含 ragContext(D2 知识/记忆召回透传)', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    let captured: string | null = null;
    const origSpawn = spawner.spawn;
    spawner.spawn = vi.fn((...args) => {
      const result = origSpawn(...args);
      try {
        captured = readFileSync(envFilePath, 'utf8');
      } catch {
        captured = null;
      }
      return result;
    });

    const promise = runner.run(
      makeOpts({ ragContext: '【知识库参考】\n- 报销制度' }),
      {},
      new AbortController()
    );
    child.emit('close', 0, null);
    await promise;

    expect(captured).not.toBeNull();
    const taskLine = captured!
      .split('\n')
      .find((l) => l.startsWith('CLAUDE_TASK_JSON='))!
      .slice('CLAUDE_TASK_JSON='.length);
    const task = JSON.parse(taskLine);
    expect(task.ragContext).toBe('【知识库参考】\n- 报销制度');
  });

  it('ragContext 缺省时 payload 不含 ragContext 字段', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    let captured: string | null = null;
    const origSpawn = spawner.spawn;
    spawner.spawn = vi.fn((...args) => {
      const result = origSpawn(...args);
      try {
        captured = readFileSync(envFilePath, 'utf8');
      } catch {
        captured = null;
      }
      return result;
    });

    const promise = runner.run(makeOpts(), {}, new AbortController());
    child.emit('close', 0, null);
    await promise;

    expect(captured).not.toBeNull();
    const taskLine = captured!
      .split('\n')
      .find((l) => l.startsWith('CLAUDE_TASK_JSON='))!
      .slice('CLAUDE_TASK_JSON='.length);
    const task = JSON.parse(taskLine);
    expect(task.ragContext).toBeUndefined();
  });

  it('任务完成后清理 env file(不留 apiKey 残留)', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const promise = runner.run(makeOpts(), {}, new AbortController());
    child.emit('close', 0, null);
    await promise;

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    expect(existsSync(envFilePath)).toBe(false);
  });

  it('提供 sessionId 时 CLAUDE_TASK_JSON payload 含 sessionId', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const envFilePath = join(tmpdir(), 'hmr-task-cld_test01.env');
    let captured: string | null = null;
    const origSpawn = spawner.spawn;
    spawner.spawn = vi.fn((...args) => {
      const result = origSpawn(...args);
      try {
        captured = readFileSync(envFilePath, 'utf8');
      } catch {
        captured = null;
      }
      return result;
    }) as Spawner['spawn'];

    const promise = runner.run(
      makeOpts({ sessionId: 'sess-resume-001' }),
      {},
      new AbortController()
    );
    child.emit('close', 0, null);
    await promise;

    expect(captured).not.toBeNull();
    const taskLine = captured!
      .split('\n')
      .find((l) => l.startsWith('CLAUDE_TASK_JSON='))!
      .slice('CLAUDE_TASK_JSON='.length);
    expect(JSON.parse(taskLine).sessionId).toBe('sess-resume-001');
  });
});

describe('DockerWorkerRunner - NDJSON 流解析', () => {
  it('session_id 事件触发 onSessionId', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const captured: string[] = [];
    const promise = runner.run(
      makeOpts(),
      { onSessionId: (sid) => captured.push(sid) },
      new AbortController()
    );
    child.stdout.write(`${JSON.stringify({ type: 'session_id', sessionId: 'sess-abc' })}\n`);
    child.emit('close', 0, null);
    await promise;

    expect(captured).toEqual(['sess-abc']);
  });

  it('progress 事件触发 onProgress', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const captured: number[] = [];
    const promise = runner.run(
      makeOpts(),
      { onProgress: (p) => captured.push(p.progress) },
      new AbortController()
    );
    child.stdout.write(`${JSON.stringify({ type: 'progress', progress: 25 })}\n`);
    child.stdout.write(`${JSON.stringify({ type: 'progress', progress: 75 })}\n`);
    child.emit('close', 0, null);
    await promise;

    expect(captured).toEqual([25, 75]);
  });

  it('result 事件触发 onResult', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    let result: { result: string; stopReason: string } | null = null;
    const promise = runner.run(
      makeOpts(),
      {
        onResult: (r) => {
          result = r;
        },
      },
      new AbortController()
    );
    child.stdout.write(
      `${JSON.stringify({ type: 'result', result: 'hello', stopReason: 'end_turn' })}\n`
    );
    child.emit('close', 0, null);
    await promise;

    expect(result).toEqual({ result: 'hello', stopReason: 'end_turn' });
  });

  it('忽略无法解析的行(stderr 或垃圾)', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const promise = runner.run(makeOpts(), {}, new AbortController());
    child.stdout.write('not-json-line\n');
    child.stderr.write('some warning\n');
    child.stdout.write(`${JSON.stringify({ type: 'progress', progress: 50 })}\n`);
    child.emit('close', 0, null);

    // 不抛错即视为通过
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('DockerWorkerRunner - 超时与中断', () => {
  it('timeoutMs 超时触发 kill SIGTERM', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const errors: Error[] = [];
    const promise = runner.run(
      makeOpts({ timeoutMs: 5 }),
      { onError: (e) => errors.push(e) },
      new AbortController()
    );

    // 不主动 exit,等待 5ms 超时
    await promise;

    expect(child.killed).toBe(true);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(errors.some((e) => /timeout/i.test(e.message))).toBe(true);
  });

  it('非零退出码触发 onError', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const errors: Error[] = [];
    const promise = runner.run(
      makeOpts(),
      { onError: (e) => errors.push(e) },
      new AbortController()
    );
    child.stderr.write('api key invalid\n');
    child.emit('close', 1, null);
    await promise;

    expect(errors.length).toBeGreaterThan(0);
    // 非零退出码时 message 包含 stderr 内容(若有)或 "exit code N"
    expect(errors.some((e) => /worker failed/i.test(e.message))).toBe(true);
  });

  it('abortCtl.abort() 触发容器 kill', async () => {
    const child = makeFakeChild();
    const spawner = makeSpawner(child);
    const runner = new DockerWorkerRunner(spawner);

    const abortCtl = new AbortController();
    const promise = runner.run(makeOpts(), {}, abortCtl);
    abortCtl.abort();
    await promise;

    expect(child.killed).toBe(true);
  });
});
