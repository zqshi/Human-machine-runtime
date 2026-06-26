import type { EmployeeMemoryRepository } from '../../db/repositories/employee-memory-repository.js';
import type { KnowledgeService } from '../knowledge/knowledge-service.js';
import type { Mem0Client, Mem0SearchParams } from './mem0-client.js';
import type { IInstanceRepository } from '../tenant-instance/instance-service.js';
import {
  type MemoryStore,
  type MemoryFragment,
  type MemoryRule,
  type MemorySearchResult,
  type MemorySearchHit,
  type RetrievalConfig,
  type FragmentType,
  type MemoryRuleType,
  type FragmentScope,
  FRAGMENT_SCOPE,
  createMemoryStore,
  createMemoryFragment,
  createMemoryRule,
  validateRetrievalConfig,
  ORG_USER_ID,
} from './domain/memory.js';
import { logger } from '../../app/logger.js';

/** addFragment 入参(提取为命名类型,供 syncFragmentToMem0 复用;§3.2 单方法拆分) */
type AddFragmentInput = {
  storeId: string;
  tenantId: string;
  userId: string;
  type: FragmentType;
  content: string;
  source?: 'auto_extracted' | 'manual' | 'rule_generated';
  importance?: number;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  scope?: FragmentScope;
  departmentId?: string | null;
};

/* ---------- Service ---------- */

export class MemoryService {
  private repo: EmployeeMemoryRepository;
  private knowledgeService: KnowledgeService | null;
  private mem0: Mem0Client | null;
  private instanceRepo: IInstanceRepository | null;

  constructor(
    repo: EmployeeMemoryRepository,
    knowledgeService?: KnowledgeService | null,
    mem0?: Mem0Client | null,
    instanceRepo?: IInstanceRepository | null
  ) {
    this.repo = repo;
    this.knowledgeService = knowledgeService ?? null;
    this.mem0 = mem0 ?? null;
    this.instanceRepo = instanceRepo ?? null;
  }

  /* ──── Store ──── */

  async listStores(tenantId?: string): Promise<MemoryStore[]> {
    return this.repo.listStores(tenantId);
  }

  async getStoreById(id: string): Promise<MemoryStore | null> {
    return this.repo.findStoreById(id);
  }

  async getStoreByInstance(instanceId: string): Promise<MemoryStore | null> {
    return this.repo.findStoreByInstanceId(instanceId);
  }

  async createStore(input: {
    instanceId: string;
    tenantId: string;
    name: string;
    description?: string;
    retrievalConfig?: Partial<RetrievalConfig>;
  }): Promise<MemoryStore> {
    if (input.retrievalConfig) {
      const err = validateRetrievalConfig(input.retrievalConfig);
      if (err) throw new Error(err);
    }
    const store = createMemoryStore(input);
    await this.repo.saveStore(store);
    return store;
  }

  async updateStoreRetrievalConfig(
    storeId: string,
    config: Partial<RetrievalConfig>
  ): Promise<MemoryStore> {
    const err = validateRetrievalConfig(config);
    if (err) throw new Error(err);
    const store = await this.repo.findStoreById(storeId);
    if (!store) throw new Error(`memory store not found: ${storeId}`);
    const updated: MemoryStore = {
      ...store,
      retrievalConfig: { ...store.retrievalConfig, ...config },
    };
    await this.repo.saveStore(updated);
    return updated;
  }

  async deleteStore(storeId: string): Promise<void> {
    const store = await this.repo.findStoreById(storeId);
    if (!store) throw new Error(`memory store not found: ${storeId}`);
    await this.repo.deleteStore(storeId);
  }

  async archiveStore(storeId: string): Promise<MemoryStore> {
    const store = await this.repo.findStoreById(storeId);
    if (!store) throw new Error(`memory store not found: ${storeId}`);
    const updated: MemoryStore = { ...store, status: 'archived' };
    await this.repo.saveStore(updated);
    return updated;
  }

  async restoreStore(storeId: string): Promise<MemoryStore> {
    const store = await this.repo.findStoreById(storeId);
    if (!store) throw new Error(`memory store not found: ${storeId}`);
    const updated: MemoryStore = { ...store, status: 'active' };
    await this.repo.saveStore(updated);
    return updated;
  }

