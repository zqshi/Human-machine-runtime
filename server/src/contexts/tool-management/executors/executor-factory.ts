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

const httpExecutor = new HttpExecutor();
const dbExecutor = new DbExecutor();
const gatewayExecutor = new GatewayExecutor();

/** MCP Call Executor — 占位实现，后续对接 MCP Server 协议 */
const mcpCallExecutor: IToolExecutor = {
  async execute(
    config: Record<string, unknown>,
    _params: Record<string, unknown>,
    _credential?: DecryptedCredential
  ): Promise<ExecutionResult> {
    const endpoint = String(config.endpoint || '');
    if (!endpoint) {
      return { success: false, error: 'MCP endpoint 未配置', durationMs: 0 };
    }
    // TODO: 实现 MCP Server 协议调用（SSE/stdio/streamable-http）
    return { success: false, error: 'MCP 直连执行暂未实现', durationMs: 0 };
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
