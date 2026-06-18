/**
 * MCP Client — Model Context Protocol 客户端（streamable-http transport）
 *
 * 实现 JSON-RPC 2.0 over HTTP：initialize / tools.list / tools.call。
 * extends BaseGatewayClient 复用熔断（circuit breaker）/重试/审计/超时/checkHealth。
 * 响应兼容 streamable-http 的两种应答：单 JSON 与 SSE（text/event-stream）。
 *
 * SSE / stdio transport 为后续增量（当前 streamable-http 覆盖主流 MCP server）。
 */
import { BaseGatewayClient, GatewayError } from '../gateway/clients/base-client.js';
import type { DecryptedCredential } from './types.js';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  isError?: boolean;
}

const MCP_PROTOCOL_VERSION = '2025-03-26';
const ACCEPT = 'application/json, text/event-stream';

export class McpClient extends BaseGatewayClient {
  private nextId = 1;
  private initialized = false;

  constructor(endpoint: string, headers: Record<string, string> = {}) {
    super('mcp', endpoint, { headers });
  }

  /** 发送 JSON-RPC 请求并解析响应（单 JSON 或 SSE）。 */
  private async rpc<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const body = { jsonrpc: '2.0', id, method, params: params ?? {} };
    const res = await this.requestRaw('', {
      method: 'POST',
      body,
      headers: { Accept: ACCEPT },
    });
    return this.parseResponse<T>(res, id);
  }

  /** 发送 JSON-RPC 通知（无 id，无响应期望）。 */
  private async notify(method: string): Promise<void> {
    await this.requestRaw('', {
      method: 'POST',
      body: { jsonrpc: '2.0', method },
      headers: { Accept: ACCEPT },
      skipRetry: true,
    });
  }

  private async parseResponse<T>(res: Response, id: number): Promise<T> {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/event-stream')) {
      const text = await res.text();
      return this.extractSse<T>(text, id);
    }
    const json = (await res.json()) as {
      id?: number;
      result?: T;
      error?: { code: number; message: string };
    };
    if (json.error) {
      throw new GatewayError(
        `MCP error ${json.error.code}: ${json.error.message}`,
        502,
        this.baseUrl
      );
    }
    return json.result as T;
  }

  /** 从 SSE 文本流中提取匹配 id 的 JSON-RPC result。 */
  private extractSse<T>(text: string, id: number): T {
    for (const raw of text.split('\n')) {
      const m = raw.match(/^data:\s*(.+)$/);
      if (!m) continue;
      let obj: { id?: number; result?: T; error?: { message: string } };
      try {
        obj = JSON.parse(m[1]);
      } catch {
        continue;
      }
      if (obj.id === id) {
        if (obj.error) {
          throw new GatewayError(`MCP error: ${obj.error.message}`, 502, this.baseUrl);
        }
        return obj.result as T;
      }
    }
    throw new GatewayError('MCP SSE 响应未包含匹配 id 的结果', 502, this.baseUrl);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.rpc('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'hmr-tool-registry', version: '1.0.0' },
    });
    await this.notify('notifications/initialized');
    this.initialized = true;
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialize();
    const r = await this.rpc<{ tools?: McpTool[] }>('tools/list');
    return r.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.initialize();
    return this.rpc<McpToolCallResult>('tools/call', { name, arguments: args });
  }
}

/** McpClient 连接池：按 endpoint+headers 复用（避免每次调用重新 initialize）。 */
export class McpClientPool {
  private clients = new Map<string, McpClient>();

  get(endpoint: string, headers: Record<string, string> = {}): McpClient {
    const key = `${endpoint}|${JSON.stringify(headers)}`;
    let c = this.clients.get(key);
    if (!c) {
      c = new McpClient(endpoint, headers);
      this.clients.set(key, c);
    }
    return c;
  }

  /** 仅供测试：清空池。 */
  reset(): void {
    this.clients.clear();
  }
}

/** 从解密凭证构造 MCP 鉴权头。 */
export function mcpAuthHeaders(credential?: DecryptedCredential): Record<string, string> {
  if (!credential) return {};
  if (credential.token) return { Authorization: `Bearer ${credential.token}` };
  if (credential.apiKey) return { [credential.headerName || 'X-API-Key']: credential.apiKey };
  return {};
}
