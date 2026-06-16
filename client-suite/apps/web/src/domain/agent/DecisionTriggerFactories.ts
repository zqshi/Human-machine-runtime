/**
 * DecisionTriggerFactories — 决策触发器上下文接口 + 工厂函数
 *
 * 这些接口和工厂函数从 application/decision-triggers/ 提升到 domain 层，
 * 解除 domain → application 的反向依赖。
 * application 层的 Trigger Handler 实现类仍然留在 application 层。
 */

import type { DecisionTrigger } from './DecisionHub';

// ── 协作节点上下文 ──

export interface CollaborationNodeContext {
  collaborationId: string;
  collaborationName: string;
  nodeId: string;
  nodeName: string;
  requesterId: string;
  requesterName: string;
  nodeType: 'approval' | 'review' | 'modification' | 'blocking';
  changeSummary: string;
  requiresApproval: boolean;
  approvers: string[];
  currentApprover: string;
  estimatedDelayIfRejected: number; // 毫秒
  hasConflictingChanges: boolean;
}

// ── 里程碑上下文 ──

export interface MilestoneContext {
  goalId: string;
  goalTitle: string;
  milestoneId: string;
  milestoneName: string;
  milestoneIndex: number;
  totalMilestones: number;
  completedMilestones: number;
  hasBlockingIssue: boolean;
  estimatedTimeToComplete: number; // 毫秒
}

// ── 工厂函数 ──

const COLLABORATION_DEFAULT_DEADLINE = 30 * 60 * 1000; // 30 分钟
const MILESTONE_DEFAULT_DEADLINE = 2 * 60 * 60 * 1000; // 2 小时

export function createCollaborationTrigger(
  context: CollaborationNodeContext,
  extraData?: { taskId?: string; goalId?: string },
): DecisionTrigger {
  return {
    source: 'collaboration-node',
    sourceId: `${context.collaborationId}-${context.nodeId}`,
    title: `协作节点「${context.nodeName}」需要您的确认`,
    context: `${context.requesterName} 在协作链 ${context.collaborationName} 中请求您的决策\n变更: ${context.changeSummary}`,
    urgency: 'normal', // 由 handler.preprocess 重新计算
    deadline: Date.now() + COLLABORATION_DEFAULT_DEADLINE,
    relatedEntities: {
      collaborationId: context.collaborationId,
      taskId: extraData?.taskId,
      goalId: extraData?.goalId,
    },
  };
}

export function createMilestoneTrigger(
  context: MilestoneContext,
  extraData?: { taskId?: string; decisionId?: string },
): DecisionTrigger {
  const contextDescription =
    `目标 ${context.goalTitle} 的 ${context.milestoneName} 里程碑已达成` +
    (context.hasBlockingIssue ? '，但存在阻塞问题需要处理' : '') +
    `\n进度: ${context.completedMilestones}/${context.totalMilestones} (${Math.round((context.completedMilestones / context.totalMilestones) * 100)}%)`;

  return {
    source: 'milestone-arrival',
    sourceId: `${context.goalId}-${context.milestoneId}`,
    title: `${context.milestoneName} 里程碑完成 - 确认下一步`,
    context: contextDescription,
    urgency: 'normal', // 由 handler.preprocess 重新计算
    deadline: Date.now() + MILESTONE_DEFAULT_DEADLINE,
    relatedEntities: {
      goalId: context.goalId,
      taskId: extraData?.taskId,
      decisionId: extraData?.decisionId,
    },
  };
}
