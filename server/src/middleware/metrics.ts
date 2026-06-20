import type { Context, Next } from 'hono';
import { httpRequestTotal, httpRequestDurationSeconds } from '../shared/metrics.js';

/**
 * HTTP 指标中间件：记录每条请求的 method/route/status 计数与延迟。
 * routePath 优先（Hono 模板路径，如 /api/tenants/:id），回退到原始 path。
 */
export async function metricsMiddleware(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  try {
    await next();
  } finally {
    const duration = (Date.now() - start) / 1000;
    const route = c.req.routePath || c.req.path;
    const method = c.req.method;
    const status = String(c.res.status);
    httpRequestTotal.labels(method, route, status).inc();
    httpRequestDurationSeconds.labels(method, route, status).observe(duration);
  }
}