  async getStoreFragmentStats(
    storeId: string
  ): Promise<{ orgCount: number; personalCount: number }> {
    const [orgCount, personalCount] = await Promise.all([
      this.repo.countFragmentsByScope(storeId, 'org'),
      this.repo.countFragmentsByScope(storeId, 'personal'),
    ]);
    return { orgCount, personalCount };
  }

  /* ──── Fragment ──── */

  async listFragments(
    storeId: string,
    opts?: {
      userId?: string;
      type?: FragmentType;
      keyword?: string;
      limit?: number;
      offset?: number;
      scope?: FragmentScope;
      departmentId?: string;
    }
  ): Promise<MemoryFragment[]> {
    // If Mem0 is enabled and we have a userId filter (not scope-based), try Mem0 first for richer results
    if (this.mem0?.isEnabled() && opts?.userId && !opts?.scope) {
      try {
        const store = await this.repo.findStoreById(storeId);
        if (store) {
          const deptId = await this.getDepartmentIdByStore(store);
          const mem0Memories = await this.mem0.getAll({
            userId: opts.userId,
            agentId: store.instanceId,
            orgId: store.tenantId,
            projectId: deptId ?? undefined,
          });
          // Convert Mem0 results to local fragment format
          const converted: MemoryFragment[] = mem0Memories.map((m) => ({
            id: `mem0_${m.id}`,
            memoryStoreId: storeId,
            tenantId: store.tenantId,
            userId: m.user_id,
            scope: (m.user_id === ORG_USER_ID
              ? FRAGMENT_SCOPE.ORG
              : FRAGMENT_SCOPE.PERSONAL) as FragmentScope,
            departmentId: null,
            type: 'fact' as FragmentType,
            content: m.memory,
            source: 'auto_extracted' as const,
            importance: 5,
            accessCount: 0,
            lastAccessedAt: null,
            expiresAt: null,
            metadata: { mem0Id: m.id, categories: m.categories, source: 'mem0' },
            createdAt: m.created_at,
            updatedAt: m.updated_at,
          }));
          // Merge with local DB results
          const localFrags = await this.repo.listFragments(storeId, opts);
          const localIds = new Set(localFrags.map((f) => f.id));
          const merged = [...localFrags, ...converted.filter((f) => !localIds.has(f.id))];
          return merged;
        }
      } catch (err) {
        logger.warn(
          { err: String(err) },
          '[memory-service] Mem0 listFragments failed, falling back to local'
        );
      }
    }

    return this.repo.listFragments(storeId, opts);
  }

  async addFragment(input: AddFragmentInput): Promise<MemoryFragment> {
    const fragment = createMemoryFragment({
      memoryStoreId: input.storeId,
      tenantId: input.tenantId,
      userId: input.userId,
      scope: input.scope,
      departmentId: input.departmentId,
      type: input.type,
      content: input.content,
      source: input.source,
      importance: input.importance,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    });
    await this.repo.saveFragment(fragment);

    // Dual-write to Mem0(提取为 syncFragmentToMem0;原 addFragment 84 行超 80 红线,§3.2 拆分)
    const store = await this.repo.findStoreById(input.storeId);
    await this.syncFragmentToMem0(fragment, input, store);

    // Update store counters(提取为 updateStoreCounters)
    if (store) {
      await this.updateStoreCounters(input.storeId, store);
    }

    return fragment;
  }

