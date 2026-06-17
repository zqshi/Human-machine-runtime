/**
 * Unified HTTP client factory — infrastructure 层单一 request 实现。
 *
 * 所有 API client 共用本工厂，统一以下行为：
 * - 超时控制（默认 10s，可通过 init.timeoutMs 覆盖）
 * - 幂等重试（GET/HEAD 默认重试 1 次）
 * - 401 会话过期回调（可通过 init.skipSessionExpired 跳过）
 * - AbortError / TimeoutError → ApiError(0, ...)
 * - 非 JSON 响应安全降级为 ApiError，而非 SyntaxError（核心修复点）
 *
 * 设计约束（CLAUDE.md DDD 分层）：
 * - 本文件位于 infrastructure 层，不依赖 application/presentation。
 * - 401 回调通过 sessionHandler 注入，避免反向依赖。
 */

import { handleSessionExpired } from './sessionHandler';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

/** request 扩展配置：在标准 RequestInit 之外追加本工厂特有字段。 */
export interface RequestOptions extends RequestInit {
  /** 单次请求超时（毫秒），默认 10_000。 */
  timeoutMs?: number;
  /** 跳过 401 会话过期回调（如登录端点自身返回 401 时不应触发跳转）。 */
  skipSessionExpired?: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** 认证端点白名单：401 不触发会话过期跳转。 */
const AUTH_PATH_PREFIXES = ['/api/auth/login', '/api/auth/sso/'];

function isAuthEndpoint(path: string): boolean {
  return AUTH_PATH_PREFIXES.some((p) => path.startsWith(p));
}

/** 安全解析响应文本为 JSON；失败抛 ApiError 而非 SyntaxError。 */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(0, '响应不是有效的 JSON 格式');
  }
}

/**
 * 统一 request：封装 fetch，提供超时、幂等重试、401 处理、JSON 安全解析。
 *
 * @param path    请求路径（相对路径，dev 由 Vite proxy 转发）
 * @param init    扩展的 RequestInit（支持 timeoutMs / skipSessionExpired）
 */
export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  // 路径合法性校验（迁移自 admin/employeeMemory/department client）
  if (path.includes('/undefined') || path.includes('/null')) {
    return Promise.reject(new Error(`invalid API path: ${path}`));
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = isIdempotent ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () =>
        controller.abort(
          new DOMException(`Request timeout after ${timeoutMs}ms`, 'TimeoutError')
        ),
      timeoutMs
    );

    try {
      const res = await fetch(path, {
        credentials: 'include',
        signal: controller.signal,
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });

      // 401 处理：非认证端点触发会话过期回调
      if (res.status === 401 && !init?.skipSessionExpired && !isAuthEndpoint(path)) {
        const body = await res.json().catch(() => undefined);
        handleSessionExpired();
        const msg = (body as { error?: string })?.error || 'Unauthorized';
        throw new ApiError(401, msg, body);
      }

      if (!res.ok) {
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          /* 非 JSON 错误体，忽略 */
        }
        throw new ApiError(res.status, res.statusText, body);
      }

      const text = await res.text();
      return (text ? safeJsonParse(text) : undefined) as T;
    } catch (err) {
      lastError = err;
      // ApiError 直接抛出（不重试业务错误）
      if (err instanceof ApiError) throw err;
      // 最后一次尝试或非幂等请求：转换 AbortError/TimeoutError
      if (attempt < maxAttempts - 1) continue;
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new ApiError(0, '请求超时，请检查网络连接');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 理论不可达（循环内必抛出），保留以通过类型检查
  throw lastError;
}
