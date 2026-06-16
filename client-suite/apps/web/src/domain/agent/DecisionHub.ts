/**
 * DecisionHub — 统一决策接入层
 *
 * 所有决策请求的统一入口，负责：
 * 1. 接收不同来源的决策触发（风险规则、里程碑、协作等）
 * 2. 评估并调整决策的紧急度和截止时间
 * 3. 生成推荐方案（如未提供）
 * 4. 创建 DecisionRequest 实体
 * 5. 发布事件到 Store
 */

import { DecisionRequest, type RecommendationOption, DecisionUrgency } from './DecisionRequest';

/**
 * Domain event emitter port.
 * Application 层通过 DecisionHub.setEventEmitter() 注入实现。
 */
export interface DomainEventEmitter {
  emitDecisionCreated(payload: { decisionId: string; agentId: string; urgency: string }): void;
}

const noopEmitter: DomainEventEmitter = { emitDecisionCreated: () => {} };

/**
 * 决策来源类型
 */
export type DecisionSource =
  | 'risk-rule-trigger' // 风险规则触发
  | 'milestone-arrival' // 里程碑到达
  | 'collaboration-node' // 协作节点
  | 'agent-discovery' // Agent 主动发现
  | 'external-alarm'; // 外部报警

/**
 * 决策触发器参数
 */
export interface DecisionTrigger {
  /** 决策来源 */
  source: DecisionSource;
  /** 来源 ID（规则 ID、里程碑 ID 等） */
  sourceId: string;
  /** 决策标题 */
  title: string;
  /** 决策上下文描述 */
  context: string;
  /** 紧急度 */
  urgency: DecisionUrgency;
  /** 截止时间（时间戳） */
  deadline: number;
  /** 关联实体 ID */
  relatedEntities: {
    notificationId?: string;
    taskId?: string;
    goalId?: string;
    traceId?: string;
    collaborationId?: string;
    /** 决策请求 ID（用于关联） */
    decisionId?: string;
  };
  /** 推荐方案（可选，未提供时会自动生成） */
  recommendation?: RecommendationOption;
  /** 备选方案（可选） */
  alternatives?: RecommendationOption[];
  /** 影响范围评分（下游受影响实体数量） */
  impactScope?: number;
  /** 下游受影响任务 ID 列表 */
  downstreamTaskIds?: string[];
  /** 下游受影响目标 ID 列表 */
  downstreamGoalIds?: string[];
}

/**
 * 决策触发器处理器接口
 */
export interface DecisionTriggerHandler {
  /** 预处理：评估 urgency、调整 deadline、生成推荐方案 */
  preprocess(trigger: DecisionTrigger): Promise<DecisionTrigger>;
  /** 后处理：决策创建后的额外操作（可选） */
  postprocess?(decision: DecisionRequest): Promise<void>;
}

/**
 * DecisionHub — 统一决策接入层
 */
export class DecisionHub {
  private static readonly TRIGGERS: Map<DecisionSource, DecisionTriggerHandler> = new Map();
  private static _recommendationGenerator?: (trigger: DecisionTrigger) => RecommendationOption;
  private static eventEmitter: DomainEventEmitter = noopEmitter;

  /**
   * 注入事件发射器（由 application 层调用）
   */
  static setEventEmitter(emitter: DomainEventEmitter): void {
    this.eventEmitter = emitter;
  }

  /**
   * 注册决策触发器
   */
  static registerTrigger(source: DecisionSource, handler: DecisionTriggerHandler): void {
    this.TRIGGERS.set(source, handler);
  }

  /**
   * 注册推荐方案生成器（可选）
   */
  static registerRecommendationGenerator(
    generator: (trigger: DecisionTrigger) => RecommendationOption
  ): void {
    (this as typeof DecisionHub)._recommendationGenerator = generator;
  }

  /**
   * 注销决策触发器
   */
  static unregisterTrigger(source: DecisionSource): void {
    this.TRIGGERS.delete(source);
  }

