/**
 * CollaborationTrigger — 协作决策触发器
 *
 * 当协作链路中的节点需要决策时触发决策请求。
 */

import type { DecisionTrigger, DecisionTriggerHandler } from '../../domain/agent/DecisionHub';
import type {
  RecommendationOption,
  DecisionRequest,
} from '../../domain/agent/DecisionRequest';
import type { CollaborationNodeContext } from '../../domain/agent/DecisionTriggerFactories';
export type { CollaborationNodeContext } from '../../domain/agent/DecisionTriggerFactories';

/**
 * CollaborationTrigger — 协作决策触发器
 */
export class CollaborationTrigger implements DecisionTriggerHandler {
  private static readonly DEFAULT_DEADLINE = 30 * 60 * 1000; // 30 分钟
  private static readonly URGENCY_DEADLINES: Record<string, number> = {
    critical: 10 * 60 * 1000, // 10 分钟
    high: 20 * 60 * 1000, // 20 分钟
    normal: 30 * 60 * 1000, // 30 分钟
    low: 60 * 60 * 1000, // 1 小时
  };

  /**
   * 预处理：评估 urgency、调整 deadline、生成推荐方案
   */
  async preprocess(trigger: DecisionTrigger): Promise<DecisionTrigger> {
    // 从 trigger 中提取协作节点上下文
    const nodeContext = this.extractCollaborationContext(trigger);

    // 1. 计算 urgency
    const urgency = this.calculateUrgency(nodeContext);

    // 2. 计算 deadline
    const deadline = Date.now() + this.getDeadlineForUrgency(urgency);

    // 3. 生成推荐方案和备选方案
    const { recommendation, alternatives } = this.generateCollaborationRecommendations(
      trigger,
      nodeContext,
      urgency
    );

    return {
      ...trigger,
      urgency,
      deadline,
      recommendation,
      alternatives,
      impactScope: 2,
      downstreamTaskIds: trigger.relatedEntities.taskId ? [trigger.relatedEntities.taskId] : [],
    };
  }

  /**
   * 后处理：决策创建后的额外操作
   */
  async postprocess(_decision: DecisionRequest): Promise<void> {
    // no-op: extensibility hook for future side-effects
  }

  /**
   * 从 trigger 中提取协作节点上下文
   */
  private extractCollaborationContext(trigger: DecisionTrigger): CollaborationNodeContext {
    const extra = (trigger as unknown as { extra?: Record<string, unknown> }).extra ?? {};

    return {
      collaborationId: String(extra?.collaborationId ?? ''),
      collaborationName: String(extra?.collaborationName ?? '未知协作'),
      nodeId: String(extra?.nodeId ?? ''),
      nodeName: String(extra?.nodeName ?? '未知节点'),
      requesterId: String(extra?.requesterId ?? ''),
      requesterName: String(extra?.requesterName ?? '未知用户'),
      nodeType: (extra?.nodeType as CollaborationNodeContext['nodeType']) ?? 'approval',
      changeSummary: String(extra?.changeSummary ?? ''),
      requiresApproval: Boolean(extra?.requiresApproval ?? true),
      approvers: Array.isArray(extra?.approvers) ? (extra.approvers as string[]) : [],
      currentApprover: String(extra?.currentApprover ?? ''),
      estimatedDelayIfRejected: Number(extra?.estimatedDelayIfRejected ?? 0),
      hasConflictingChanges: Boolean(extra?.hasConflictingChanges ?? false),
    };
  }

  /**
   * 计算紧急度
   */
  private calculateUrgency(
    context: CollaborationNodeContext
  ): 'critical' | 'high' | 'normal' | 'low' {
    // 1. 阻塞类型节点最紧急
    if (context.nodeType === 'blocking') {
      return 'critical';
    }

    // 2. 有冲突变更，需要尽快解决
    if (context.hasConflictingChanges) {
      return 'high';
    }

    // 3. 审批类型比较紧急
    if (context.nodeType === 'approval') {
      return 'high';
    }

    // 4. 拒绝会导致较大延迟
    if (context.estimatedDelayIfRejected > 24 * 3600000) {
      return 'high';
    }

    // 5. 默认普通优先级
    return 'normal';
  }

  /**
   * 根据紧急度获取截止时间
   */
  private getDeadlineForUrgency(urgency: string): number {
    return CollaborationTrigger.URGENCY_DEADLINES[urgency] ?? CollaborationTrigger.DEFAULT_DEADLINE;
  }

