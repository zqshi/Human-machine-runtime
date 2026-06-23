/**
 * projectDecision — 把「归一化消息 + 推荐」投影为待确认的 Decision。
 *
 * runtime-engine 产出的高优消息经 RecommendationEngine 生成推荐后，
 * 由本纯函数落成 Decision（responseStatus='pending'），供人工确认或 Agent 兜底执行。
 * 这是「消息 → 决策」运行时链路的核心：把无结构的告警/审批/指令消息，
 * 转成结构化的、带截止时间与授权语义的决策点。
 *
 * 纯函数：时间由调用方注入 now，便于测试与幂等重放。
 */

import { newId } from '../../shared/utils.js';
import type { NormalizedMessage, MessageIntent } from './message-normalizer.js';
import type { Recommendation } from './recommendation-engine.js';
import type { Decision, DecisionOption, RiskLevel } from '../agent-core/session/domain/decision.js';
import { URGENCY_DEADLINE_MINUTES } from '../agent-core/session/domain/decision.js';

export interface ProjectDecisionInput {
  message: NormalizedMessage;
  recommendation: Recommendation;
}

/** intent → 责任 Agent 映射（用于决策路由） */
const INTENT_AGENT: Record<MessageIntent, string> = {
  alert: 'security-agent',
  approval: 'approval-agent',
  command: 'ops-assistant',
  report: 'data-analyst',
  inquiry: 'assistant',
  chat: 'assistant',
};

function urgencyToRisk(urgency: NormalizedMessage['urgency']): RiskLevel {
  if (urgency === 'critical') return 'high';
  if (urgency === 'high') return 'medium';
  return 'low';
}

export function projectDecision(input: ProjectDecisionInput, now: number): Decision {
  const { message, recommendation } = input;

  const deadline = recommendation.suggestedDeadline
    ? recommendation.suggestedDeadline.getTime()
    : now + URGENCY_DEADLINE_MINUTES[message.urgency] * 60_000;

  const primary: DecisionOption = {
    id: newId('opt'),
    label: recommendation.action,
    description: recommendation.reasoning,
    reasoning: recommendation.reasoning,
    estimatedImpact: impactLabel(recommendation.estimatedImpact),
    riskLevel: urgencyToRisk(message.urgency),
  };

  const alternatives: DecisionOption[] = recommendation.alternatives.map((alt) => ({
    id: newId('alt'),
    label: alt.action,
    description: alt.tradeoff,
    reasoning: alt.tradeoff,
    estimatedImpact: '恢复时间较长但风险可控',
    riskLevel: urgencyToRisk(message.urgency),
  }));

  return {
    id: newId('dec'),
    agentId: INTENT_AGENT[message.intent] ?? 'assistant',
    title: recommendation.action,
    context: message.body,
    recommendation: primary,
    alternatives,
    urgency: message.urgency,
    deadline,
    responseStatus: 'pending',
    userResponse: null,
    responseAt: null,
    createdAt: now,
    updatedAt: now,
    impactScope: 1,
    downstreamTaskIds: [],
    downstreamGoalIds: [],
  };
}

function impactLabel(impact: Recommendation['estimatedImpact']): string {
  if (impact === 'high') return '预计快速恢复，影响面大';
  if (impact === 'medium') return '中等影响';
  return '影响较小';
}