  /**
   * Mem0 dual-write:共享记忆(userId=ORG_USER_ID)走 addShared(agent 级),个人记忆走 add(user 级)。
   * 失败仅 warn 不阻断本地 DB 写(本地已落库,Mem0 为旁路增强)。
   */
  private async syncFragmentToMem0(
    fragment: MemoryFragment,
    input: AddFragmentInput,
    store: MemoryStore | null
  ): Promise<void> {
    if (!this.mem0?.isEnabled() || !store) return;
    const deptId = await this.getDepartmentIdByStore(store);
    try {
      if (input.userId === ORG_USER_ID) {
        // Shared memory: no user_id → agent-level shared memory in Mem0
        await this.mem0.addShared({
          messages: [
            { role: 'user', content: input.content },
            { role: 'assistant', content: `已记住（共享）：${input.content}` },
          ],
          agentId: store.instanceId,
          orgId: store.tenantId,
          projectId: deptId ?? undefined,
          metadata: {
            storeId: input.storeId,
            type: input.type,
            source: input.source || 'manual',
            consensus: true,
          },
        });
        logger.info(
          { fragmentId: fragment.id },
          '[memory-service] synced shared fragment to Mem0 (agent-level)'
        );
      } else {
        // Personal memory: scoped to user + agent
        await this.mem0.add({
          messages: [
            { role: 'user', content: input.content },
            { role: 'assistant', content: `已记住：${input.content}` },
          ],
          userId: input.userId,
          agentId: store.instanceId,
          orgId: store.tenantId,
          projectId: deptId ?? undefined,
          metadata: {
            storeId: input.storeId,
            type: input.type,
            source: input.source || 'manual',
          },
        });
        logger.info(
          { fragmentId: fragment.id, userId: input.userId },
          '[memory-service] synced fragment to Mem0'
        );
      }
    } catch (err) {
      logger.warn(
        { err: String(err) },
        '[memory-service] Mem0 add failed, local DB write succeeded'
      );
    }
  }

  /** 更新 store 的 fragment/user 计数器(写后聚合,非实时精确)。 */
  private async updateStoreCounters(storeId: string, store: MemoryStore): Promise<void> {
    const totalFragments = await this.repo.countFragmentsByStore(storeId);
    const totalProfiles = await this.repo.countDistinctUsersByStore(storeId);
    await this.repo.saveStore({ ...store, totalFragments, totalProfiles });
  }

  async deleteFragment(fragmentId: string): Promise<void> {
    const fragment = await this.repo.findFragmentById(fragmentId);
    if (!fragment) throw new Error(`fragment not found: ${fragmentId}`);
    await this.repo.deleteFragment(fragmentId);

    // Delete from Mem0 if it was synced
    const mem0Id = fragment.metadata?.mem0Id;
    if (this.mem0?.isEnabled() && typeof mem0Id === 'string') {
      try {
        await this.mem0.delete(mem0Id);
      } catch (err) {
        logger.warn({ err: String(err) }, '[memory-service] Mem0 delete failed');
      }
    }

    // Update store counters
    const store = await this.repo.findStoreById(fragment.memoryStoreId);
    if (store) {
      const totalFragments = await this.repo.countFragmentsByStore(fragment.memoryStoreId);
      const totalProfiles = await this.repo.countDistinctUsersByStore(fragment.memoryStoreId);
      await this.repo.saveStore({ ...store, totalFragments, totalProfiles });
    }
  }

  /* ──── Department-Shared Fragment (跨 Agent, app-level) ──── */

