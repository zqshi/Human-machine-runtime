import { DecisionRequest, type DecisionResponseStatus } from './DecisionRequest';
import type { AgentTask } from './AgentTask';
import type { UserGoal } from './UserGoal';
import type { CollaborationChain } from './CollaborationChain';

export type CorrectionAction = 'continue' | 're-evaluate' | 'pause';

export interface AffectedTask {
  taskId: string;
  taskName: string;
  suggestedAction: CorrectionAction;
}

export interface AffectedGoal {
  goalId: string;
  goalTitle: string;
  suggestedAction: CorrectionAction;
}

export interface AffectedChainNode {
  chainId: string;
  chainName: string;
  nodeId: string;
  suggestedAction: CorrectionAction;
}

export interface CorrectionPlan {
  decisionId: string;
  affectedTasks: AffectedTask[];
  affectedGoals: AffectedGoal[];
  affectedChainNodes: AffectedChainNode[];
}

const ACTION_MAP: Record<DecisionResponseStatus, CorrectionAction> = {
  accepted: 'continue',
  modified: 're-evaluate',
  declined: 'pause',
  deferred: 're-evaluate',
  expired: 'pause',
  pending: 'continue',
};

export class CorrectionPropagator {
  static computePlan(
    decision: DecisionRequest,
    tasks: readonly AgentTask[],
    goals: readonly UserGoal[],
    chains: readonly CollaborationChain[]
  ): CorrectionPlan {
    const action = ACTION_MAP[decision.responseStatus];
    const downstreamTaskIds = new Set(decision.downstreamTaskIds);

    const affectedTasks: AffectedTask[] = tasks
      .filter((t) => downstreamTaskIds.has(t.id))
      .map((t) => ({ taskId: t.id, taskName: t.name, suggestedAction: action }));

    const goalIdSet = new Set(decision.downstreamGoalIds);
    for (const goal of goals) {
      if (goalIdSet.has(goal.id)) continue;
      const hasOverlap = goal.relatedTaskIds.some((tid) => downstreamTaskIds.has(tid));
      if (hasOverlap) goalIdSet.add(goal.id);
    }

    const affectedGoals: AffectedGoal[] = goals
      .filter((g) => goalIdSet.has(g.id))
      .map((g) => ({ goalId: g.id, goalTitle: g.title, suggestedAction: action }));

    const affectedChainNodes: AffectedChainNode[] = [];
    for (const chain of chains) {
      if (chain.status !== 'running') continue;
      for (const node of chain.nodes) {
        if (node.agentId === decision.agentId && node.status !== 'completed') {
          affectedChainNodes.push({
            chainId: chain.id,
            chainName: chain.name,
            nodeId: node.id,
            suggestedAction: action,
          });
        }
      }
    }

    return {
      decisionId: decision.id,
      affectedTasks,
      affectedGoals,
      affectedChainNodes,
    };
  }
}
