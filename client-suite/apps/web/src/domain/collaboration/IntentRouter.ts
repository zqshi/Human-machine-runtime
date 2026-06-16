/**
 * IntentRouter — 意图匹配 + 路由引擎
 *
 * Agent A 发出 intent → 路由到能处理的 Agent B。
 * 路由策略：匹配 capability → 评分（成功率×延迟×负载）→ 选择最优。
 */

import {
  IntentProtocol,
  type IntentMessage,
  type IntentRegistration,
} from './IntentProtocol';

export interface RoutingScore {
  readonly agentId: string;
  readonly matchScore: number;
  readonly performanceScore: number;
  readonly loadScore: number;
  readonly totalScore: number;
}

export interface AgentLoadInfo {
  readonly agentId: string;
  readonly pendingIntents: number;
  readonly avgResponseMs: number;
  readonly successRate: number;
}

export interface RoutingResult {
  readonly targetAgentId: string;
  readonly intentType: string;
  readonly scores: readonly RoutingScore[];
  readonly selectedScore: RoutingScore;
  readonly routedAt: number;
}

const W_MATCH = 0.4;
const W_PERF = 0.35;
const W_LOAD = 0.25;

export class IntentRouter {
  private readonly protocol: IntentProtocol;
  private readonly loadMap: Map<string, AgentLoadInfo> = new Map();

  constructor(protocol: IntentProtocol) {
    this.protocol = protocol;
  }

  updateLoad(info: AgentLoadInfo): void {
    this.loadMap.set(info.agentId, info);
  }

  route(intentType: string, fromAgentId: string): RoutingResult | null {
    const handlers = this.protocol
      .findHandlers(intentType)
      .filter((reg) => reg.agentId !== fromAgentId);

    if (handlers.length === 0) return null;

    const scores = handlers.map((reg) => this.scoreAgent(reg, intentType));
    scores.sort((a, b) => b.totalScore - a.totalScore);

    const selected = scores[0];
    return {
      targetAgentId: selected.agentId,
      intentType,
      scores,
      selectedScore: selected,
      routedAt: Date.now(),
    };
  }

  routeToSpecific(intentType: string, targetAgentId: string): boolean {
    const reg = this.protocol.getRegistration(targetAgentId);
    if (!reg) return false;
    return reg.intents.some((i) => i.type === intentType);
  }

  private scoreAgent(reg: IntentRegistration, intentType: string): RoutingScore {
    const descriptor = reg.intents.find((i) => i.type === intentType);
    const matchScore = descriptor ? 100 : 0;

    const load = this.loadMap.get(reg.agentId);
    const performanceScore = load ? load.successRate * 100 : 50;

    const loadScore = load ? Math.max(0, 100 - load.pendingIntents * 10) : 80;

    const totalScore = matchScore * W_MATCH + performanceScore * W_PERF + loadScore * W_LOAD;

    return {
      agentId: reg.agentId,
      matchScore,
      performanceScore,
      loadScore,
      totalScore,
    };
  }

  getAvailableHandlers(intentType: string): IntentRegistration[] {
    return this.protocol.findHandlers(intentType);
  }

  dispatch(msg: IntentMessage): { routed: boolean; target?: string; message?: IntentMessage } {
    const result = this.route(msg.type, msg.fromAgentId);
    if (!result) {
      return { routed: false };
    }

    const routedMsg: IntentMessage = {
      ...msg,
      toAgentId: result.targetAgentId,
    };

    return { routed: true, target: result.targetAgentId, message: routedMsg };
  }
}
