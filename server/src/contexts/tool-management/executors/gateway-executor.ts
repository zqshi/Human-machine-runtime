/**
 * Gateway Executor — 通过 API 网关路由转发调用
 */

import type { IToolExecutor, ExecutionResult, DecryptedCredential } from '../types.js';

export class GatewayExecutor implements IToolExecutor {
  async execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>,
    credential?: DecryptedCredential
  ): Promise<ExecutionResult> {
    const start = Date.now();

    const gatewayUrl = String(config.gatewayUrl || '');
    const path = String(config.path || '/');
    const method = String(config.method || 'GET').toUpperCase();

    if (!gatewayUrl) {
      return { success: false, error: 'execution_config 缺少 gatewayUrl', durationMs: 0 };
    }

    try {
      const url = new URL(path, gatewayUrl);

      // Query params
      const query = params.query as Record<string, string> | undefined;
      if (query && typeof query === 'object') {
        for (const [k, v] of Object.entries(query)) {
          url.searchParams.set(k, String(v));
        }
      }

      // Headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      // 注入凭证
      if (credential) {
        if (credential.apiKey) {
          headers[credential.headerName || 'X-API-Key'] = credential.apiKey;
        } else if (credential.token) {
          headers['Authorization'] = `Bearer ${credential.token}`;
        }
      }

      // 自定义 headers
      const customHeaders = params.headers as Record<string, string> | undefined;
      if (customHeaders && typeof customHeaders === 'object') {
        for (const [k, v] of Object.entries(customHeaders)) {
          headers[k] = String(v);
        }
      }

      // Fetch options
      const fetchOpts: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(30_000),
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && params.body) {
        fetchOpts.body = JSON.stringify(params.body);
      }

      const res = await fetch(url.toString(), fetchOpts);
      const durationMs = Date.now() - start;

      let data: unknown;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = text.length > 10_000 ? text.slice(0, 10_000) + '...(truncated)' : text;
      }

      return {
        success: res.ok,
        data,
        httpStatus: res.status,
        durationMs,
        ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
      };
    } catch (err) {
      return {
        success: false,
        error: `网关调用失败: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
