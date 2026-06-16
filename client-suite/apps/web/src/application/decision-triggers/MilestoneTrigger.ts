/**
 * MilestoneTrigger — 里程碑决策触发器
 *
 * 当目标里程碑完成时触发决策请求，让用户确认下一步行动。
 */

import type { DecisionTrigger, DecisionTriggerHandler } from '../../domain/agent/DecisionHub';
import type {
  RecommendationOption,
  DecisionRequest,
} from '../../domain/agent/DecisionRequest';
import type { MilestoneContext } from '../../domain/agent/DecisionTriggerFactories';
export type { MilestoneContext } from '../../domain/agent/DecisionTriggerFactories';

/**
 * MilestoneTrigger — 里程碑决策触发器
 */
export class MilestoneTrigger implements DecisionTriggerHandler {
  private static readonly DEFAULT_DEADLINE = 2 * 60 * 60 * 1000; // 2 小时
  private static readonly URGENCY_DEADLINES: Record<string, number> = {
    critical: 30 * 60 * 1000, // 30 分钟
    high: 60 * 60 * 1000, // 1 小时
    normal: 2 * 60 * 60 * 1000, // 2 小时
    low: 4 * 60 * 60 * 1000, // 4 小时
  };

  /**
   * 预处理：评估 urgency、调整 deadline、生成推荐方案
   */
  async preprocess(trigger: DecisionTrigger): Promise<DecisionTrigger> {
    // 从 trigger 中提取里程碑上下文
    const milestoneContext = this.extractMilestoneContext(trigger);

    // 1. 计算 urgency
    const urgency = this.calculateUrgency(milestoneContext);

    // 2. 计算 deadline
    const deadline = Date.now() + this.getDeadlineForUrgency(urgency);

    // 3. 生成推荐方案和备选方案
    const { recommendation, alternatives } = this.generateMilestoneRecommendations(
      trigger,
      milestoneContext,
      urgency
    );

    return {
      ...trigger,
      urgency,
      deadline,
      recommendation,
      alternatives,
      impactScope: 3,
      downstreamGoalIds: trigger.relatedEntities.goalId ? [trigger.relatedEntities.goalId] : [],
    };
  }

  /**
   * 后处理：决策创建后的额外操作
   */
  async postprocess(_decision: DecisionRequest): Promise<void> {
    // no-op: extensibility hook for future side-effects
  }

  /**
   * 从 trigger 中提取里程碑上下文
   */
  private extractMilestoneContext(trigger: DecisionTrigger): MilestoneContext {
    const extra = (trigger as unknown as { extra?: Record<string, unknown> }).extra ?? {};

    return {
      goalId: String(extra?.goalId ?? ''),
      goalTitle: String(extra?.goalTitle ?? '未知目标'),
      milestoneId: String(extra?.milestoneId ?? ''),
      milestoneName: String(extra?.milestoneName ?? '未知里程碑'),
      milestoneIndex: Number(extra?.milestoneIndex ?? 0),
      totalMilestones: Number(extra?.totalMilestones ?? 1),
      completedMilestones: Number(extra?.completedMilestones ?? 0),
      hasBlockingIssue: Boolean(extra?.hasBlockingIssue),
      estimatedTimeToComplete: Number(extra?.estimatedTimeToComplete ?? 0),
    };
  }

  /**
   * 计算紧急度
   */
  private calculateUrgency(context: MilestoneContext): 'critical' | 'high' | 'normal' | 'low' {
    // 1. 有阻塞问题，紧急度高
    if (context.hasBlockingIssue) {
      return 'critical';
    }

    // 2. 剩余里程碑少，需要及时决策
    const remainingMilestones = context.totalMilestones - context.completedMilestones;
    if (remainingMilestones <= 2) {
      return 'high';
    }

    // 3. 根据整体进度判断
    const progressRatio = context.completedMilestones / context.totalMilestones;
    if (progressRatio >= 0.7) {
      return 'normal';
    }

    return 'normal';
  }