  /**
   * 触发决策请求
   */
  static async trigger(trigger: DecisionTrigger): Promise<DecisionRequest> {
    const handler = this.TRIGGERS.get(trigger.source);

    // 1. 预处理：评估 urgency 并调整 deadline、生成推荐方案
    const processedTrigger = handler ? await handler.preprocess(trigger) : trigger;

    // 2. 生成推荐方案（如未提供）
    const recommendation =
      processedTrigger.recommendation ?? this.generateRecommendation(processedTrigger);

    // 3. 提取关联任务 ID（如果有）
    const relatedTaskIds = processedTrigger.relatedEntities.taskId
      ? [processedTrigger.relatedEntities.taskId]
      : [];

    // 4. 创建决策请求
    const downstreamTaskIds = processedTrigger.downstreamTaskIds ?? [];
    const downstreamGoalIds = processedTrigger.downstreamGoalIds ?? [];
    const impactScope =
      processedTrigger.impactScope ?? downstreamTaskIds.length + downstreamGoalIds.length;

    const decision = DecisionRequest.create({
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: this.extractAgentId(processedTrigger),
      title: processedTrigger.title,
      context: processedTrigger.context,
      recommendation,
      alternatives: processedTrigger.alternatives ?? [],
      urgency: processedTrigger.urgency,
      deadline: processedTrigger.deadline,
      responseStatus: 'pending',
      sourceNotificationId: processedTrigger.relatedEntities.notificationId,
      relatedTaskIds,
      createdAt: Date.now(),
      impactScope,
      downstreamTaskIds,
      downstreamGoalIds,
    });

    // 5. 发布事件到 Store
    this.eventEmitter.emitDecisionCreated({
      decisionId: decision.id,
      agentId: decision.agentId,
      urgency: decision.urgency,
    });

    // 6. 调用后处理器（如有）
    if (handler?.postprocess) {
      await handler.postprocess(decision);
    }

    return decision;
  }

  /**
   * 批量触发决策请求
   */
  static async triggerBatch(triggers: DecisionTrigger[]): Promise<DecisionRequest[]> {
    const results: DecisionRequest[] = [];
    for (const trigger of triggers) {
      try {
        const decision = await this.trigger(trigger);
        results.push(decision);
      } catch {
        // fire-and-forget: individual trigger failure doesn't abort batch
      }
    }
    return results;
  }

  /**
   * 生成默认推荐方案
   */
  private static generateRecommendation(trigger: DecisionTrigger): RecommendationOption {
    // 尝试使用注册的生成器
    const generator = this._recommendationGenerator;
    if (generator) {
      try {
        return generator(trigger);
      } catch {
        // 生成器失败，使用默认方案
      }
    }

    // 根据来源生成默认推荐
    const recommendationMap: Record<DecisionSource, RecommendationOption> = {
      'risk-rule-trigger': {
        id: 'rec-risk-default',
        label: '按建议处理',
        description: '根据风险评估结果采取相应措施',
        reasoning: '基于风险规则评估的默认处理方式',
        estimatedImpact: '按预期执行',
        riskLevel: trigger.urgency === 'critical' ? 'high' : 'medium',
      },
      'milestone-arrival': {
        id: 'rec-milestone-default',
        label: '继续下一个里程碑',
        description: '确认当前里程碑已完成，继续推进项目',
        reasoning: '当前里程碑已达成，无阻塞项',
        estimatedImpact: '按时完成整体目标',
        riskLevel: 'low',
      },
      'collaboration-node': {
        id: 'rec-collab-default',
        label: '批准并继续',
        description: '批准当前节点的变更，继续推进协作',
        reasoning: '变更符合项目预期',
        estimatedImpact: '协作链继续推进',
        riskLevel: 'low',
      },
      'agent-discovery': {
        id: 'rec-discovery-default',
        label: '采纳 Agent 建议',
        description: '按照 Agent 发现的结果采取行动',
        reasoning: 'Agent 基于上下文分析的最优建议',
        estimatedImpact: '按计划处理发现',
        riskLevel: 'medium',
      },
      'external-alarm': {
        id: 'rec-alarm-default',
        label: '按警报处理',
        description: '根据外部系统的警报信息采取相应措施',
        reasoning: '外部系统检测到的需要处理的事件',
        estimatedImpact: '按警报级别处理',
        riskLevel: trigger.urgency === 'critical' ? 'high' : 'medium',
      },
    };

    return (
      recommendationMap[trigger.source] ?? {
        id: 'rec-default',
        label: '建议操作',
        description: '基于当前上下文的最优决策',
        reasoning: '根据系统分析生成的建议',
        estimatedImpact: '预计完成相关任务',
        riskLevel: 'medium',
      }
    );
  }

  /**
   * 从 trigger 中提取 Agent ID
   */
  private static extractAgentId(trigger: DecisionTrigger): string {
    const { taskId, goalId, collaborationId } = trigger.relatedEntities;
    if (taskId) return `agent-${taskId.slice(0, 4)}`;
    if (goalId) return `agent-${goalId.slice(0, 4)}`;
    if (collaborationId) return `agent-collab-${collaborationId.slice(0, 4)}`;
    return 'agent-orchestrator';
  }

  /**
   * 检查是否已注册某个来源的处理器
   */
  static hasHandler(source: DecisionSource): boolean {
    return this.TRIGGERS.has(source);
  }

  /**
   * 获取所有已注册的来源
   */
  static getRegisteredSources(): DecisionSource[] {
    return Array.from(this.TRIGGERS.keys());
  }
}
