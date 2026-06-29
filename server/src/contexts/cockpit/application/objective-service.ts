/**
 * ObjectiveService — cockpit 战略解码子系统用例编排（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 封装 routes/cockpit/objectives.ts 的业务逻辑：objectives CRUD（实体表）+ 战略解码。
 * - objectives 走新实体表 ObjectiveRepository（破 EAV 贫血，domain 实体不变式守卫）
 * - decode 委托 DecodeStrategyPort（注入 routes/cockpit/llm-analysis.decodeStrategy，
 *   避免 application→routes 反向依赖 §1.1；bootstrap 包装成 (intent)=>result）
 * - 故障暴露：decodePort 未注入 → 503（不 mock，同 llm-analysis 模式）
 */
import type {
  ObjectiveRepository,
  ObjectiveListOptions,
} from '../../../db/repositories/objective-repository.js';
import { Objective, type CreateObjectiveInput } from '../domain/objective/objective.js';
import type { EventBusPort } from './event-bus-port.js';
import { newId } from '../../../shared/utils.js';

/** 战略解码结构化结果（与前端 DecodedStrategyDTO 对齐，与 routes/cockpit/llm-analysis DecodedStrategy 结构一致）。 */
export interface DecodedStrategy {
  questions: Array<{ id: string; question: string; purpose: string }>;
  hypotheses: Array<{
    id: string;
    statement: string;
    baselineValue: number;
    targetValue: number;
  }>;
  constraints: string[];
  suggestedL1Objectives: Array<{ title: string; keyQuestion: string }>;
}

export type DecodeResult =
  | { ok: true; data: DecodedStrategy }
  | { ok: false; status: 503 | 502; reason: string };

/** 战略解码端口（注入 routes/cockpit/llm-analysis.decodeStrategy，避免 application→routes 反向依赖）。 */
export type DecodeStrategyPort = (intent: string) => Promise<DecodeResult>;

export class ObjectiveService {
  constructor(
    private repo: ObjectiveRepository,
    private eventBus: EventBusPort,
    private decodePort: DecodeStrategyPort | null
  ) {}

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listObjectives(opts: ObjectiveListOptions = {}) {
    return this.repo.listPaged(opts);
  }

  async createObjective(input: CreateObjectiveInput): Promise<Objective> {
    const o = Objective.create(input);
    await this.repo.save(o);
    this.eventBus.publish('objective:created', o.toProps());
    return o;
  }

  async getObjective(id: string): Promise<Objective | null> {
    return this.repo.findById(id);
  }

  /** PATCH：字段 merge（toProps + patch + fromProps 重建校验不变式）。 */
  async updateObjective(id: string, patch: Record<string, unknown>): Promise<Objective | null> {
    const o = await this.repo.findById(id);
    if (!o) return null;
    const merged = { ...o.toProps(), ...patch };
    delete (merged as Record<string, unknown>).action;
    const updated = Objective.fromProps(merged);
    await this.repo.save(updated);
    this.eventBus.publish('objective:updated', updated.toProps());
    return updated;
  }

  async deleteObjective(id: string): Promise<boolean> {
    return this.repo.remove(id);
  }

  /** 战略解码：委托 decodePort（接真 LLM）。未注入 → 503 故障暴露（不 mock）。 */
  async decodeStrategy(intent: string): Promise<DecodeResult> {
    if (!this.decodePort) {
      return { ok: false, status: 503, reason: '战略解码服务未配置(LLM 未就绪)' };
    }
    const result = await this.decodePort(intent);
    if (result.ok) {
      // 保留现状 publish 语义（l0Id 临时 id 未落库，怪味记入 current.md 遗留，不在 Phase B 改）
      this.eventBus.publish('objective:decoded', {
        l0Id: newId('l0'),
        questions: result.data.questions.map((q) => q.question),
      });
    }
    return result;
  }
}
