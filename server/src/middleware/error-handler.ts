import type { Context, Next } from 'hono';
import { AppError } from '../shared/utils.js';
import { logger } from '../app/logger.js';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, err.statusCode as 400);
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const status = (err as { status?: number }).status || 500;

    if (status >= 500) {
      logger.error({ err, method: c.req.method, path: c.req.path }, 'Unhandled server error');
    }

    return c.json({ success: false, error: message }, status as 500);
  }
}
