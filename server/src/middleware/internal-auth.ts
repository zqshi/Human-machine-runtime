import type { Context, Next } from 'hono';

/**
 * internal-auth — worker↔server 内部 RPC 认证中间件(T18b-A)。
 *
 * 校验 X-Internal-Secret header 与配置的 internalToolSecret 比对(共享密钥,非 JWT)。
 * worker 容器调 /api/internal/* 时无用户 JWT,故用共享密钥认证。
 *
 * secret 未配则 503 拒绝所有 internal 请求(防误开:无密钥时 internal 路由不可用,
 * 避免 worker 容器无认证调用审批/日志端点)。
 *
 * 与 authMiddleware(JWT)互斥:internal 路由不挂 authMiddleware,只挂本中间件。
 * 挂载见 routes/index.ts(同 /health 公开端点模式 + 内部密钥)。
 */
export function createInternalAuthMiddleware(internalSecret: string) {
  return async (c: Context, next: Next) => {
    if (!internalSecret) {
      return c.json(
        { error: 'internal tool RPC disabled (CLAUDE_INTERNAL_TOOL_SECRET not configured)' },
        503
      );
    }
    const provided = c.req.header('x-internal-secret');
    if (provided !== internalSecret) {
      return c.json({ error: 'invalid internal secret' }, 401);
    }
    await next();
  };
}