  async addDeptSharedFragment(input: {
    storeId: string;
    departmentId: string;
    content: string;
    type?: FragmentType;
    importance?: number;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryFragment> {
    const store = await this.repo.findStoreById(input.storeId);
    if (!store) throw new Error(`memory store not found: ${input.storeId}`);

    const fragment = createMemoryFragment({
      memoryStoreId: input.storeId,
      tenantId: store.tenantId,
      userId: `__dept_${input.departmentId}__`,
      scope: FRAGMENT_SCOPE.DEPT,
      departmentId: input.departmentId,
      type: input.type ?? 'fact',
      content: input.content,
      source: 'manual',
      importance: input.importance,
      metadata: input.metadata,
    });
    await this.repo.saveFragment(fragment);

    // Sync to Mem0 as app-level shared (omits agent_id/user_id)
    if (this.mem0?.isEnabled()) {
      try {
        await this.mem0.addDeptShared({
          messages: [
            { role: 'user', content: input.content },
            { role: 'assistant', content: `已记住（部门共享）：${input.content}` },
          ],
          appId: `app_${input.departmentId}`,
          orgId: store.tenantId,
          projectId: input.departmentId,
          metadata: {
            storeId: input.storeId,
            type: fragment.type,
            source: 'manual',
            scope: 'dept_shared',
            departmentId: input.departmentId,
          },
        });
        logger.info(
          { fragmentId: fragment.id, departmentId: input.departmentId },
          '[memory-service] synced dept-shared fragment to Mem0 (app-level)'
        );
      } catch (err) {
        logger.warn(
          { err: String(err) },
          '[memory-service] Mem0 addDeptShared failed, local DB write succeeded'
        );
      }
    }

    // Update store counters
    const totalFragments = await this.repo.countFragmentsByStore(input.storeId);
    const totalProfiles = await this.repo.countDistinctUsersByStore(input.storeId);
    await this.repo.saveStore({ ...store, totalFragments, totalProfiles });

    return fragment;
  }

  /* ──── Rule ──── */

  async listRules(storeId: string, opts?: { ruleType?: MemoryRuleType }): Promise<MemoryRule[]> {
    return this.repo.listRules(storeId, opts);
  }

  async createRule(input: {
    storeId: string;
    tenantId: string;
    ruleType: MemoryRuleType;
    name: string;
    description?: string;
    trigger?: MemoryRule['trigger'];
    action?: MemoryRule['action'];
    priority?: number;
    enabled?: boolean;
  }): Promise<MemoryRule> {
    const rule = createMemoryRule({
      memoryStoreId: input.storeId,
      tenantId: input.tenantId,
      ruleType: input.ruleType,
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      action: input.action,
      priority: input.priority,
      enabled: input.enabled,
    });
    await this.repo.saveRule(rule);
    return rule;
  }

  async updateRule(
    ruleId: string,
    patch: Partial<
      Pick<MemoryRule, 'name' | 'description' | 'trigger' | 'action' | 'priority' | 'enabled'>
    >
  ): Promise<MemoryRule> {
    const rule = await this.repo.findRuleById(ruleId);
    if (!rule) throw new Error(`rule not found: ${ruleId}`);
    const updated: MemoryRule = { ...rule, ...patch };
    await this.repo.saveRule(updated);
    return updated;
  }

  async deleteRule(ruleId: string): Promise<void> {
    const rule = await this.repo.findRuleById(ruleId);
    if (!rule) throw new Error(`rule not found: ${ruleId}`);
    await this.repo.deleteRule(ruleId);
  }

  /* ──── Search (三通道: Mem0 + 本地关键词 + WeKnora向量) ──── */

  async search(
    storeId: string,
    query: string,
    opts?: { userId?: string; topK?: number }
  ): Promise<MemorySearchResult> {
    const store = await this.repo.findStoreById(storeId);
    if (!store) throw new Error(`memory store not found: ${storeId}`);

    const config = store.retrievalConfig;
    const topK = opts?.topK ?? config.topK;
    const hits: Map<string, MemorySearchHit> = new Map();

    // Channel 0: Mem0 三层检索（个人 / agent 共享 / 部门共享），解决 PRD 6.5 缺口
    let mem0Used = false;
    if (this.mem0?.isEnabled()) {
      mem0Used = true;
      const deptId = await this.getDepartmentIdByStore(store);
      const layers: Array<{
        name: 'personal' | 'agent' | 'dept';
        boost: number;
        params: Mem0SearchParams;
      }> = [
        {
          name: 'personal',
          boost: 1.0,
          params: {
            query,
            userId: opts?.userId,
            agentId: store.instanceId,
            orgId: store.tenantId,
            projectId: deptId ?? undefined,
            limit: topK * 2,
          },
        },
        {
          name: 'agent',
          boost: 0.85,
          params: {
            query,
            agentId: store.instanceId,
            orgId: store.tenantId,
            projectId: deptId ?? undefined,
            limit: topK * 2,
          },
        },
      ];
      if (deptId) {
        layers.push({
          name: 'dept',
          boost: 0.7,
          params: {
            query,
            appId: `app_${deptId}`,
            orgId: store.tenantId,
            projectId: deptId,
            limit: topK * 2,
          },
        });
      }
      for (const layer of layers) {
        try {
          const mem0Result = await this.mem0.search(layer.params);
          for (const m of mem0Result.results) {
            const mem0Score = (m.score ?? 0.5) * layer.boost;
            const existing = hits.get(m.id);
            if (existing) {
              if (mem0Score > existing.score) {
                existing.score = mem0Score;
                existing.vectorScore = m.score;
              }
              // 更窄的层优先标记 origin
              if (layer.name === 'personal') existing.origin = 'personal';
              else if (!existing.origin) existing.origin = layer.name;
            } else {
              hits.set(m.id, {
                fragmentId: m.id,
                userId: m.user_id,
                type: this.inferTypeFromCategories(m.categories),
                content: m.memory,
                importance: 5,
                score: mem0Score,
                vectorScore: m.score,
                source: 'auto_extracted',
                origin: layer.name,
                createdAt: m.created_at,
              });
            }
          }
        } catch (err) {
          logger.warn(
            { err: String(err), layer: layer.name },
            '[memory-service] Mem0 search layer failed'
          );
        }
      }
    }

    // Channel 1: Keyword (local DB)
    let keywordUsed = false;
    if (config.useKeywordSearch) {
      keywordUsed = true;
      const keywordResults = await this.repo.keywordSearch(storeId, query, {
        userId: opts?.userId,
        topK: topK * 2,
        memoryTypes: config.memoryTypes.length > 0 ? config.memoryTypes : undefined,
      });
      for (const r of keywordResults) {
        const weightedScore = r.keywordScore * config.keywordWeight;
        const existing = hits.get(r.id);
        if (existing) {
          // Merge: take the higher weighted score
          existing.keywordScore = r.keywordScore;
          if (weightedScore > existing.score) {
            existing.score = weightedScore;
          }
        } else {
          hits.set(r.id, {
            fragmentId: r.id,
            userId: r.userId,
            type: r.type,
            content: r.content,
            importance: r.importance,
            score: weightedScore,
            keywordScore: r.keywordScore,
            source: r.source,
            createdAt: r.createdAt,
          });
        }
        // Increment access count
        await this.repo.incrementFragmentAccess(r.id).catch(() => {});
      }
    }

    // Channel 2: Vector (WeKnora)
    let vectorUsed = false;
    if (config.useVectorSearch && this.knowledgeService) {
      vectorUsed = true;
      try {
        const vectorResults = await this.knowledgeService.search(store.tenantId, query, []);
        for (const hit of vectorResults) {
          const vectorScore = hit.score * config.vectorWeight;
          const existing = hits.get(hit.knowledgeId);
          if (existing) {
            existing.vectorScore = hit.score;
            if (vectorScore > existing.score) {
              existing.score = vectorScore;
            }
          } else {
            hits.set(hit.knowledgeId, {
              fragmentId: hit.knowledgeId,
              userId: '',
              type: 'fact',
              content: hit.content,
              importance: 5,
              score: vectorScore,
              vectorScore: hit.score,
              source: 'auto_extracted',
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch {
        // Vector search failure should not block other channels
      }
    }

    // Sort by score, take topK
    const sorted = Array.from(hits.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      hits: sorted,
      total: sorted.length,
      channels: { keyword: keywordUsed || mem0Used, vector: vectorUsed || mem0Used },
    };
  }

  /* ──── Verify Retrieval ──── */

  async verifyRetrieval(
    storeId: string,
    testQuery: string,
    opts?: { userId?: string; topK?: number }
  ): Promise<MemorySearchResult & { query: string }> {
    const result = await this.search(storeId, testQuery, opts);
    return { ...result, query: testQuery };
  }

  /* ──── Helpers ──── */

  /**
   * 通过 store.instanceId 反查数字员工的 departmentId，作为 Mem0 project_id。
   * 本期部门隔离落到 project_id（一个部门可含多个 agent）。
   */
  private async getDepartmentIdByStore(store: MemoryStore): Promise<string | null> {
    if (!this.instanceRepo) return null;
    const inst = await this.instanceRepo.findById(store.instanceId);
    return inst?.departmentId ?? null;
  }

  private inferTypeFromCategories(categories?: string[]): FragmentType {
    if (!categories || categories.length === 0) return 'fact';
    const cat = categories[0].toLowerCase();
    if (cat.includes('prefer') || cat.includes('like')) return 'preference';
    if (cat.includes('feedback') || cat.includes('review')) return 'feedback';
    if (cat.includes('summary') || cat.includes('session')) return 'interaction_summary';
    return 'fact';
  }
}
