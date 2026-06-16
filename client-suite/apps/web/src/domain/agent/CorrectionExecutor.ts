/**
 * CorrectionExecutor — 纠偏执行引擎
 *
 * 接收 CorrectionPropagator 生成的 CorrectionPlan，
 * 批量应用 suggestedAction 到 tasks/goals/chains。
 * 纯域逻辑，不依赖外部基础设施。
 */

import type {
  CorrectionPlan,
  CorrectionAction,
} from './CorrectionPropagator';
import type { AgentTask } from './AgentTask';
import type { UserGoal } from './UserGoal';
import type { CollaborationChain } from './CollaborationChain';
import type { AgentTaskStatus } from '../shared/types';

export interface CorrectionResult {
  readonly planId: string;
  readonly tasksUpdated: number;
  readonly goalsUpdated: number;
  readonly chainsUpdated: number;
  readonly actions: CorrectionActionLog[];
}

export interface CorrectionActionLog {
  readonly entityType: 'task' | 'goal' | 'chain-node';
  readonly entityId: string;
  readonly action: CorrectionAction;
  readonly previousStatus: string;
  readonly newStatus: string;
}

const TASK_ACTION_MAP: Record<CorrectionAction, AgentTaskStatus> = {
  continue: 'running',
  're-evaluate': 'paused',
  pause: 'paused',
};

export class CorrectionExecutor {
  static applyToTask(
    task: AgentTask,
    action: CorrectionAction
  ): { task: AgentTask; log: CorrectionActionLog } {
    const _targetStatus = TASK_ACTION_MAP[action];
    const previousStatus = task.status;

    let updated = task;
    if (action === 'pause' || action === 're-evaluate') {
      if (task.status === 'running') {
        updated = task.withStatus('paused');
      }
    }

    return {
      task: updated,
      log: {
        entityType: 'task',
        entityId: task.id,
        action,
        previousStatus,
        newStatus: updated.status,
      },
    };
  }

  static applyToGoal(
    goal: UserGoal,
    action: CorrectionAction
  ): { goal: UserGoal; log: CorrectionActionLog } {
    const previousStatus = goal.status;
    let updated = goal;

    if (action === 'pause') {
      updated = goal.updateStatus('paused');
    } else if (action === 're-evaluate') {
      updated = goal.updateStatus('paused');
    }

    return {
      goal: updated,
      log: {
        entityType: 'goal',
        entityId: goal.id,
        action,
        previousStatus,
        newStatus: updated.status,
      },
    };
  }

  static applyToChainNode(
    chain: CollaborationChain,
    nodeId: string,
    action: CorrectionAction
  ): { chain: CollaborationChain; log: CorrectionActionLog } {
    const node = chain.nodes.find((n) => n.id === nodeId);
    const previousStatus = node?.status ?? 'unknown';

    let updated = chain;
    if (action === 'pause') {
      updated = chain.withNodeStatus(nodeId, 'pending');
    } else if (action === 're-evaluate') {
      updated = chain.withNodeStatus(nodeId, 'pending');
    }

    const updatedNode = updated.nodes.find((n) => n.id === nodeId);

    return {
      chain: updated,
      log: {
        entityType: 'chain-node',
        entityId: nodeId,
        action,
        previousStatus,
        newStatus: updatedNode?.status ?? previousStatus,
      },
    };
  }

  static execute(
    plan: CorrectionPlan,
    tasks: readonly AgentTask[],
    goals: readonly UserGoal[],
    chains: readonly CollaborationChain[]
  ): {
    result: CorrectionResult;
    updatedTasks: AgentTask[];
    updatedGoals: UserGoal[];
    updatedChains: CollaborationChain[];
  } {
    const actions: CorrectionActionLog[] = [];
    const updatedTasks = [...tasks];
    const updatedGoals = [...goals];
    const updatedChains = [...chains];

    for (const affected of plan.affectedTasks) {
      const idx = updatedTasks.findIndex((t) => t.id === affected.taskId);
      if (idx === -1) continue;
      const { task, log } = CorrectionExecutor.applyToTask(
        updatedTasks[idx],
        affected.suggestedAction
      );
      updatedTasks[idx] = task;
      actions.push(log);
    }

    for (const affected of plan.affectedGoals) {
      const idx = updatedGoals.findIndex((g) => g.id === affected.goalId);
      if (idx === -1) continue;
      const { goal, log } = CorrectionExecutor.applyToGoal(
        updatedGoals[idx],
        affected.suggestedAction
      );
      updatedGoals[idx] = goal;
      actions.push(log);
    }

    for (const affected of plan.affectedChainNodes) {
      const idx = updatedChains.findIndex((c) => c.id === affected.chainId);
      if (idx === -1) continue;
      const { chain, log } = CorrectionExecutor.applyToChainNode(
        updatedChains[idx],
        affected.nodeId,
        affected.suggestedAction
      );
      updatedChains[idx] = chain;
      actions.push(log);
    }

    return {
      result: {
        planId: plan.decisionId,
        tasksUpdated: plan.affectedTasks.length,
        goalsUpdated: plan.affectedGoals.length,
        chainsUpdated: plan.affectedChainNodes.length,
        actions,
      },
      updatedTasks,
      updatedGoals,
      updatedChains,
    };
  }
}
