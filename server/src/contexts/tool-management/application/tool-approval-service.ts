import type { ToolApprovalRepository } from '../../../db/repositories/tool-approvals-repository.js';
import type { ToolManagementService } from '../tool-management-service.js';
import type { AuditService } from '../../audit-observability/audit-service.js';
import type { ExecutionContext } from '../types.js';
import { AppError } from '../../../shared/utils.js';

/**
 * ToolApprovalService — 工具审批用例(application 层,§12 信号6 route 逻辑下沉)。
 *
 * 封装 approve/reject 业务:状态机校验(仅 pending 可审批)+ 执行(approve 触发 executeTool
 * 用 gate 拦截时存的 params/context 快照)+ 审计。route 薄层调用,业务判断不泄漏到路由。
 *
 * - approve:findById → 状态校验 → 置 approved → executeTool → 回写 result → 审计
 * - reject:findById → 状态校验 → 置 rejected(+ reviewNote)→ 审计
 * - 状态违规抛 AppError(409),not found 抛 AppError(404),由 route 映射 HTTP。
 */
export class ToolApprovalService {
  constructor(
    private approvalRepo: ToolApprovalRepository,
    private toolMgmt: ToolManagementService,
    private audit?: AuditService
  ) {}

  async approve(
    approvalId: string,
    reviewer: string
  ): Promise<{
    approvalId: string;
    status: string;
    result: Record<string, unknown>;
  }> {
    const approval = await this.approvalRepo.findById(approvalId);
    if (!approval) {
      throw new AppError('approval not found', 404, 'APPROVAL_NOT_FOUND');
    }
    // 领域状态机:仅 pending 可审批(下沉自 route,§12 信号6)
    if (approval.status !== 'pending') {
      throw new AppError(`approval already ${approval.status}`, 409, 'APPROVAL_ALREADY_PROCESSED');
    }
    await this.approvalRepo.update(approval.id, {
      status: 'approved',
      reviewedBy: reviewer,
      reviewedAt: new Date(),
    });
    // 触发实际执行(用 gate 拦截时存的 params/context 快照);执行失败不抛,记入 result
    let result: Record<string, unknown>;
    try {
      const execResult = await this.toolMgmt.executeTool(
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
    await this.approvalRepo.update(approval.id, { result });
    this.audit?.log(
      'tool_approval.approved',
      { approvalId: approval.id, toolId: approval.toolId, tenantId: approval.tenantId },
      { actor: { username: reviewer, role: 'platform_admin' } }
    );
    return { approvalId: approval.id, status: 'approved', result };
  }

  async reject(
    approvalId: string,
    reviewer: string,
    reason?: string
  ): Promise<{
    approvalId: string;
    status: string;
  }> {
    const approval = await this.approvalRepo.findById(approvalId);
    if (!approval) {
      throw new AppError('approval not found', 404, 'APPROVAL_NOT_FOUND');
    }
    if (approval.status !== 'pending') {
      throw new AppError(`approval already ${approval.status}`, 409, 'APPROVAL_ALREADY_PROCESSED');
    }
    await this.approvalRepo.update(approval.id, {
      status: 'rejected',
      reviewedBy: reviewer,
      reviewNote: reason ?? null,
      reviewedAt: new Date(),
    });
    this.audit?.log(
      'tool_approval.rejected',
      {
        approvalId: approval.id,
        toolId: approval.toolId,
        tenantId: approval.tenantId,
        reason,
      },
      { actor: { username: reviewer, role: 'platform_admin' } }
    );
    return { approvalId: approval.id, status: 'rejected' };
  }
}
