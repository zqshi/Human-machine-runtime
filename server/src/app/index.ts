import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { config, validateProductionConfig } from '../config/index.js';
import { corsMiddleware, errorHandler, rateLimitMiddleware } from '../middleware/index.js';
import { registerRoutes } from '../routes/index.js';
import { db, pool } from '../db/client.js';
import { createAppContext } from './bootstrap.js';
import { logger } from './logger.js';
import { AppError } from '../shared/utils.js';
import { metricsMiddleware } from '../middleware/metrics.js';
import { registry } from '../shared/metrics.js';

const app = new Hono();

validateProductionConfig();

app.use('*', errorHandler);
app.use('*', secureHeaders());
app.use('*', corsMiddleware);
app.use('/api/*', rateLimitMiddleware);
app.use('*', metricsMiddleware);

// Prometheus 抓取端点（不经 rateLimit，避免抓取被限流）
app.get('/metrics', async (c) => {
  c.header('Content-Type', registry.contentType);
  return c.body(await registry.metrics());
});

const ctx = createAppContext(db);
registerRoutes(app, ctx);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ success: false, error: err.message, code: err.code }, err.statusCode as 400);
  }
  const status = (err as { status?: number }).status || 500;
  if (status >= 500) {
    logger.error({ err, method: c.req.method, path: c.req.path }, 'Unhandled Hono error');
  }
  return c.json({ success: false, error: err.message }, status as 500);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

logger.info({ port: config.port }, 'HMR Server starting');

const server: ServerType = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info({ port: info.port }, 'HMR Server running');

  if (ctx.matrixBot) {
    ctx.matrixBot.start().catch((err) => {
      logger.error({ err }, 'MatrixBot failed to start');
    });
  }

  ctx.agentRuntimeService.start().catch((err) => {
    logger.error({ err }, 'AgentRuntimeService failed to start');
  });

  ctx.gatewayHealth.start();
  ctx.quotaMonitor.start();
  ctx.traceSyncJob.start();
  ctx.schedulerService.start();
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing server');
  ctx.gatewayHealth.stop();
  ctx.quotaMonitor.stop();
  ctx.traceSyncJob.stop();
  ctx.schedulerService.stop();
  server.close(async () => {
    try {
      await pool.end({ timeout: 5 });
      logger.info('DB pool closed');
    } catch (err) {
      logger.warn({ err }, 'DB pool close error');
    }
    logger.info('Server closed, exiting');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
