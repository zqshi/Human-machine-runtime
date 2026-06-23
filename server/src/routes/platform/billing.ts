import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import type { BillingService } from '../../contexts/billing/billing-service.js';
import type { Principal } from '../../contexts/identity-access/auth-service.js';
import type { BillingEventType } from '../../contexts/billing/domain/billing-event.js';
import { BILLING_EVENT_TYPES } from '../../contexts/billing/domain/billing-event.js';
import { parseBody, badRequest } from '../../shared/validation.js';

function resolveTenantId(c: Context): string {
  return c.req.query('tenantId') || (c.get('user') as Principal | undefined)?.tenantId || 'default';
}

const recordEventSchema = z.object({
  tenantId: z.string().min(1).optional(),
  type: z.enum(BILLING_EVENT_TYPES as unknown as [BillingEventType, ...BillingEventType[]]),
  amount: z.number().min(0),
  metadata: z.record(z.unknown()).optional(),
});

const listEventsQuerySchema = z.object({
  type: z
    .enum(BILLING_EVENT_TYPES as unknown as [BillingEventType, ...BillingEventType[]])
    .optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * billing 平台路由(平台管理员视角,跨租户查询)。
 *
 * - GET /account?tenantId=...    查询租户账户余额
 * - GET /events?tenantId=...     查询租户事件流(支持 type/since/until/limit 过滤)
 * - POST /events                 内部调用记账(用于运维手动补录/测试)
 *
 * 实际业务侧记账由 AgentRuntimeService / ClaudeAgentSdkAdapter 直接调
 * BillingService.recordEvent,不走 HTTP。
 */
export function createBillingRoutes(billingService: BillingService) {
  const app = new Hono();

  app.get('/account', async (c) => {
    const tenantId = resolveTenantId(c);
    const account = await billingService.getAccount(tenantId);
    if (!account) {
      return c.json(
        {
          success: true,
          data: {
            tenantId,
            balance: 0,
            currency: 'USD',
            updatedAt: null,
          },
        },
        200
      );
    }
    return c.json({ success: true, data: account });
  });

  app.get('/events', async (c) => {
    const tenantId = resolveTenantId(c);
    const parsed = listEventsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return badRequest(c, parsed.error.flatten());
    const events = await billingService.listEvents(tenantId, parsed.data);
    return c.json({ success: true, data: events });
  });

  app.post('/events', async (c) => {
    const parsed = await parseBody(c, recordEventSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const tenantId = parsed.data.tenantId ?? resolveTenantId(c);
    const event = await billingService.recordEvent({
      tenantId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      metadata: parsed.data.metadata,
    });
    return c.json({ success: true, data: event }, 201);
  });

  return app;
}
