/**
 * Executor Factory — 根据 execution_type 创建对应的执行器
 */

import type {
  ExecutionType,
  IToolExecutor,
  ExecutionResult,
  DecryptedCredential,
} from '../types.js';
import { HttpExecutor } from './http-executor.js';
import { DbExecutor } from './db-executor.js';
import { GatewayExecutor } from './gateway-executor.js';
import { McpClientPool, mcpAuthHeaders } from '../mcp-client.js';

const httpExecutor = new HttpExecutor();
const dbExecutor = new DbExecutor();
const gatewayExecutor = new GatewayExecutor();
const mcpPool = new McpClientPool();

/** MCP Call Executor — 走 MCP streamable-http 协议调用 MCP server 工具。 */
const mcpCallExecutor: IToolExecutor = {
  async execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>,
    credential?: DecryptedCredential
  ): Promise<ExecutionResult> {
    const endpoint = String(config.endpoint || '');
    const toolName = String(config.toolName || config.name || '');
    if (!endpoint) {
      return { success: false, error: 'MCP endpoint 未配置', durationMs: 0 };
    }
    if (!toolName) {
      return { success: false, error: 'MCP tool name 未配置', durationMs: 0 };
    }
    const start = Date.now();
    try {
      const client = mcpPool.get(endpoint, mcpAuthHeaders(credential));
      const result = await client.callTool(toolName, params);
      return {
        success: !result.isError,
        data: result,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  },
};

export function getExecutor(type: ExecutionType): IToolExecutor {
  switch (type) {
    case 'http_proxy':
      return httpExecutor;
    case 'db_query':
      return dbExecutor;
    case 'gateway_route':
      return gatewayExecutor;
    case 'mcp_call':
      return mcpCallExecutor;
    default:
      throw new Error(`未知的执行类型: ${type}`);
  }
}
