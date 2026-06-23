import type { NormalizedMessage } from './message-normalizer.js';
import { buildPrompt, parseLlmResponse } from './recommendation-prompt.js';

export interface DecisionContext {
  triggeredBy: NormalizedMessage;
  relatedMessages: NormalizedMessage[];
  historicalDecisions: HistoricalDecision[];
  dataPoints: DataPoint[];
}

/**
 * LLM 客户端抽象(与 agent-core 的 ILLMClient 结构兼容,避免跨上下文依赖)。
 * - chatCompletion: 返回模型响应文本,不可用或失败返回 null
 */
export interface RecommendationLlmClient {
  readonly isAvailable: boolean;
  chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ content: string | null } | null>;
}

/** 历史决策提供者:由调用方注入(避免 runtime-engine 反向依赖 agent-core) */
export type RecentDecisionsProvider = () => Promise<HistoricalDecision[]>;

export interface HistoricalDecision {
  id: string;
  summary: string;
  outcome: 'accepted' | 'rejected' | 'modified';
  decidedAt: Date;
  similarity: number;
}

export interface DataPoint {
  source: string;
  label: string;
  value: string | number;
  confidence: number;
}

export interface Recommendation {
  id: string;
  action: string;
  confidence: number;
  reasoning: string;
  risks: string[];
  alternatives: AlternativeAction[];
  estimatedImpact: 'high' | 'medium' | 'low';
  suggestedDeadline?: Date;
}

export interface AlternativeAction {
  action: string;
  tradeoff: string;
}

export interface RecommendationResult {
  messageId: string;
  recommendations: Recommendation[];
  contextUsed: string[];
  generatedAt: Date;
}

export class RecommendationEngine {
  private decisionHistory: HistoricalDecision[] = [];

  constructor(
    private readonly llmClient?: RecommendationLlmClient | null,
    private readonly recentDecisionsProvider?: RecentDecisionsProvider | null
  ) {}

  addDecisionRecord(decision: HistoricalDecision): void {
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-500);
    }
  }

  async generateRecommendations(ctx: DecisionContext): Promise<RecommendationResult> {
    // 若 LLM 可用,优先走 LLM 路径(规则匹配作为降级)
    if (this.llmClient?.isAvailable) {
      const llmResult = await this.generateWithLlm(ctx);
      if (llmResult) return llmResult;
    }

    return this.generateWithRules(ctx);
  }

  private async generateWithLlm(ctx: DecisionContext): Promise<RecommendationResult | null> {
    // 若 ctx 未传 historicalDecisions,从 provider 取
    let historical = ctx.historicalDecisions;
    if (historical.length === 0 && this.recentDecisionsProvider) {
      try {
        historical = await this.recentDecisionsProvider();
      } catch {
        historical = [];
      }
    }

    const messages = buildPrompt(ctx.triggeredBy, historical);
    let llmResponse: { content: string | null } | null;
    try {
      llmResponse = await this.llmClient!.chatCompletion(messages);
    } catch {
      return null;
    }
    if (!llmResponse?.content) return null;

    const recommendations = parseLlmResponse(llmResponse.content);
    if (recommendations.length === 0) return null;

    return {
      messageId: ctx.triggeredBy.id,
      recommendations: recommendations.sort((a, b) => b.confidence - a.confidence),
      contextUsed: ['llm', 'message_intent', 'message_urgency', 'historical_decisions'],
      generatedAt: new Date(),
    };
  }

  private generateWithRules(ctx: DecisionContext): RecommendationResult {
    const recommendations: Recommendation[] = [];
    const contextUsed: string[] = [];

    const primaryRec = this.buildPrimaryRecommendation(ctx.triggeredBy);
    recommendations.push(primaryRec);
    contextUsed.push('message_intent', 'message_urgency');

    if (ctx.historicalDecisions.length > 0) {
      const historicalRec = this.buildFromHistory(ctx.historicalDecisions);
      if (historicalRec) {
        recommendations.push(historicalRec);
        contextUsed.push('historical_decisions');
      }
    }

    if (ctx.relatedMessages.length > 0) {
      contextUsed.push('related_messages');
      const aggregateRec = this.buildFromRelatedMessages(ctx.relatedMessages);
      if (aggregateRec) recommendations.push(aggregateRec);
    }

    return {
      messageId: ctx.triggeredBy.id,
      recommendations: recommendations.sort((a, b) => b.confidence - a.confidence),
      contextUsed,
      generatedAt: new Date(),
    };
  }

  private buildPrimaryRecommendation(msg: NormalizedMessage): Recommendation {
    const actionMap: Record<string, string> = {
      approval: '审批通过并通知相关方',
      command: '派发给对应 Agent 执行',
      alert: '立即介入并启动应急预案',
      report: '确认收到并归档',
      inquiry: '整理上下文后回复',
      chat: '标记已读',
    };

    const riskMap: Record<string, string[]> = {
      approval: ['审批标准未核实', '可能存在合规风险'],
      command: ['执行失败需回退', 'Agent 资源可能不足'],
      alert: ['误报导致资源浪费', '响应不及时扩大影响'],
      report: [],
      inquiry: ['回复不准确影响信任'],
      chat: [],
    };

    return {
      id: `rec_${msg.id}_primary`,
      action: actionMap[msg.intent] ?? '标记已读',
      confidence: msg.intent === 'chat' ? 0.9 : 0.7,
      reasoning: `基于消息意图 "${msg.intent}" 和紧急度 "${msg.urgency}" 判断`,
      risks: riskMap[msg.intent] ?? [],
      alternatives: [
        { action: '暂缓处理，等待更多信息', tradeoff: '可能延误决策窗口' },
        { action: '转发给团队成员处理', tradeoff: '需确认该成员有足够上下文' },
      ],
      estimatedImpact:
        msg.urgency === 'critical' ? 'high' : msg.urgency === 'high' ? 'medium' : 'low',
    };
  }

  private buildFromHistory(history: HistoricalDecision[]): Recommendation | null {
    const mostSimilar = history.sort((a, b) => b.similarity - a.similarity)[0];
    if (!mostSimilar || mostSimilar.similarity < 0.6) return null;

    return {
      id: `rec_history_${mostSimilar.id}`,
      action: `参考历史决策: ${mostSimilar.summary}`,
      confidence: mostSimilar.similarity * 0.8,
      reasoning: `与历史决策 "${mostSimilar.summary}" 相似度 ${Math.round(mostSimilar.similarity * 100)}%`,
      risks: ['历史决策的前提条件可能已变化'],
      alternatives: [],
      estimatedImpact: 'medium',
    };
  }

  private buildFromRelatedMessages(related: NormalizedMessage[]): Recommendation | null {
    if (related.length < 2) return null;

    const alertCount = related.filter((m) => m.intent === 'alert').length;
    if (alertCount >= 2) {
      return {
        id: `rec_pattern_multi_alert`,
        action: '多源告警汇聚，建议升级为高优事件统一处理',
        confidence: 0.75,
        reasoning: `${alertCount} 条关联告警消息在短时间内到达`,
        risks: ['可能为同一根因的多次触发'],
        alternatives: [{ action: '逐条处理', tradeoff: '可能重复劳动' }],
        estimatedImpact: 'high',
      };
    }

    return null;
  }
}
