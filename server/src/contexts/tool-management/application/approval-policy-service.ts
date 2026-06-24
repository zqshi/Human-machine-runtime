import type { RiskLevel } from '../types.js';

/**
 * InstanceApprovalPolicy — 实例级工具审批策略(存 instance.approvalPolicy,#7)。
 *
 * instance.approvalPolicy 是 v1.2.1 预留的空字段(instance.ts:39),v1.9 赋予语义:
 * 控制哪些 risk 等级的工具调用需人工审批。
 */
export interface InstanceApprovalPolicy {
  /** 需要审批的 risk 等级列表(如 ['high'] = high 需审批);缺省 ['high'] */
  requireApprovalLevels?: RiskLevel[];
  /** 全局开关(false=所有工具直接执行,不审批;默认 true 当 policy 存在时) */
  enabled?: boolean;
}

/**
 * ApprovalPolicyService — 工具调用审批决策(#7 执行时 Human Review)。
 *
 * 纯逻辑(domain/application 层):shouldApprove(toolRiskLevel, approvalPolicy) → bool。
 * 决定 ToolRegistryService.invoke 是否前置审批 gate。
 *
 * 决策规则:
 *   - approvalPolicy 未配置或 enabled=false → 不审批(直接执行)
 *   - toolRiskLevel 在 requireApprovalLevels 中 → 需审批
 *   - requireApprovalLevels 缺省 ['high'](默认仅高危需审批)
 *
 * 审批队列持久化(tool_approvals 表)+ gate 接入见 routes/admin/tool-approvals.ts + tool-registry-service。
 */
export class ApprovalPolicyService {
  /**
   * 判断工具调用是否需要人工审批。
   * @param toolRiskLevel 工具声明的风险等级
   * @param approvalPolicy 实例审批策略(null=未配置,不审批)
   * @returns true=需审批(进队列),false=直接执行
   */
  shouldApprove(toolRiskLevel: RiskLevel, approvalPolicy: InstanceApprovalPolicy | null): boolean {
    if (!approvalPolicy || approvalPolicy.enabled === false) return false;
    const required = approvalPolicy.requireApprovalLevels ?? ['high'];
    return required.includes(toolRiskLevel);
  }

  /** 默认审批策略(仅 high 需审批),供实例初始化用 */
  defaultPolicy(): InstanceApprovalPolicy {
    return { enabled: true, requireApprovalLevels: ['high'] };
  }
}