  /**
   * 生成协作决策的推荐方案和备选方案
   */
  private generateCollaborationRecommendations(
    trigger: DecisionTrigger,
    context: CollaborationNodeContext,
    _urgency: string
  ): { recommendation: RecommendationOption; alternatives: RecommendationOption[] } {
    const baseRecommendation: RecommendationOption = {
      id: `rec-collab-${Date.now()}`,
      label: this.getPrimaryLabel(context),
      description: this.getPrimaryDescription(context),
      reasoning: this.getReasoningForContext(context),
      estimatedImpact: this.getEstimatedImpact(context, 'approve'),
      riskLevel: this.getRiskLevel(context, 'approve'),
    };

    const alternatives: RecommendationOption[] = [];

    // 备选 1：请求修改
    if (context.nodeType !== 'approval') {
      alternatives.push({
        id: `alt-modify-${Date.now()}-1`,
        label: '请求修改',
        description: '要求发起方修改方案',
        reasoning: '当前方案需要调整',
        estimatedImpact: '增加一个迭代',
        riskLevel: 'medium',
      });
    }

    // 备选 2：添加评论
    alternatives.push({
      id: `alt-comment-${Date.now()}-2`,
      label: '添加评论',
      description: '添加评论而不做决策',
      reasoning: '需要更多信息或讨论',
      estimatedImpact: '不阻塞进度',
      riskLevel: 'low',
    });

    // 备选 3：拒绝
    alternatives.push({
      id: `alt-reject-${Date.now()}-3`,
      label: '拒绝',
      description: '拒绝当前变更',
      reasoning: '变更不符合要求',
      estimatedImpact: this.getDelayDescription(context),
      riskLevel: 'high',
    });

    // 备选 4：批准带条件
    if (context.nodeType === 'approval') {
      alternatives.push({
        id: `alt-conditional-${Date.now()}-4`,
        label: '有条件批准',
        description: '批准但要求满足特定条件',
        reasoning: '可以推进但需要确保要求',
        estimatedImpact: '继续推进，需满足条件',
        riskLevel: 'medium',
      });
    }

    // 备选 5：转给他人
    if (context.approvers.length > 1) {
      const otherApprovers = context.approvers.filter((a) => a !== context.currentApprover);
      if (otherApprovers.length > 0) {
        alternatives.push({
          id: `alt-transfer-${Date.now()}-5`,
          label: '转给他人审批',
          description: `将审批转给 ${otherApprovers.join(' 或 ')}`,
          reasoning: '当前审批人无法及时处理',
          estimatedImpact: '延迟 30-60 分钟',
          riskLevel: 'medium',
        });
      }
    }

    return {
      recommendation: baseRecommendation,
      alternatives,
    };
  }

  /**
   * 获取主要操作标签
   */
  private getPrimaryLabel(context: CollaborationNodeContext): string {
    switch (context.nodeType) {
      case 'approval':
        return '批准并继续';
      case 'review':
        return '确认审查';
      case 'modification':
        return '接受变更';
      case 'blocking':
        return '解除阻塞';
      default:
        return '批准并继续';
    }
  }

  /**
   * 获取主要操作描述
   */
  private getPrimaryDescription(context: CollaborationNodeContext): string {
    const parts: string[] = [];
    parts.push(`批准 ${context.requesterName} 在协作链「${context.collaborationName}」中的变更`);
    parts.push(`节点: ${context.nodeName}`);
    parts.push(`变更: ${context.changeSummary}`);
    return parts.join('\n');
  }

  /**
   * 根据上下文生成推荐理由
   */
  private getReasoningForContext(context: CollaborationNodeContext): string {
    const parts: string[] = [];

    parts.push(`变更由 ${context.requesterName} 发起`);
    parts.push(`节点类型: ${this.getNodeTypeLabel(context.nodeType)}`);

    if (context.requiresApproval) {
      parts.push('需要审批后才能继续');
    }

    if (context.hasConflictingChanges) {
      parts.push('检测到冲突变更，需要解决');
    }

    if (context.nodeType === 'blocking') {
      parts.push('此节点阻塞后续流程');
    }

    return parts.join('，') + '。';
  }

  /**
   * 获取节点类型标签
   */
  private getNodeTypeLabel(type: CollaborationNodeContext['nodeType']): string {
    const labels: Record<CollaborationNodeContext['nodeType'], string> = {
      approval: '审批',
      review: '审查',
      modification: '修改',
      blocking: '阻塞',
    };
    return labels[type] ?? type;
  }

  /**
   * 获取预计影响
   */
  private getEstimatedImpact(context: CollaborationNodeContext, action: string): string {
    switch (action) {
      case 'approve':
        return '协作链继续推进';
      case 'reject':
        return this.getDelayDescription(context);
      default:
        return '协作链继续推进';
    }
  }

  /**
   * 获取延迟描述
   */
  private getDelayDescription(context: CollaborationNodeContext): string {
    const delay = context.estimatedDelayIfRejected;
    if (delay <= 0) return '协作链中断';
    if (delay < 3600000) return `延迟 ${Math.round(delay / 60000)} 分钟`;
    if (delay < 86400000) return `延迟 ${Math.round(delay / 3600000)} 小时`;
    return `延迟 ${Math.round(delay / 86400000)} 天`;
  }

  /**
   * 获取风险等级
   */
  private getRiskLevel(
    context: CollaborationNodeContext,
    action: string
  ): 'low' | 'medium' | 'high' {
    // 批准的风险
    if (action === 'approve') {
      if (context.hasConflictingChanges) return 'high';
      if (context.nodeType === 'blocking') return 'medium';
      return 'low';
    }

    // 拒绝的风险
    if (action === 'reject') {
      if (context.nodeType === 'blocking') return 'high';
      if (context.estimatedDelayIfRejected > 24 * 3600000) return 'high';
      return 'medium';
    }

    return 'medium';
  }
}
