/**
 * SignalAggregator — 跨来源信号聚合器
 *
 * 将异构的 DecisionRequest、AgentTask 异常、UserGoal 告警、
 * 通知等统一转换为 Signal 值对象，便于统一排序和推送。
 */

import { Signal, type SignalUrgency, type SignalProps } from './Signal';
import type { DecisionRequest } from './DecisionRequest';
import type { AgentTask } from './AgentTask';
import type { UserGoal } from './UserGoal';

export class SignalAggregator {
  static fromDecisionRequest(dr: DecisionRequest): Signal {
    return Signal.create({
      id: `sig-dr-${dr.id}`,
      source: 'decision',
      urgency: dr.urgency,
      status: dr.isPending ? 'active' : 'resolved',
      deadline: dr.deadline,
      impactScope: dr.impactScope,
      payload: {
        entityId: dr.id,
        entityType: 'DecisionRequest',
        title: dr.title,
        detail: dr.context,
      },
      agentId: dr.agentId,
      createdAt: dr.createdAt,
    });
  }

  static fromTaskException(task: AgentTask, reason: string): Signal {
    return Signal.create({
      id: `sig-task-${task.id}-${Date.now()}`,
      source: 'task-exception',
      urgency: 'high',
      status: 'active',
      deadline: Date.now() + 3600_000,
      impactScope: 1,
      payload: {
        entityId: task.id,
        entityType: 'AgentTask',
        title: `任务异常: ${task.name}`,
        detail: reason,
      },
      agentId: task.agentId,
      createdAt: Date.now(),
    });
  }

  static fromGoalOverdue(goal: UserGoal): Signal {
    return Signal.create({
      id: `sig-goal-${goal.id}`,
      source: 'goal-alert',
      urgency: goal.priority === 'critical' ? 'critical' : 'high',
      status: 'active',
      deadline: goal.deadline ?? Date.now() + 86400_000,
      impactScope: goal.relatedTaskIds.length,
      payload: {
        entityId: goal.id,
        entityType: 'UserGoal',
        title: `目标逾期: ${goal.title}`,
        detail: `当前进度 ${goal.overallProgress}%`,
      },
      agentId: goal.ownerId,
      createdAt: Date.now(),
    });
  }

  static fromNotification(notification: {
    id: string;
    title: string;
    detail?: string;
    urgency?: SignalUrgency;
    agentId?: string;
    createdAt?: number;
  }): Signal {
    return Signal.create({
      id: `sig-notif-${notification.id}`,
      source: 'notification',
      urgency: notification.urgency ?? 'normal',
      status: 'active',
      deadline: Date.now() + 86400_000,
      impactScope: 0,
      payload: {
        entityId: notification.id,
        entityType: 'Notification',
        title: notification.title,
        detail: notification.detail,
      },
      agentId: notification.agentId,
      createdAt: notification.createdAt ?? Date.now(),
    });
  }

  static aggregate(inputs: {
    decisions?: readonly DecisionRequest[];
    failedTasks?: readonly { task: AgentTask; reason: string }[];
    overdueGoals?: readonly UserGoal[];
    notifications?: readonly {
      id: string;
      title: string;
      detail?: string;
      urgency?: SignalUrgency;
      agentId?: string;
      createdAt?: number;
    }[];
  }): Signal[] {
    const signals: Signal[] = [];

    if (inputs.decisions) {
      for (const dr of inputs.decisions) {
        if (dr.isPending) signals.push(SignalAggregator.fromDecisionRequest(dr));
      }
    }

    if (inputs.failedTasks) {
      for (const { task, reason } of inputs.failedTasks) {
        signals.push(SignalAggregator.fromTaskException(task, reason));
      }
    }

    if (inputs.overdueGoals) {
      for (const goal of inputs.overdueGoals) {
        signals.push(SignalAggregator.fromGoalOverdue(goal));
      }
    }

    if (inputs.notifications) {
      for (const notif of inputs.notifications) {
        signals.push(SignalAggregator.fromNotification(notif));
      }
    }

    return signals;
  }

  static fromRaw(props: SignalProps): Signal {
    return Signal.create(props);
  }
}
