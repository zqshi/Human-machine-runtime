/**
 * RiskRuleTrigger — 风险规则决策触发器
 *
 * 当风险规则命中时触发决策请求，让用户决定如何处理。
 */

import type { DecisionTrigger, DecisionTriggerHandler } from '../../domain/agent/DecisionHub';
import type {
  RecommendationOption,
  DecisionUrgency,
  DecisionRequest,
} from '../../domain/agent/DecisionRequest';

/**
 * 风险等级映射
 */
const RISK_LEVEL_TO_URGENCY: Record<string, DecisionUrgency> = {
  critical: 'critical',
  high: 'high',
  medium: 'normal',
  low: 'low',
};

/**
 * 风险规则命中详情
 */
export interface RiskRuleHit {
  ruleId: string;
  ruleName: string;
  severity: string;
  action: string;
  matchSummary: string;
}

/**
 * RiskRuleTrigger — 风险规则决策触发器
 */
export class RiskRuleTrigger implements DecisionTriggerHandler {
  private static readonly URGENCY_DEADLINES: Record<DecisionUrgency, number> = {
    critical: 10 * 60 * 1000, // 10 分钟
    high: 30 * 60 * 1000, // 30 分钟
    normal: 2 * 60 * 60 * 1000, // 2 小时
    low: 4 * 60 * 60 * 1000, // 4 小时
  };

  /**
   * 预处理：评估 urgency、调整 deadline、生成推荐方案和备选方案
   */
  async preprocess(trigger: DecisionTrigger): Promise<DecisionTrigger> {
    // 从 trigger 中提取风险等级（通过 context 或额外属性）
    const riskLevel = this.extractRiskLevel(trigger);

    // 1. 计算 urgency
    const urgency = RISK_LEVEL_TO_URGENCY[riskLevel] ?? 'normal';

    // 2. 计算 deadline
    const deadline = Date.now() + this.getDeadlineForUrgency(urgency);

    // 3. 生成推荐方案和备选方案
    const { recommendation, alternatives } = this.generateRiskRecommendations(
      trigger,
      riskLevel,
      urgency
    );

    return {
      ...trigger,
      urgency,
      deadline,
      recommendation,
      alternatives,
      impactScope: urgency === 'critical' ? 8 : urgency === 'high' ? 4 : 2,
    };
  }

  /**
   * 后处理：决策创建后的额外操作
   */
  async postprocess(_decision: DecisionRequest): Promise<void> {
    // no-op: extensibility hook for future side-effects
  }

  /**
   * 从 trigger 中提取风险等级
   */
  private extractRiskLevel(trigger: DecisionTrigger): string {
    // 尝试从 context 中提取
    const severityMatch = trigger.context.match(/severity[:：]\s*(\w+)/i);
    if (severityMatch) {
      return severityMatch[1].toLowerCase();
    }

    // 默认中等风险
    return 'medium';
  }

  /**
   * 根据紧急度获取截止时间
   */
  private getDeadlineForUrgency(urgency: DecisionUrgency): number {
    return RiskRuleTrigger.URGENCY_DEADLINES[urgency] ?? 2 * 60 * 60 * 1000;
  }

