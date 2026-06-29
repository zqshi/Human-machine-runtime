/**
 * SignalService — cockpit 感知子系统用例编排（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 封装 routes/cockpit/signals.ts 的业务逻辑：涌现信号 CRUD（实体表）+ 模式 CRUD + corrections/apply。
 * - emergent_signal / pattern 走新实体表 repository（破 EAV 贫血，domain 实体不变式守卫）
 * - signal（旧 EAV entityType，非 emergent）保留 CockpitRepository 过渡（后续版本迁实体表或清理）
 * - corrections/apply：E6 接 harness.dispatchTask 传播；当前 effective:false 诚实标注（守 C20，不伪装）
 */
import type {
  EmergentSignalRepository,
  SignalListOptions,
} from '../../../db/repositories/emergent-signal-repository.js';
import type {
  PatternRepository,
  PatternListOptions,
} from '../../../db/repositories/pattern-repository.js';
import type { CockpitRepository } from '../../../db/repositories/cockpit-repository.js';
import { EmergentSignal, type SignalSeverity } from '../domain/sensing/emergent-signal.js';
import { Pattern, type PatternType } from '../domain/sensing/pattern.js';
import type { EventBusPort } from './event-bus-port.js';
import type { SignalExtractionService, ExtractionOptions } from './signal-extraction-service.js';

/** @deprecated EventBusPort 已提取到 ./event-bus-port.js，保留 re-export 兼容旧引用 */
export type { EventBusPort };

export interface CreateEmergentSignalInput {
  pattern: string;
  severity: SignalSeverity;
  patternId?: string;
  correlatedSignalIds?: string[];
  suggestedAction?: string;
  tenantId?: string;
  detectedAt?: number;
}

export interface CreatePatternInput {
  pattern?: string;
  data?: Record<string, unknown>;
  patternType?: PatternType;
  tenantId?: string;
}

export interface CorrectionResult {
  applied: number;
  failed: number;
  effective: boolean;
  note: string;
  affectedTasks?: string[];
}

/**
 * E6 correction 传播执行器端口（接 harness.dispatchTask 真路由）。
 *
 * correction 传播语义：人修正后，系统把修正传播到受影响下游任务（重新 dispatch）。
 * 真实现需明确 actions 语义（correction 计划结构 → AgentTaskInput 转换）+ harness 对接，
 * 留后续（不在本会话假设 actions 结构）。未注入 → applyCorrections 诚实标注 effective:false（守 C20）。
 */
export interface CorrectionExecutorPort {
  applyCorrections(planId: string, actions: unknown[]): Promise<CorrectionResult>;
}

export class SignalService {
  constructor(
    private emergentRepo: EmergentSignalRepository,
    private patternRepo: PatternRepository,
    private cockpitRepo: CockpitRepository,
    private eventBus: EventBusPort,
    private extractionService: SignalExtractionService
  ) {}

  /** E6 correction 传播执行器（接 harness.dispatchTask）。未注入→applyCorrections 诚实标注未生效。 */
  correctionExecutor?: CorrectionExecutorPort;

  // ── signal（旧 EAV entityType，过渡保留）──
  async listSignals(query: {
    urgency?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number; limit: number; offset: number }> {
    let items = await this.cockpitRepo.list('signal');
    if (query.urgency) items = items.filter((s) => s.urgency === query.urgency);
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = Math.max(0, query.offset ?? 0);
    return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
  }

  // ── emergent signals（新实体表）──
  async listEmergent(opts: SignalListOptions = {}) {
    return this.emergentRepo.list(opts);
  }

  async listEmergentPaged(opts: SignalListOptions = {}) {
    return this.emergentRepo.listPaged(opts);
  }

  async getEmergent(id: string): Promise<EmergentSignal | null> {
    return this.emergentRepo.findById(id);
  }

  async createEmergent(input: CreateEmergentSignalInput): Promise<EmergentSignal> {
    const sig = EmergentSignal.create(input);
    await this.emergentRepo.save(sig);
    this.eventBus.publish('emergent-signal:detected', sig.toProps());
    return sig;
  }

  /** PATCH：支持状态机 action（acknowledge/resolve/dismiss）+ 字段 merge（fromProps 重建校验不变式）。 */
  async updateEmergent(id: string, patch: Record<string, unknown>): Promise<EmergentSignal | null> {
    const sig = await this.emergentRepo.findById(id);
    if (!sig) return null;
    let updated: EmergentSignal;
    const action = patch.action;
    if (action === 'acknowledge') {
      updated = sig.acknowledge();
    } else if (action === 'resolve') {
      updated = sig.resolve();
    } else if (action === 'dismiss') {
      updated = sig.dismiss();
    } else {
      // 字段 merge：toProps + patch + fromProps（校验枚举不变式，脏数据拒建）
      const merged = { ...sig.toProps(), ...patch, updatedAt: new Date() };
      delete (merged as Record<string, unknown>).action;
      updated = EmergentSignal.fromProps(merged);
    }
    await this.emergentRepo.save(updated);
    return updated;
  }

  // ── patterns（新实体表）──
  async listPatterns(opts: PatternListOptions = {}) {
    return this.patternRepo.list(opts);
  }

  async listPatternsPaged(opts: PatternListOptions = {}) {
    return this.patternRepo.listPaged(opts);
  }

  async createPattern(input: CreatePatternInput): Promise<Pattern> {
    const p = Pattern.create(input);
    await this.patternRepo.save(p);
    this.eventBus.publish('pattern:discovered', p.toProps());
    return p;
  }

  // ── corrections/apply（E6 接 harness.dispatchTask 传播；当前诚实标注未生效）──
  async applyCorrections(planId: string, _actions: unknown[]): Promise<CorrectionResult> {
    // E6: 注入了 CorrectionExecutorPort（接 harness.dispatchTask 真路由）则委托真传播。
    if (this.correctionExecutor) {
      return this.correctionExecutor.applyCorrections(planId, _actions);
    }
    // 诚实化（守 C20）：correction 传播链路未接入执行引擎，未实际生效。
    // 真实现接 harness.dispatchTask（CorrectionExecutorPort），待 actions 语义明确 + harness 对接。
    this.eventBus.publish('correction:applied', {
      planId,
      applied: false,
      affectedTasks: [],
      affectedGoals: [],
    });
    return {
      applied: 0,
      failed: 0,
      effective: false,
      note: 'correction 传播链路未接入执行引擎(/agent/dispatch)，未实际生效(自动传播待 E6 实现)',
      affectedTasks: [],
    };
  }

  /** ④从 dispatch trace 自动提取涌现信号（委托 SignalExtractionService，感知神经系统）。 */
  async extractEmergentFromTrace(opts?: ExtractionOptions) {
    return this.extractionService.extract(opts);
  }
}
