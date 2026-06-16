/**
 * CollaborationChain — 跨 Agent 协作链值对象
 *
 * 表示多个 Agent 之间的任务委托和数据传递链路。
 * 例：安全审计员发现漏洞 → 运维助手隔离服务 → 代码开发生成修复 PR
 */

import { DecisionHub, type DecisionTrigger } from './DecisionHub';
import {
  createCollaborationTrigger,
  type CollaborationNodeContext,
} from './DecisionTriggerFactories';

export type HandoffStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface ChainNode {
  id: string;
  agentId: string;
  agentName: string;
  agentCategory: string;
  taskSummary: string;
  status: HandoffStatus;
  startedAt: number;
  completedAt?: number;
  outputSummary?: string;
  /** 是否需要人工决策 */
  requiresDecision?: boolean;
  /** 需要审批的用户 ID 列表 */
  approvers?: string[];
  /** 当前审批人 */
  currentApprover?: string;
  /** 节点类型 */
  nodeType?: 'approval' | 'review' | 'modification' | 'blocking';
}

export interface ChainEdge {
  fromNodeId: string;
  toNodeId: string;
  label: string;
  dataPayload?: string;
}

export interface CollaborationChainProps {
  id: string;
  name: string;
  description: string;
  nodes: ChainNode[];
  edges: ChainEdge[];
  triggeredAt: number;
  status: 'running' | 'completed' | 'failed';
}

export class CollaborationChain {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nodes: readonly ChainNode[];
  readonly edges: readonly ChainEdge[];
  readonly triggeredAt: number;
  readonly status: 'running' | 'completed' | 'failed';

  private constructor(props: CollaborationChainProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.nodes = props.nodes;
    this.edges = props.edges;
    this.triggeredAt = props.triggeredAt;
    this.status = props.status;
  }

  static create(props: CollaborationChainProps): CollaborationChain {
    return new CollaborationChain(props);
  }

  get activeNode(): ChainNode | undefined {
    return this.nodes.find((n) => n.status === 'active');
  }

  get completedCount(): number {
    return this.nodes.filter((n) => n.status === 'completed').length;
  }

  get progress(): number {
    return Math.round((this.completedCount / this.nodes.length) * 100);
  }

  withNodeStatus(nodeId: string, status: HandoffStatus): CollaborationChain {
    const now = Date.now();
    return new CollaborationChain({
      ...this.toProps(),
      nodes: this.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, status, ...(status === 'completed' ? { completedAt: now } : {}) }
          : n
      ),
    });
  }

  withStatus(status: 'running' | 'completed' | 'failed'): CollaborationChain {
    return new CollaborationChain({ ...this.toProps(), status });
  }

  /**
   * 推进协作链中的节点，并在需要时触发决策请求
   */
  advanceNode(
    nodeId: string,
    userId: string,
    options?: {
      /** 是否强制触发决策（即使节点未标记 requiresDecision） */
      forceDecision?: boolean;
      /** 变更摘要 */
      changeSummary?: string;
      /** 是否有冲突变更 */
      hasConflictingChanges?: boolean;
    }
  ): CollaborationChain {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // 检查是否需要触发决策
    const needsDecision = node.requiresDecision || options?.forceDecision || false;
    const isApprover = node.approvers?.includes(userId);

    if (needsDecision && isApprover) {
      // 构建协作节点上下文
      const nodeContext: CollaborationNodeContext = {
        collaborationId: this.id,
        collaborationName: this.name,
        nodeId,
        nodeName: node.agentName,
        requesterId: node.agentId,
        requesterName: node.agentName,
        nodeType: node.nodeType ?? 'approval',
        changeSummary: options?.changeSummary ?? node.taskSummary,
        requiresApproval: node.requiresDecision ?? true,
        approvers: node.approvers ?? [userId],
        currentApprover: userId,
        estimatedDelayIfRejected: this.calculateEstimatedDelay(nodeId),
        hasConflictingChanges: options?.hasConflictingChanges ?? false,
      };

      // 创建决策触发器
      const trigger: DecisionTrigger = createCollaborationTrigger(nodeContext, {
        taskId: this.getRelatedTaskId(nodeId),
        goalId: this.getRelatedGoalId(nodeId),
      });

      // 异步触发决策请求
      DecisionHub.trigger(trigger).catch(() => {});
    }

    return this;
  }

  /**
   * 计算拒绝导致的预计延迟
   */
  private calculateEstimatedDelay(nodeId: string): number {
    // 计算该节点之后还有多少节点
    const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);
    const remainingNodes = this.nodes.slice(nodeIndex + 1);

    if (remainingNodes.length === 0) return 0;

    // 简单估算：每个节点平均 2 小时
    return remainingNodes.length * 2 * 60 * 60 * 1000;
  }

  /**
   * 获取节点关联的任务 ID
   */
  private getRelatedTaskId(nodeId: string): string | undefined {
    const edge = this.edges.find((e) => e.toNodeId === nodeId);
    return edge?.dataPayload;
  }

  /**
   * 获取节点关联的目标 ID
   */
  private getRelatedGoalId(_nodeId: string): string | undefined {
    // 暂时从其他地方获取
    return undefined;
  }

  private toProps(): CollaborationChainProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nodes: [...this.nodes],
      edges: [...this.edges],
      triggeredAt: this.triggeredAt,
      status: this.status,
    };
  }
}
