import type { Context } from 'hono';
import type { ZodSchema, ZodError } from 'zod';

export async function parseBody<T>(
  c: Context,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: ReturnType<ZodError['flatten']> }> {
  const body = await c.req.json();
  const result = schema.safeParse(body);
  if (!result.success) return { error: result.error.flatten() };
  return { data: result.data };
}

export function badRequest(c: Context, error: unknown) {
  return c.json({ error: 'invalid request', details: error }, 400);
}
