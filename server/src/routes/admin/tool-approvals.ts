import { Hono } from 'hono';
import { z } from 'zod';
import type { ToolApprovalRepository } from '../../db/repositories/tool-approvals-repository.js';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import type { AuditService } from '../../contexts/audit-observability/audit-service.js';
import { ToolApprovalService } from '../../contexts/tool-management/application/tool-approval-service.js';

/**
 * 工具审批队列路由(admin 控制面,#7 执行时 Human Review)。
 *
 * 薄层(§1.3):参数校验 → 调 service/repo → 返回。
 * approve/reject 业务(状态机校验+执行+审计)下沉 ToolApprovalService(§12 信号6,route 不含业务判断)。
 * findPending 纯查询直调 repo(无业务逻辑)。
 * 错误:service 抛 AppError(404/409),由全局 errorHandler(app/index.ts:19)统一映射 statusCode,route 不重复 catch。
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
  const approvalService = new ToolApprovalService(approvalRepo, toolMgmt, audit);

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

  app.post('/:id/approve', async (c) =>
    c.json(await approvalService.approve(c.req.param('id'), reviewerOf(c)))
  );

  app.post('/:id/reject', async (c) => {
    const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as { reason?: string };
    return c.json(await approvalService.reject(c.req.param('id'), reviewerOf(c), body.reason));
  });

  return app;
}
