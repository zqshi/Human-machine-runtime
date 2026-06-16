/**
 * UserGoal — 用户目标实体（契约化模型）
 *
 * 目标 = 意图 + 约束 + 授权 + 成功标准 + 里程碑。
 * Agent 在约束和授权范围内自主推进，超出边界时升维到人类决策。
 *
 * @deprecated 逐步迁移到 domain/objective/ 子域的三层目标体系：
 * - L0: StrategicObjective（战略方向）
 * - L1: JudgmentObjective（关键判断）
 * - L2: ExecutionObjective（执行目标）
 */

import { DecisionHub, type DecisionTrigger } from './DecisionHub';
import { createMilestoneTrigger, type MilestoneContext } from './DecisionTriggerFactories';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived' | 'cancelled';
export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';
export type MilestoneStatus = 'pending' | 'active' | 'completed';

export interface GoalMilestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  completedAt?: number;
  relatedTaskIds: string[];
}

export interface GoalProgressUpdate {
  timestamp: number;
  agentId: string;
  message: string;
  milestoneId?: string;
}

// ─── 契约化新增类型 ─────────────────────────────────────────────────

export type ConstraintType = 'budget' | 'timeline' | 'compliance' | 'quality' | 'custom';

export interface GoalConstraint {
  id: string;
  type: ConstraintType;
  description: string;
  threshold?: string;
  hardLimit: boolean;
}

export interface GoalAuthorization {
  autoExecute: string[];
  requireOwner: string[];
  requireCollaborator: { action: string; collaboratorRole: string }[];
}

export interface GoalSuccessCriteria {
  id: string;
  metric: string;
  target: string;
  measureMethod: string;
  currentValue?: string;
}

// ─── Props ──────────────────────────────────────────────────────────

export interface UserGoalProps {
  id: string;
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  deadline?: number;
  milestones: GoalMilestone[];
  progressUpdates: GoalProgressUpdate[];
  relatedTaskIds: string[];
  relatedDecisionIds: string[];
  createdAt: number;
  updatedAt: number;
  // 契约化字段（可选，向后兼容）
  intent?: string;
  constraints?: GoalConstraint[];
  authorization?: GoalAuthorization;
  successCriteria?: GoalSuccessCriteria[];
  ownerId?: string;
  collaboratorIds?: string[];
  parentGoalId?: string;
  decompositionStrategy?: string;
}