  /**
   * 根据紧急度获取截止时间
   */
  private getDeadlineForUrgency(urgency: string): number {
    return MilestoneTrigger.URGENCY_DEADLINES[urgency] ?? MilestoneTrigger.DEFAULT_DEADLINE;
  }

  /**
   * 生成里程碑决策的推荐方案和备选方案
   */
  private generateMilestoneRecommendations(
    trigger: DecisionTrigger,
    context: MilestoneContext,
    _urgency: string
  ): { recommendation: RecommendationOption; alternatives: RecommendationOption[] } {
    const isLastMilestone = context.completedMilestones === context.totalMilestones;

    const baseRecommendation: RecommendationOption = {
      id: `rec-milestone-${Date.now()}`,
      label: isLastMilestone ? '确认目标完成' : '继续下一个里程碑',
      description: isLastMilestone
        ? `确认目标「${context.goalTitle}」已完成，进行归档`
        : `确认里程碑「${context.milestoneName}」已完成，继续推进项目`,
      reasoning: this.getReasoningForContext(context, isLastMilestone),
      estimatedImpact: isLastMilestone ? '目标完成，资源释放' : '按计划完成整体目标',
      riskLevel: context.hasBlockingIssue ? 'medium' : 'low',
    };

    const alternatives: RecommendationOption[] = [];

    // 备选 1：暂停并复盘
    alternatives.push({
      id: `alt-review-${Date.now()}-1`,
      label: '暂停并复盘',
      description: '暂停项目进行复盘和调整',
      reasoning: '回顾当前进展，优化后续计划',
      estimatedImpact: '延迟 1-2 天',
      riskLevel: 'medium',
    });

    // 备选 2：调整目标
    if (!isLastMilestone) {
      alternatives.push({
        id: `alt-adjust-${Date.now()}-2`,
        label: '调整目标方向',
        description: '根据新发现调整项目目标',
        reasoning: '有新的信息需要纳入考虑',
        estimatedImpact: '需重新规划',
        riskLevel: 'high',
      });
    }

    // 备选 3：跳过当前问题（仅在有阻塞问题时显示）
    if (context.hasBlockingIssue) {
      alternatives.push({
        id: `alt-skip-${Date.now()}-3`,
        label: '记录问题，继续执行',
        description: '记录当前问题，暂时跳过继续执行',
        reasoning: '问题不影响核心路径，可后续处理',
        estimatedImpact: '继续推进，问题待解决',
        riskLevel: 'high',
      });
    }

    // 备选 4：添加新里程碑（仅在非最后里程碑时显示）
    if (!isLastMilestone && context.milestoneIndex < context.totalMilestones - 2) {
      alternatives.push({
        id: `alt-add-${Date.now()}-4`,
        label: '添加中间里程碑',
        description: '在当前里程碑和下一个之间添加新的检查点',
        reasoning: '当前阶段复杂，建议增加检查点',
        estimatedImpact: '延长项目周期',
        riskLevel: 'low',
      });
    }

    return {
      recommendation: baseRecommendation,
      alternatives,
    };
  }

  /**
   * 根据上下文生成推荐理由
   */
  private getReasoningForContext(context: MilestoneContext, isLastMilestone: boolean): string {
    const parts: string[] = [];

    if (isLastMilestone) {
      parts.push('所有里程碑已完成');
      parts.push(`目标「${context.goalTitle}」达成`);
    } else {
      parts.push(`已完成 ${context.completedMilestones}/${context.totalMilestones} 个里程碑`);
      parts.push(
        `进度: ${Math.round((context.completedMilestones / context.totalMilestones) * 100)}%`
      );

      if (context.estimatedTimeToComplete > 0) {
        const hours = Math.round(context.estimatedTimeToComplete / 3600000);
        parts.push(`预计剩余时间: ${hours} 小时`);
      }
    }

    if (context.hasBlockingIssue) {
      parts.push('存在阻塞问题，需要确认处理方式');
    } else {
      parts.push('无阻塞项，可以按计划推进');
    }

    return parts.join('，') + '。';
  }
}
