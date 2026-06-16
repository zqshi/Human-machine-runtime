/**
 * HTTP Executor — 通过 HTTP 代理调用目标 API
 *
 * 根据 tool_definition.execution_config 构建 HTTP 请求，
 * 注入凭证，发送到目标系统，返回标准化结果。
 */

import type { IToolExecutor, ExecutionResult, DecryptedCredential } from '../types.js';

export class HttpExecutor implements IToolExecutor {
  async execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>,
    credential?: DecryptedCredential
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const baseUrl = String(config.baseUrl || '');
    const path = String(config.path || '/');
    const method = String(config.method || 'GET').toUpperCase();

    if (!baseUrl) {
      return { success: false, error: 'execution_config 缺少 baseUrl', durationMs: 0 };
    }

    try {
      // 构建 URL（路径参数替换）
      let resolvedPath = path;
      const queryParams = new URLSearchParams();
      const bodyData: Record<string, unknown> = {};
      const { body, ...otherParams } = params;

      for (const [key, value] of Object.entries(otherParams)) {
        if (resolvedPath.includes(`{${key}}`)) {
          resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(value)));
        } else {
          // 非路径参数 → GET 走 query，其他方法走 body
          if (method === 'GET') {
            queryParams.set(key, String(value));
          } else {
            bodyData[key] = value;
          }
        }
      }

      const url = new URL(resolvedPath, baseUrl);
      queryParams.forEach((v, k) => url.searchParams.set(k, v));

      // 构建 headers + 注入凭证
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (credential) {
        this.injectCredential(headers, credential);
      }

      // 构建 fetch options
      const fetchOpts: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(30_000),
      };

      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const requestBody = body && typeof body === 'object' ? body : bodyData;
        if (Object.keys(requestBody as object).length > 0) {
          fetchOpts.body = JSON.stringify(requestBody);
        }
      }

      // 发送请求
      const res = await fetch(url.toString(), fetchOpts);
      const durationMs = Date.now() - start;

      // 解析响应
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
        ...(res.ok ? {} : { error: `HTTP ${res.status}: ${res.statusText}` }),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  private injectCredential(headers: Record<string, string>, cred: DecryptedCredential): void {
    switch (cred.type) {
      case 'bearer':
        if (cred.token) headers['Authorization'] = `Bearer ${cred.token}`;
        break;
      case 'api_key':
        if (cred.apiKey) {
          const headerName = cred.headerName || 'X-API-Key';
          headers[headerName] = cred.apiKey;
        }
        break;
      case 'basic':
        if (cred.username && cred.password) {
          headers['Authorization'] =
            'Basic ' + Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
        }
        break;
    }
  }
}
