/**
 * OrchestrationService — cockpit 编排子系统用例编排（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 封装 routes/cockpit/orchestration.ts 的业务逻辑：
 * - chains CRUD + advance 步骤推进状态机
 * - escalations CRUD + update 走 domain 状态机（收敛原 route 任意 PATCH 为合法 status 转换）
 * - agents CRUD（route 无 PATCH，无状态机）
 *
 * 三端点前端不消费（孤儿），实体化破 EAV 贫血 + 为 /agent/dispatch 真调度留接口。
 * advance 是诚实假推进（手动 currentStep++，不调度 Agent），真调度接 /agent/dispatch 留 [PLANNED]。
 * 事件发布守原 route 行为（chain-created/step-advanced/escalation-created），不 scope creep。
 */
import type {
  OrchestrationChainRepository,
  OrchestrationChainListOptions,
} from '../../../db/repositories/orchestration-chain-repository.js';
import type {
  EscalationRepository,
  EscalationListOptions,
} from '../../../db/repositories/escalation-repository.js';
import type {
  OrchestrationAgentRepository,
  OrchestrationAgentListOptions,
} from '../../../db/repositories/orchestration-agent-repository.js';
import {
  OrchestrationChain,
  type CreateOrchestrationChainInput,
} from '../domain/orchestration/orchestration-chain.js';
import {
  Escalation,
  type CreateEscalationInput,
  type EscalationStatus,
} from '../domain/orchestration/escalation.js';
import {
  OrchestrationAgent,
  type CreateOrchestrationAgentInput,
} from '../domain/orchestration/orchestration-agent.js';
import type { EventBusPort } from './event-bus-port.js';

export class OrchestrationService {
  constructor(
    private chainRepo: OrchestrationChainRepository,
    private escalationRepo: EscalationRepository,
    private agentRepo: OrchestrationAgentRepository,
    private eventBus: EventBusPort
  ) {}

  // ── chains ──

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listChains(opts: OrchestrationChainListOptions = {}) {
    return this.chainRepo.listPaged(opts);
  }

  async createChain(input: CreateOrchestrationChainInput): Promise<OrchestrationChain> {
    const c = OrchestrationChain.create(input);
    await this.chainRepo.save(c);
    this.eventBus.publish('orchestration:chain-created', c.toProps());
    return c;
  }

  async getChain(id: string): Promise<OrchestrationChain | null> {
    return this.chainRepo.findById(id);
  }

  /**
   * advance 步骤推进：currentStep++，末步 status=completed。
   * 诚实标注：手动推进 currentStep，不调度 Agent（[PLANNED] 接 /agent/dispatch 真调度）。
   */
  async advanceChain(id: string): Promise<OrchestrationChain | null> {
    const c = await this.chainRepo.findById(id);
    if (!c) return null;
    const advanced = c.advance();
    await this.chainRepo.save(advanced);
    this.eventBus.publish('orchestration:step-advanced', {
      chainId: id,
      step: advanced.currentStep,
    });
    return advanced;
  }

  // ── escalations ──

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listEscalations(opts: EscalationListOptions = {}) {
    return this.escalationRepo.listPaged(opts);
  }

  async createEscalation(input: CreateEscalationInput): Promise<Escalation> {
    const e = Escalation.create(input);
    await this.escalationRepo.save(e);
    this.eventBus.publish('orchestration:escalation-created', e.toProps());
    return e;
  }

  /**
   * update 走 domain 状态机（收敛原 route 任意 PATCH 为合法 status 转换 + metadata 合并）。
   * status 必传（状态机核心）；metadata 可选合并进透传字段。
   * 非法 status / 非法转换由 domain.transition 抛错（route 层校验 status 必传，非法转换 fail-fast）。
   */
  async updateEscalation(
    id: string,
    patch: { status: EscalationStatus; metadata?: Record<string, unknown> }
  ): Promise<Escalation | null> {
    const e = await this.escalationRepo.findById(id);
    if (!e) return null;
    const updated = e.transition(patch.status, patch.metadata);
    await this.escalationRepo.save(updated);
    return updated;
  }

  // ── agents ──

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listAgents(opts: OrchestrationAgentListOptions = {}) {
    return this.agentRepo.listPaged(opts);
  }

  async createAgent(input: CreateOrchestrationAgentInput): Promise<OrchestrationAgent> {
    const a = OrchestrationAgent.create(input);
    await this.agentRepo.save(a);
    return a;
  }
}
