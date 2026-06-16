/**
 * DecisionTree — 因果决策树值对象
 *
 * 每条自主行为（ProactiveActivity）的因果链：
 * trigger → reasoning → action → outcome
 * + 用户可执行的后续操作
 */

export type DecisionNodeType = 'trigger' | 'reasoning' | 'action' | 'outcome';
export type DecisionNodeStatus = 'completed' | 'active' | 'pending';

export interface DecisionNode {
  id: string;
  type: DecisionNodeType;
  label: string;
  detail: string;
  status: DecisionNodeStatus;
  metadata?: Record<string, string>;
}

export interface UserFollowUpAction {
  id: string;
  label: string;
  icon: string;
  actionType: 'approve' | 'reject' | 'modify' | 'escalate' | 'dismiss';
}

export interface DecisionTreeProps {
  activityId: string;
  nodes: DecisionNode[];
  followUpActions: UserFollowUpAction[];
  confidence: number;
}

export class DecisionTree {
  readonly activityId: string;
  readonly nodes: readonly DecisionNode[];
  readonly followUpActions: readonly UserFollowUpAction[];
  readonly confidence: number;

  private constructor(props: DecisionTreeProps) {
    this.activityId = props.activityId;
    this.nodes = props.nodes;
    this.followUpActions = props.followUpActions;
    this.confidence = props.confidence;
  }

  static create(props: DecisionTreeProps): DecisionTree {
    return new DecisionTree(props);
  }

  get trigger(): DecisionNode | undefined {
    return this.nodes.find((n) => n.type === 'trigger');
  }

  get outcome(): DecisionNode | undefined {
    return this.nodes.find((n) => n.type === 'outcome');
  }

  get isFullyResolved(): boolean {
    return this.nodes.every((n) => n.status === 'completed');
  }
}
