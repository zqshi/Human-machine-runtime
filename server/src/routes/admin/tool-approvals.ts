import { Hono } from 'hono';
import { z } from 'zod';
import type { ToolApprovalRepository } from '../../db/repositories/tool-approvals-repository.js';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import type { AuditService } from '../../contexts/audit-observability/audit-service.js';
import type { ExecutionContext } from '../../contexts/tool-management/types.js';

/**
 * 工具审批队列路由(admin 控制面,#7 执行时 Human Review)。
 *
 * 薄层(§1.3):参数校验 → 调 repo/toolMgmt → 审计 → 返回。
 * approve 触发实际 executeTool(用 stored params/context 快照),结果存回 approval.result。
 * auth:由 admin 聚合层统一挂(见 routes/index.ts)。
 */
const listQuerySchema = z.object({
  tenantId: z.string().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function reviewerOf(c: { get: (k: string) => unknown }): string {
  const user = c.get('user') as { username?: string } | undefined;
  return user?.username ?? 'platform_admin';
}

export function createAdminToolApprovalRoutes(
  approvalRepo: ToolApprovalRepository,
  toolMgmt: ToolManagementService,
  audit?: AuditService
) {
  const app = new Hono();

  app.get('/pending', async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    const q = parsed.success ? parsed.data : {};
    const items = await approvalRepo.findPending(
      q.tenantId,
      Math.min(100, q.limit ?? 50),
      Math.max(0, q.skip ?? 0)
    );
    return c.json({ items, total: items.length });
  });

  app.post('/:id/approve', async (c) => {
    const approval = await approvalRepo.findById(c.req.param('id'));
    if (!approval) return c.json({ error: 'approval not found' }, 404);
    if (approval.status !== 'pending') {
      return c.json({ error: `approval already ${approval.status}` }, 409);
    }
    const reviewer = reviewerOf(c);
    await approvalRepo.update(approval.id, {
      status: 'approved',
      reviewedBy: reviewer,
      reviewedAt: new Date(),
    });
    // 触发实际执行(用 gate 拦截时存的 params/context 快照)
    let result: Record<string, unknown>;
    try {
      const execResult = await toolMgmt.executeTool(
        approval.toolId,
        approval.params,
        approval.context as unknown as ExecutionContext
      );
      result = execResult as unknown as Record<string, unknown>;
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    await approvalRepo.update(approval.id, { result });
    audit?.log(
      'tool_approval.approved',
      { approvalId: approval.id, toolId: approval.toolId, tenantId: approval.tenantId },
      { actor: { username: reviewer, role: 'platform_admin' } }
    );
    return c.json({ approvalId: approval.id, status: 'approved', result });
  });

  app.post('/:id/reject', async (c) => {
    const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
      reason?: string;
    };
    const approval = await approvalRepo.findById(c.req.param('id'));
    if (!approval) return c.json({ error: 'approval not found' }, 404);
    if (approval.status !== 'pending') {
      return c.json({ error: `approval already ${approval.status}` }, 409);
    }
    const reviewer = reviewerOf(c);
    await approvalRepo.update(approval.id, {
      status: 'rejected',
      reviewedBy: reviewer,
      reviewNote: body.reason ?? null,
      reviewedAt: new Date(),
    });
    audit?.log(
      'tool_approval.rejected',
      {
        approvalId: approval.id,
        toolId: approval.toolId,
        tenantId: approval.tenantId,
        reason: body.reason,
      },
      { actor: { username: reviewer, role: 'platform_admin' } }
    );
    return c.json({ approvalId: approval.id, status: 'rejected' });
  });

  return app;
}