export class UserGoal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: GoalPriority;
  readonly status: GoalStatus;
  readonly deadline?: number;
  readonly milestones: GoalMilestone[];
  readonly progressUpdates: GoalProgressUpdate[];
  readonly relatedTaskIds: string[];
  readonly relatedDecisionIds: string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly intent: string;
  readonly constraints: GoalConstraint[];
  readonly authorization: GoalAuthorization;
  readonly successCriteria: GoalSuccessCriteria[];
  readonly ownerId: string;
  readonly collaboratorIds: string[];
  readonly parentGoalId?: string;
  readonly decompositionStrategy?: string;

  private static readonly DEFAULT_AUTH: GoalAuthorization = {
    autoExecute: [],
    requireOwner: [],
    requireCollaborator: [],
  };

  private constructor(props: UserGoalProps) {
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.priority = props.priority;
    this.status = props.status;
    this.deadline = props.deadline;
    this.milestones = props.milestones;
    this.progressUpdates = props.progressUpdates;
    this.relatedTaskIds = props.relatedTaskIds;
    this.relatedDecisionIds = props.relatedDecisionIds;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.intent = props.intent ?? '';
    this.constraints = props.constraints ?? [];
    this.authorization = props.authorization ?? UserGoal.DEFAULT_AUTH;
    this.successCriteria = props.successCriteria ?? [];
    this.ownerId = props.ownerId ?? '';
    this.collaboratorIds = props.collaboratorIds ?? [];
    this.parentGoalId = props.parentGoalId;
    this.decompositionStrategy = props.decompositionStrategy;
  }

  static create(props: UserGoalProps): UserGoal {
    return new UserGoal(props);
  }

  addProgressUpdate(agentId: string, message: string, milestoneId?: string): UserGoal {
    const update: GoalProgressUpdate = {
      timestamp: Date.now(),
      agentId,
      message,
      milestoneId,
    };
    return new UserGoal({
      ...this.toProps(),
      progressUpdates: [...this.progressUpdates, update],
      updatedAt: Date.now(),
    });
  }

  completeMilestone(
    milestoneId: string,
    options?: {
      /** 是否触发决策请求 */
      triggerDecision?: boolean;
      /** 是否有阻塞问题 */
      hasBlockingIssue?: boolean;
      /** 预计剩余时间（毫秒） */
      estimatedTimeToComplete?: number;
    }
  ): UserGoal {
    const updatedMilestones = this.milestones.map((m) =>
      m.id === milestoneId ? { ...m, status: 'completed' as const, completedAt: Date.now() } : m
    );
    // Auto-activate next pending milestone
    const completedIdx = updatedMilestones.findIndex((m) => m.id === milestoneId);
    if (completedIdx >= 0) {
      const next = updatedMilestones.find((m, i) => i > completedIdx && m.status === 'pending');
      if (next) {
        const nextIdx = updatedMilestones.indexOf(next);
        updatedMilestones[nextIdx] = { ...updatedMilestones[nextIdx], status: 'active' };
      }
    }
    // Auto-complete goal if all milestones done
    const allDone = updatedMilestones.every((m) => m.status === 'completed');
    const newStatus = allDone ? 'completed' : this.status;

    const updatedGoal = new UserGoal({
      ...this.toProps(),
      milestones: updatedMilestones,
      status: newStatus,
      updatedAt: Date.now(),
    });

    // 触发决策请求（如果启用）
    if (options?.triggerDecision && DecisionHub.hasHandler('milestone-arrival')) {
      const completedCount = updatedMilestones.filter((m) => m.status === 'completed').length;
      const completedMilestone = updatedMilestones[completedIdx];

      // 构建里程碑上下文
      const milestoneContext: MilestoneContext = {
        goalId: this.id,
        goalTitle: this.title,
        milestoneId: milestoneId,
        milestoneName: completedMilestone?.name ?? milestoneId,
        milestoneIndex: completedIdx,
        totalMilestones: this.milestones.length,
        completedMilestones: completedCount,
        hasBlockingIssue: options.hasBlockingIssue ?? false,
        estimatedTimeToComplete: options.estimatedTimeToComplete ?? 0,
      };

      // 创建决策触发器
      const trigger: DecisionTrigger = createMilestoneTrigger(milestoneContext, {
        taskId: this.relatedTaskIds[0],
      });

      // 异步触发决策请求
      DecisionHub.trigger(trigger).catch(() => {});
    }

    return updatedGoal;
  }

  updateStatus(status: GoalStatus): UserGoal {
    return new UserGoal({
      ...this.toProps(),
      status,
      updatedAt: Date.now(),
    });
  }

  linkTask(taskId: string): UserGoal {
    if (this.relatedTaskIds.includes(taskId)) return this;
    return new UserGoal({
      ...this.toProps(),
      relatedTaskIds: [...this.relatedTaskIds, taskId],
      updatedAt: Date.now(),
    });
  }

  linkDecision(decisionId: string): UserGoal {
    if (this.relatedDecisionIds.includes(decisionId)) return this;
    return new UserGoal({
      ...this.toProps(),
      relatedDecisionIds: [...this.relatedDecisionIds, decisionId],
      updatedAt: Date.now(),
    });
  }

  get overallProgress(): number {
    if (this.milestones.length === 0) return 0;
    const completed = this.milestones.filter((m) => m.status === 'completed').length;
    return Math.round((completed / this.milestones.length) * 100);
  }

  get isOverdue(): boolean {
    if (!this.deadline) return false;
    return Date.now() > this.deadline && this.status === 'active';
  }

  get activeMilestone(): GoalMilestone | null {
    return this.milestones.find((m) => m.status === 'active') ?? null;
  }

  // ─── 契约化方法 ───────────────────────────────────────────────────

  addConstraint(constraint: GoalConstraint): UserGoal {
    if (this.constraints.some((c) => c.id === constraint.id)) return this;
    return new UserGoal({
      ...this.toProps(),
      constraints: [...this.constraints, constraint],
      updatedAt: Date.now(),
    });
  }

  removeConstraint(constraintId: string): UserGoal {
    return new UserGoal({
      ...this.toProps(),
      constraints: this.constraints.filter((c) => c.id !== constraintId),
      updatedAt: Date.now(),
    });
  }

  updateAuthorization(auth: Partial<GoalAuthorization>): UserGoal {
    return new UserGoal({
      ...this.toProps(),
      authorization: { ...this.authorization, ...auth },
      updatedAt: Date.now(),
    });
  }

  addSuccessCriteria(criteria: GoalSuccessCriteria): UserGoal {
    if (this.successCriteria.some((c) => c.id === criteria.id)) return this;
    return new UserGoal({
      ...this.toProps(),
      successCriteria: [...this.successCriteria, criteria],
      updatedAt: Date.now(),
    });
  }

  updateSuccessCriteriaValue(criteriaId: string, currentValue: string): UserGoal {
    return new UserGoal({
      ...this.toProps(),
      successCriteria: this.successCriteria.map((c) =>
        c.id === criteriaId ? { ...c, currentValue } : c
      ),
      updatedAt: Date.now(),
    });
  }

  addCollaborator(userId: string): UserGoal {
    if (this.collaboratorIds.includes(userId)) return this;
    return new UserGoal({
      ...this.toProps(),
      collaboratorIds: [...this.collaboratorIds, userId],
      updatedAt: Date.now(),
    });
  }

  removeCollaborator(userId: string): UserGoal {
    return new UserGoal({
      ...this.toProps(),
      collaboratorIds: this.collaboratorIds.filter((id) => id !== userId),
      updatedAt: Date.now(),
    });
  }

  isActionAuthorized(action: string): 'auto' | 'owner' | 'collaborator' {
    if (this.authorization.autoExecute.some((a) => action.includes(a))) return 'auto';
    if (this.authorization.requireOwner.some((a) => action.includes(a))) return 'owner';
    if (this.authorization.requireCollaborator.some((r) => action.includes(r.action)))
      return 'collaborator';
    return 'owner';
  }

  get violatedConstraints(): GoalConstraint[] {
    return this.constraints.filter((c) => c.hardLimit && c.threshold);
  }

  toProps(): UserGoalProps {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      priority: this.priority,
      status: this.status,
      deadline: this.deadline,
      milestones: this.milestones,
      progressUpdates: this.progressUpdates,
      relatedTaskIds: this.relatedTaskIds,
      relatedDecisionIds: this.relatedDecisionIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      intent: this.intent,
      constraints: this.constraints,
      authorization: this.authorization,
      successCriteria: this.successCriteria,
      ownerId: this.ownerId,
      collaboratorIds: this.collaboratorIds,
      parentGoalId: this.parentGoalId,
      decompositionStrategy: this.decompositionStrategy,
    };
  }
}