  /**
   * 生成风险决策的推荐方案和备选方案
   */
  private generateRiskRecommendations(
    trigger: DecisionTrigger,
    riskLevel: string,
    _urgency: DecisionUrgency
  ): { recommendation: RecommendationOption; alternatives: RecommendationOption[] } {
    const baseRecommendation = {
      id: `rec-risk-${Date.now()}`,
      label: this.getLabelForRiskLevel(riskLevel),
      description: this.getDescriptionForRiskLevel(riskLevel),
      reasoning: `风险等级: ${riskLevel}，建议采取对应措施`,
      estimatedImpact: this.getImpactForRiskLevel(riskLevel),
      riskLevel: this.getRiskLevelForAction(riskLevel) as 'low' | 'medium' | 'high',
    };

    const alternatives: RecommendationOption[] = [
      {
        id: `alt-block-${Date.now()}-1`,
        label: '完全阻断',
        description: '拒绝当前操作，记录审计',
        reasoning: '高风险操作，建议阻断',
        estimatedImpact: '操作被阻止',
        riskLevel: 'low',
      },
      {
        id: `alt-review-${Date.now()}-2`,
        label: '人工复核',
        description: '暂缓操作，等待人工审查',
        reasoning: '需要人工评估具体场景',
        estimatedImpact: '延迟 15-30 分钟',
        riskLevel: 'medium',
      },
    ];

    // 根据风险等级调整备选方案
    if (riskLevel === 'low') {
      alternatives.push({
        id: `alt-allow-${Date.now()}-3`,
        label: '允许通过',
        description: '允许操作继续执行',
        reasoning: '低风险操作，可安全通过',
        estimatedImpact: '操作继续',
        riskLevel: 'low',
      });
    }

    return {
      recommendation: baseRecommendation,
      alternatives,
    };
  }

  /**
   * 根据风险等级获取操作标签
   */
  private getLabelForRiskLevel(riskLevel: string): string {
    const labels: Record<string, string> = {
      critical: '立即阻断操作',
      high: '阻断并通知',
      medium: '路由到安全模型',
      low: '记录并允许',
    };
    return labels[riskLevel] ?? '记录并允许';
  }

  /**
   * 根据风险等级获取操作描述
   */
  private getDescriptionForRiskLevel(riskLevel: string): string {
    const descriptions: Record<string, string> = {
      critical: '检测到严重安全威胁，立即阻断操作并通知相关人员',
      high: '检测到高风险内容，阻断操作并通知安全团队',
      medium: '检测到敏感内容，路由到安全模型进一步评估',
      low: '检测到潜在敏感内容，记录日志后允许通过',
    };
    return descriptions[riskLevel] ?? '记录日志后允许通过';
  }

  /**
   * 根据风险等级获取影响描述
   */
  private getImpactForRiskLevel(riskLevel: string): string {
    const impacts: Record<string, string> = {
      critical: '操作被阻止，系统安全得到保护',
      high: '操作被阻止，可能需要人工介入',
      medium: '操作延迟 10-30 秒，安全模型评估',
      low: '操作正常，增加审计记录',
    };
    return impacts[riskLevel] ?? '操作正常';
  }

  /**
   * 根据风险等级获取操作的风险等级
   */
  private getRiskLevelForAction(riskLevel: string): string {
    // 阻断操作本身风险最低，允许通过风险较高
    if (riskLevel === 'critical' || riskLevel === 'high') return 'low';
    if (riskLevel === 'medium') return 'medium';
    return 'low';
  }

  /**
   * 从风险规则命中创建 DecisionTrigger
   */
  static createFromRiskHit(
    hit: RiskRuleHit,
    extraData?: {
      taskId?: string;
      traceId?: string;
      userId?: string;
    }
  ): DecisionTrigger {
    // 将额外信息包含在 context 中
    const contextWithExtras =
      `检测到敏感内容: ${hit.matchSummary}\n规则: ${hit.ruleName}\n严重程度: ${hit.severity}` +
      (extraData?.userId ? `\n用户: ${extraData.userId}` : '');

    return {
      source: 'risk-rule-trigger',
      sourceId: hit.ruleId,
      title: `风险规则「${hit.ruleName}」命中`,
      context: contextWithExtras,
      urgency: RISK_LEVEL_TO_URGENCY[hit.severity] ?? 'normal',
      deadline:
        Date.now() +
        RiskRuleTrigger.URGENCY_DEADLINES[RISK_LEVEL_TO_URGENCY[hit.severity] ?? 'normal'],
      relatedEntities: {
        traceId: extraData?.traceId,
        taskId: extraData?.taskId,
      },
    };
  }
}
