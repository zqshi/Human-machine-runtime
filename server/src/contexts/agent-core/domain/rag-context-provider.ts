import type { ILLMClient, ChatMessage } from './agent-executor.js';

/**
 * RAG 上下文召回接口 — agent 执行前自动召回知识库 + 员工记忆,注入 prompt。
 *
 * 设计动机(v1.2.2 / D2):knowledge 与 employee-memory 检索能力已就绪,但 agent 执行时
 * 不自动召回(仅 Matrix 命令手动查)。本接口让 Harness 在 dispatchTask 前组装 RAG 上下文。
 *
 * 跨聚合边界(§1.3):本接口在 agent-core domain 定义,不直接 import knowledge/employee-memory
 * context。依赖通过最小 port 接口(KnowledgeSearchPort / MemorySearchPort)注入,bootstrap 用真实
 * service 实现。LLM 判断是否召回复用 ILLMClient(同 AgentExecutor 模式)。
 */

/** 知识库检索 port — knowledge context 的最小契约子集 */
export interface KnowledgeSearchPort {
  /** 按 tenantId 检索知识库(返回 title+content+score) */
  search(
    tenantId: string,
    query: string,
    kbIds?: string[],
    opts?: { topK?: number; scoreThreshold?: number }
  ): Promise<Array<{ title: string; content: string; score: number }>>;
}

/** 员工记忆检索 port — employee-memory context 的最小契约子集 */
export interface MemorySearchPort {
  /** 按 instanceId 查 memory store 存在性(不存在则该实例无记忆可召回) */
  getStoreByInstance(instanceId: string): Promise<{ id: string } | null>;
  /** 按 storeId 检索记忆(返回 content+来源+score) */
  search(
    storeId: string,
    query: string,
    opts?: { userId?: string; topK?: number }
  ): Promise<{
    hits: Array<{ content: string; origin?: string; score: number }>;
    total: number;
  }>;
}

/** 召回请求 — 从 AgentTaskInput 提取的召回定位信息 */
export interface RagRecallRequest {
  tenantId: string;
  /** 数字员工实例 ID(定位该召回谁的 memory;缺则只召回 knowledge) */
  instanceId?: string;
  /** 用户 prompt(作为检索 query) */
  prompt: string;
}

/** 召回结果 — 注入到 worker prompt 的 RAG 上下文块;空字符串表示无召回 */
export interface RagContext {
  /** 拼好的 RAG 上下文块(知识 + 记忆),空则不注入 */
  context: string;
  /** 召回来源统计(诊断/审计) */
  sources: { knowledge: number; memory: number };
  /** 是否跳过(LLM 判定无需召回 或 依赖未配置) */
  skipped: boolean;
}

/**
 * RAG 上下文召回器。
 *
 * 流程:
 *   1. 若 knowledgePort/memoryPort 均未注入 → skipped
 *   2. 若 llmClient 可用 → 判断 prompt 是否需召回(yes/no);不可用 → 默认召回
 *   3. 需召回 → 并行调 knowledge + memory(若 instanceId 有 store)
 *   4. 合并为结构化 context 块
 *
 * 容错:任何召回失败 log warn 不抛(不阻断主链路)。
 */
export interface IRagContextProvider {
  /** 召回 RAG 上下文。失败/未配置返回 skipped RagContext,绝不抛错。 */
  getRagContext(req: RagRecallRequest): Promise<RagContext>;
}

const RECALL_JUDGE_SYSTEM_PROMPT = `你是召回判断器。判断用户 prompt 是否需要检索知识库/历史记忆来辅助回答。
判断为是的场景:询问产品/流程/政策/历史事实/他人信息;需要参考资料。
判断为否的场景:闲聊/简单指令/纯执行(如"运行这段代码"/"帮我写个函数")。
只回答一个字:需要 回 "yes",不需要 回 "no"。`;

const NO_RECALL: RagContext = { context: '', sources: { knowledge: 0, memory: 0 }, skipped: true };

export class RagContextProvider implements IRagContextProvider {
  constructor(
    private readonly knowledgePort: KnowledgeSearchPort | null,
    private readonly memoryPort: MemorySearchPort | null,
    private readonly llmClient: ILLMClient | null,
    private readonly logger: { warn: (msg: string) => void }
  ) {}

  async getRagContext(req: RagRecallRequest): Promise<RagContext> {
    // 两个 port 都没注入(私有化未配 knowledge + mem0)→ 直接跳过,无需 LLM 判断
    if (!this.knowledgePort && !this.memoryPort) {
      return NO_RECALL;
    }

    // LLM 判断是否召回(不可用则默认召回,保证有知识时尽量召回)
    const shouldRecall = await this.judgeRecall(req.prompt);
    if (!shouldRecall) {
      return NO_RECALL;
    }

    // 并行召回 knowledge + memory(各自容错)
    const [knowledgeHits, memoryHits] = await Promise.all([
      this.recallKnowledge(req).catch(() => []),
      this.recallMemory(req).catch(() => []),
    ]);

    if (knowledgeHits.length === 0 && memoryHits.length === 0) {
      return NO_RECALL;
    }

    const context = this.formatContext(knowledgeHits, memoryHits);
    return {
      context,
      sources: { knowledge: knowledgeHits.length, memory: memoryHits.length },
      skipped: false,
    };
  }

  private async judgeRecall(prompt: string): Promise<boolean> {
    if (!this.llmClient || !this.llmClient.isAvailable) {
      return true; // LLM 不可用 → 默认召回(宁可有噪声也不漏召回)
    }
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: RECALL_JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: prompt.slice(0, 1000) },
      ];
      const result = await this.llmClient.chatCompletion(messages, { maxTokens: 5 });
      const answer = (result?.content ?? '').trim().toLowerCase();
      return answer.startsWith('yes') || answer.startsWith('需要') || answer === 'y';
    } catch (err) {
      this.logger.warn(`recall judge failed: ${err instanceof Error ? err.message : String(err)}`);
      return true; // 判断失败 → 默认召回
    }
  }

  private async recallKnowledge(
    req: RagRecallRequest
  ): Promise<Array<{ title: string; content: string; score: number }>> {
    if (!this.knowledgePort) return [];
    const hits = await this.knowledgePort.search(req.tenantId, req.prompt, undefined, { topK: 3 });
    return hits.slice(0, 3);
  }

  private async recallMemory(
    req: RagRecallRequest
  ): Promise<Array<{ content: string; origin?: string; score: number }>> {
    if (!this.memoryPort || !req.instanceId) return [];
    const store = await this.memoryPort.getStoreByInstance(req.instanceId);
    if (!store) return [];
    const result = await this.memoryPort.search(store.id, req.prompt, { topK: 3 });
    return result.hits.slice(0, 3);
  }

  private formatContext(
    knowledgeHits: Array<{ title: string; content: string; score: number }>,
    memoryHits: Array<{ content: string; origin?: string; score: number }>
  ): string {
    const lines: string[] = [];
    if (knowledgeHits.length > 0) {
      lines.push('【知识库参考】');
      for (const h of knowledgeHits) {
        lines.push(`- [${h.title}] ${h.content}`);
      }
    }
    if (memoryHits.length > 0) {
      lines.push('');
      lines.push('【相关记忆】');
      for (const m of memoryHits) {
        const tag = m.origin ? `[${m.origin}]` : '';
        lines.push(`- ${tag} ${m.content}`);
      }
    }
    return lines.join('\n');
  }
}
