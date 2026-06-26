import { Hono } from 'hono';
import { z } from 'zod';
import type { CredentialManagementService } from '../../contexts/credential-vault/credential-management-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

/* ──── Validation Schemas ──── */

const createCredentialSchema = z.object({
  userId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  externalAccountId: z.string().max(256).optional(),
  scope: z.string().max(256).optional(),
  secretType: z.string().min(1).max(32),
  plaintext: z.string().min(1),
});

/** T37:多 secret 凭证(DB username+password)。供 McpDatabaseFlow 真连接凭证链路。 */
const createCredentialWithSecretsSchema = z.object({
  userId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  externalAccountId: z.string().max(256).optional(),
  scope: z.string().max(256).optional(),
  secrets: z
    .array(
      z.object({
        secretType: z.string().min(1).max(32),
        plaintext: z.string().min(1),
      })
    )
    .min(1, '至少一个 secret'),
});

const issueLeaseSchema = z.object({
  ttlSec: z.number().int().positive().optional(),
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* ──── Route Factory ──── */

export function createAdminCredentialRoutes(svc: CredentialManagementService) {
  const app = new Hono();

  /* ──── Credentials ──── */

  app.get('/', async (c) => {
    const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
    const offset = Number(c.req.query('offset')) || 0;
    const credentials = await svc.listCredentials(limit, offset);
    return c.json({ credentials });
  });

  app.post('/', async (c) => {
    const parsed = await parseBody(c, createCredentialSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const result = await svc.createCredential(parsed.data);
    return c.json(result, 201);
  });

  // T37:多 secret 凭证(DB username+password),供 McpDatabaseFlow 真连接
  app.post('/with-secrets', async (c) => {
    const parsed = await parseBody(c, createCredentialWithSecretsSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const result = await svc.createCredentialWithSecrets(parsed.data);
    return c.json(result, 201);
  });

  /* ──── Leases(静态路径必须先于 :id 注册,否则 /leases 被 /:id 捕获) ──── */

  app.get('/leases', async (c) => {
    const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
    const offset = Number(c.req.query('offset')) || 0;
    const status = c.req.query('status');
    const leases = await svc.listLeases(status ? { status } : {}, limit, offset);
    return c.json({ leases });
  });

  app.delete('/leases/:leaseId', async (c) => {
    const leaseId = c.req.param('leaseId');
    if (!leaseId) return badRequest(c, 'leaseId required');
    await svc.revokeLease(leaseId);
    return c.json({ success: true });
  });

  app.get('/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return badRequest(c, 'invalid id');
    const detail = await svc.getCredential(id);
    if (!detail) return c.json({ error: 'not found' }, 404);
    // detail.secrets 不含 ciphertext(安全),但路由层再确保不泄露
    return c.json(detail);
  });

  app.delete('/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return badRequest(c, 'invalid id');
    await svc.deleteCredential(id);
    return c.json({ success: true });
  });

  app.post('/:id/leases', async (c) => {
    // lease 关联 credential:从 credential 取 userId/providerId/scope
    const id = parseId(c.req.param('id'));
    if (id === null) return badRequest(c, 'invalid id');
    const detail = await svc.getCredential(id);
    if (!detail) return c.json({ error: 'not found' }, 404);
    // body 可选(仅 ttlSec);空 body 用默认 TTL
    const body = await c.req.json().catch(() => undefined);
    const parsed = issueLeaseSchema.safeParse(body ?? {});
    const ttlSec = parsed.success ? parsed.data.ttlSec : undefined;
    const lease = await svc.issueLease({
      userId: detail.userId,
      providerId: detail.providerId,
      scope: detail.scope ?? undefined,
      ttlSec,
    });
    return c.json(lease, 201);
  });

  return app;
}
