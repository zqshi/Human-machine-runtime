import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { openclawEntities } from '../../../db/schema/operational.js';
import { DbMapStore } from '../../../db/repositories/agent-runtime-repository.js';
import { appEventBus } from '../../../shared/event-bus.js';
import { decisionsCreatedTotal } from '../../../shared/metrics.js';
import type { Decision } from './domain/decision.js';
import type { TaskArtifact } from '../domain/agent-executor.js';
import type { IMapStore } from './domain/map-store.js';

const DECISION_ENTITY_TYPE = 'agent_decision';
const TASK_ARTIFACT_ENTITY_TYPE = 'agent_exec_task';

/**
 * SessionStore — agent-core 的状态持久化层。
 *
 * 职责:
 *   - 管理两种 entityType 的 KV 存储:agent_decision / agent_exec_task
 *   - 高层 API recordDecision / recordTaskArtifact:写 DB + 广播事件 + 统计
 *   - 低层 store(decisionStore / taskArtifactStore)供 AgentExecutor 复用
 *
 * 事件广播策略(向后兼容):
 *   - recordDecision 双发 'decision:created'(旧)+ 'session:decision:created'(新)
 *   - recordTaskArtifact 只发 'session:task:created'(新事件,前端需订阅)
 *
 * D2 阶段删除 AgentRuntimeService 后,前端 SSE 订阅方需同步迁移到新事件名。
 * 保留旧事件名双发一个版本,降低迁移风险。
 */
export class SessionStore {
  readonly decisionStore: IMapStore<Decision>;
  readonly taskArtifactStore: IMapStore<TaskArtifact>;
  private readonly dbStores: DbMapStore<unknown>[];
  private loaded = false;

  constructor(private db: Database) {
    this.decisionStore = new DbMapStore<Decision>(db, DECISION_ENTITY_TYPE);
    this.taskArtifactStore = new DbMapStore<TaskArtifact>(db, TASK_ARTIFACT_ENTITY_TYPE);
    this.dbStores = [
      this.decisionStore as unknown as DbMapStore<unknown>,
      this.taskArtifactStore as unknown as DbMapStore<unknown>,
    ];
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    await Promise.all(this.dbStores.map((s) => s.load()));
    this.loaded = true;
  }

  /** 写入决策 + 广播 decision:created(向后兼容)+ session:decision:created(新)。 */
  recordDecision(decision: Decision): void {
    this.decisionStore.set(decision.id, decision);
    decisionsCreatedTotal.labels(decision.urgency).inc();
    const payload = decision as unknown as Record<string, unknown>;
    appEventBus.publish('decision:created', payload);
    appEventBus.publish('session:decision:created', payload);
  }

  /** 写入任务 artifact + 广播 session:task:created。 */
  recordTaskArtifact(artifact: TaskArtifact): void {
    this.taskArtifactStore.set(artifact.id, artifact);
    const payload = artifact as unknown as Record<string, unknown>;
    appEventBus.publish('session:task:created', payload);
  }

  getDecision(id: string): Decision | undefined {
    return this.decisionStore.get(id);
  }

  getTaskArtifact(id: string): TaskArtifact | undefined {
    return this.taskArtifactStore.get(id);
  }

  /**
   * 列出最近的决策(按 createdAt 倒序)。
   *
   * 注:Decision 类型本身没有 tenantId 字段,此处暂不做租户隔离。
   * 多租户场景由上层(bootstrap 注入时按 tenant 分别构造 SessionStore)或
   * 调用方自行过滤。tenant_id 列存在于 openclawEntities 表,但 cache 中未保留,
   * 未来需要时再扩展 IMapStore 接口。
   */
  listRecentDecisions(limit = 10): Decision[] {
    return Array.from(this.decisionStore.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /** 原始查询:按 entityType 从 DB 直接取数(供未来扩展,如租户过滤)。 */
  async rawListByEntityType(entityType: string): Promise<unknown[]> {
    const rows = await this.db
      .select()
      .from(openclawEntities)
      .where(eq(openclawEntities.entityType, entityType));
    return rows.map((r) => r.data);
  }
}
