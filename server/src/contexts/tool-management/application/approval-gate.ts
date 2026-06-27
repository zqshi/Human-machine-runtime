import { ApprovalPolicyService, type InstanceApprovalPolicy } from './approval-policy-service.js';
import type { ToolApprovalRepository } from '../../../db/repositories/tool-approvals-repository.js';
import type { RiskLevel } from '../types.js';
import { newId } from '../../../shared/utils.js';

/**
 * ApprovalGate — 工具调用审批 gate(#7 执行时 Human Review)。
 *
 * 在 ToolRegistryService.invoke 前置:查 feature flag + 实例审批策略 + 工具风险等级,
 * 判定是否需人工审批。需审批则创建 pending 队列记录并返回 blocked(gate 拦截),
 * 由 admin 审批后触发续执行;不需审批则放行。
 *
 * 向后兼容:feature flag `tool.approval.enforce` 未启用 → 不拦截(默认 off)。
 * 实例未配 approvalPolicy 或无 instanceId → 不拦截(shouldApprove=false)。
 *
 * 跨聚合边界(§1.3):IInstanceApprovalPolicyPort / ISystemConfigPort 是 port,bootstrap
 * 用 InstanceRepository / SystemConfigService 适配注入,tool-management 不直接依赖
 * tenant-instance / system-config context(T47 解耦)。
 */
export interface IInstanceApprovalPolicyPort {
  getApprovalPolicy(instanceId: string): Promise<InstanceApprovalPolicy | null>;
}

/** 系统配置查询 port(守 §1.3,tool-management 不依赖 system-config context;T47 解耦) */
export interface ISystemConfigPort {
  isFeatureEnabled(key: string, tenantId?: string): Promise<boolean>;
}

export interface GateCheckInput {
  toolRiskLevel: RiskLevel;
  instanceId?: string;
  tenantId: string;
  toolId: string;
  toolName: string;
  params: Record<string, unknown>;
  context: Record<string, unknown>;
  requestedBy?: string;
}

export interface GateCheckResult {
  blocked: boolean;
  approvalId?: string;
  reason?: string;
}

const PASS: GateCheckResult = { blocked: false };

export class ApprovalGate {
  constructor(
    private policyService: ApprovalPolicyService,
    private instancePolicyPort: IInstanceApprovalPolicyPort | null,
    private approvalRepo: ToolApprovalRepository,
    private configPort: ISystemConfigPort
  ) {}

  async checkAndMaybeBlock(input: GateCheckInput): Promise<GateCheckResult> {
    // feature flag: tool.approval.enforce 未启用 → 不拦截(向后兼容,#13 灰度)
    const enforced = await this.configPort.isFeatureEnabled(
      'tool.approval.enforce',
      input.tenantId
    );
    if (!enforced) return PASS;

    // 查实例审批策略(无 instanceId 或未配 → null → shouldApprove=false 不拦截)
    let policy: InstanceApprovalPolicy | null = null;
    if (input.instanceId && this.instancePolicyPort) {
      policy = await this.instancePolicyPort.getApprovalPolicy(input.instanceId).catch(() => null);
    }
    if (!this.policyService.shouldApprove(input.toolRiskLevel, policy)) {
      return PASS;
    }

    // 需审批 → 创建 pending 队列记录(gate 拦截,等 admin 审批续执行)
    const approval = await this.approvalRepo.create({
      id: newId('tapr'),
      tenantId: input.tenantId,
      toolId: input.toolId,
      toolName: input.toolName,
      riskLevel: input.toolRiskLevel,
      instanceId: input.instanceId ?? null,
      params: input.params,
      context: input.context,
      requestedBy: input.requestedBy ?? null,
    });
    return {
      blocked: true,
      approvalId: approval.id,
      reason: `tool "${input.toolName}" (risk=${input.toolRiskLevel}) requires human approval`,
    };
  }
}
