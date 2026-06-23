/**
 * Fake Anthropic API Server(仅用于 claude-worker 集成测试)
 *
 * 起一个本地 HTTP server 模拟 https://api.anthropic.com 的 /v1/messages 流式响应,
 * 让 claude-worker 容器在 ANTHROPIC_BASE_URL 指向本 server 的情况下完成端到端验证。
 *
 * 协议契约(遵循 Anthropic Messages API SSE 流):
 *   POST /v1/messages
 *     body: { model, messages, system, max_tokens, stream, ... }
 *     response(content-type: text/event-stream):
 *       event: message_start
 *       data: {"type":"message_start","message":{"id":"msg_xxx","role":"assistant",...}}
 *
 *       event: content_block_delta
 *       data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
 *
 *       event: message_delta
 *       data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},
 *              "usage":{"input_tokens":100,"output_tokens":50}}
 *
 *       event: message_stop
 *       data: {"type":"message_stop"}
 *
 * 注意:Claude Agent SDK 在 worker 内部通过 Claude Code 子进程调用,
 * Claude Code 子进程读 ANTHROPIC_BASE_URL → 走 HTTP 到本 fake server。
 * 本 server 仅返回符合 Anthropic Messages API 形状的 SSE 流,
 * 不真正理解 prompt 内容(测试只验证协议链路)。
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export interface FakeAnthropicServer {
  port: number;
  url: string;
  /** 收到的所有请求 body(用于断言) */
  requests: Array<{ model?: string; messages?: unknown[]; system?: unknown }>;
  close(): Promise<void>;
}

export interface FakeServerOptions {
  /** SSE 流中插入的响应文本片段 */
  responseText?: string;
  /** 上报的 usage(SDK 会捕获并二次熔断) */
  inputTokens?: number;
  outputTokens?: number;
  /** 模型名(回写到 usage.model) */
  model?: string;
  /** 端口(默认 0 = 随机端口) */
  port?: number;
  /** 故障模式:返回非 200 触发 SDK 错误 */
  failStatus?: number;
  /** 故障消息 */
  failBody?: string;
}

/**
 * 启动 fake Anthropic server,返回端口与 close()。
 *
 * 用法:
 *   const fake = await startFakeAnthropicServer({ responseText: 'hello' });
 *   process.env.ANTHROPIC_BASE_URL = fake.url;
 *   // ... 调起 claude-worker ...
 *   await fake.close();
 */
export async function startFakeAnthropicServer(
  options: FakeServerOptions = {}
): Promise<FakeAnthropicServer> {
  const {
    responseText = 'Task completed successfully.',
    inputTokens = 100,
    outputTokens = 50,
    model = 'claude-sonnet-4-6',
    port = 0,
    failStatus,
    failBody,
  } = options;

  const received: FakeAnthropicServer['requests'] = [];

  const server: Server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      // /v1/messages 是 SDK 调 Anthropic 的唯一 endpoint
      if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }

      // 读 body
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const bodyText = Buffer.concat(chunks).toString('utf8');

      let parsed: { model?: string; messages?: unknown[]; system?: unknown } = {};
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        // ignore parse error
      }
      received.push(parsed);

      // 故障注入(测错误处理路径)
      if (failStatus) {
        res.writeHead(failStatus, { 'content-type': 'application/json' });
        res.end(failBody ?? JSON.stringify({ type: 'error', error: { message: 'forced failure' } }));
        return;
      }

      // SSE 流式响应
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });

      const send = (event: string, data: unknown): void => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // 1. message_start
      send('message_start', {
        type: 'message_start',
        message: {
          id: `msg_${randomUUID()}`,
          type: 'message',
          role: 'assistant',
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: 0 },
        },
      });

      // 2. 文本 delta(单次足够,链路验证不需要切片)
      send('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: responseText },
      });

      // 3. message_delta(带 stop_reason 与最终 usage)
      send('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      });

      // 4. message_stop
      send('message_stop', { type: 'message_stop' });

      res.end();
    }
  );

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    // 监听 0.0.0.0(非 127.0.0.1):让容器经 host.docker.internal(host IP)可达。
    // 127.0.0.1 仅 loopback,容器 bridge 网络 + mac docker desktop 的 --network host 均访问不到。
    server.listen(port, '0.0.0.0', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('failed to bind fake anthropic server'));
        return;
      }
      const actualPort = addr.port;
      // url 用 host.docker.internal(容器视角的 host 地址);host 进程不通过此 url 访问 server。
      resolve({
        port: actualPort,
        url: `http://host.docker.internal:${actualPort}`,
        requests: received,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
  });
}
