/**
 * Decision domain 类型(从 agent-simulator-types.ts 迁出,独立化)。
 *
 * 这是 agent-core 的核心状态对象:描述一个"需要确认/执行"的决策点。
 * simulator 反模式删除后,Decision 仍由以下两条路径产生:
 *   - runtime-engine 的 projectDecision(真实消息 → 推荐投影为 pending 决策)
 *   - 未来其他业务路径直接构造
 *
 * domain 层零外部依赖:只声明类型与纯常量。
 */

export type Urgency = 'critical' | 'high' | 'normal' | 'low';
export type RiskLevel = 'low' | 'medium' | 'high';
export type DecisionResponseStatus = 'pending' | 'expired' | 'approved' | 'rejected';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  reasoning: string;
  estimatedImpact: string;
  riskLevel: RiskLevel;
}

export interface Decision {
  id: string;
  agentId: string;
  title: string;
  context: string;
  recommendation: DecisionOption;
  alternatives: DecisionOption[];
  urgency: Urgency;
  deadline: number;
  responseStatus: DecisionResponseStatus;
  userResponse: unknown;
  responseAt: number | null;
  createdAt: number;
  updatedAt: number;
  impactScope: number;
  downstreamTaskIds: string[];
  downstreamGoalIds: string[];
}

/**
 * Urgency → 决策截止时间(分钟)映射。
 *
 * projectDecision 用此常量在没有 suggestionedDeadline 时回填 deadline。
 * 原 simulator 的倒计时检测逻辑已删除,但 deadline 字段语义保留。
 */
export const URGENCY_DEADLINE_MINUTES: Record<Urgency, number> = {
  critical: 10,
  high: 20,
  normal: 60,
  low: 120,
};
