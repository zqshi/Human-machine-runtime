/**
 * RAG 上下文召回器组装(D2)。
 *
 * 把 knowledgeService / memoryService / agentLlmClient 适配成 agent-core domain 的
 * KnowledgeSearchPort / MemorySearchPort / ILLMClient,注入 RagContextProvider。
 * 任一依赖未配置(knowledgeService=null / mem0 未启用)时仍构造 provider,内部容错跳过。
 *
 * 从 bootstrap.ts 拆出,避免 bootstrap 膨胀(模式同 credentials.ts)。
 */
import { logger } from '../logger.js';
import { RagContextProvider } from '../../contexts/agent-core/domain/rag-context-provider.js';
import type {
  KnowledgeSearchPort,
  MemorySearchPort,
  IRagContextProvider,
} from '../../contexts/agent-core/domain/rag-context-provider.js';
import type { ILLMClient } from '../../contexts/agent-core/domain/agent-executor.js';
import type { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';
import type { MemoryService } from '../../contexts/employee-memory/memory-service.js';

/** 适配 KnowledgeService → KnowledgeSearchPort(只暴露 search,签名兼容) */
function adaptKnowledge(svc: KnowledgeService): KnowledgeSearchPort {
  return {
    async search(tenantId, query, kbIds, opts) {
      const hits = await svc.search(tenantId, query, kbIds, opts);
      return hits.map((h) => ({ title: h.title, content: h.content, score: h.score }));
    },
  };
}

/** 适配 MemoryService → MemorySearchPort(getStoreByInstance + search) */
function adaptMemory(svc: MemoryService): MemorySearchPort {
  return {
    async getStoreByInstance(instanceId) {
      const store = await svc.getStoreByInstance(instanceId);
      return store ? { id: store.id } : null;
    },
    async search(storeId, query, opts) {
      const result = await svc.search(storeId, query, opts);
      return {
        hits: result.hits.map((h) => ({
          content: h.content,
          origin: h.origin,
          score: h.score,
        })),
        total: result.total,
      };
    },
  };
}

/**
 * 构造 RAG 上下文召回器。
 * knowledgeService null(WeKnora 未启用)或 mem0 未配置时,对应 port 为 null,
 * provider 仍可工作(只召回可用的一方,或全 null 时直接 skipped)。
 */
export function buildRagProvider(
  knowledgeService: KnowledgeService | null,
  memoryService: MemoryService,
  agentLlmClient: ILLMClient | null
): IRagContextProvider {
  const knowledgePort = knowledgeService ? adaptKnowledge(knowledgeService) : null;
  // mem0 未配置(API key 未设)时,memoryService.search 内部三通道里 mem0 层会跳过,
  // 仍有本地关键词 + WeKnora 向量层。故 memoryService 始终注入(不判 mem0)。
  const memoryPort = adaptMemory(memoryService);

  return new RagContextProvider(knowledgePort, memoryPort, agentLlmClient, {
    warn: (msg) => logger.warn({ component: 'rag-provider' }, msg),
  });
}
