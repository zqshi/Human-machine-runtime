import { describe, it, expect, vi } from 'vitest';
import { RagContextProvider } from './rag-context-provider.js';
import type { KnowledgeSearchPort, MemorySearchPort } from './rag-context-provider.js';
import type { ILLMClient, ChatMessage } from './agent-executor.js';

function makeKnowledge(
  hits: Array<{ title: string; content: string; score: number }>
): KnowledgeSearchPort {
  return {
    search: vi.fn().mockResolvedValue(hits),
  };
}

function makeMemory(
  hits: Array<{ content: string; origin?: string; score: number }>,
  hasStore = true
): MemorySearchPort {
  return {
    getStoreByInstance: vi.fn().mockResolvedValue(hasStore ? { id: 'store-1' } : null),
    search: vi.fn().mockResolvedValue({ hits, total: hits.length }),
  };
}

function makeLlm(answer: string | null, available = true): ILLMClient {
  return {
    isAvailable: available,
    chatCompletion: vi.fn().mockResolvedValue({ content: answer }),
  } as unknown as ILLMClient;
}

function makeLogger() {
  return { warn: vi.fn() };
}

const REQ = { tenantId: 'tn_demo', instanceId: 'inst-1', prompt: '公司的报销流程是什么?' };

describe('RagContextProvider', () => {
  it('两个 port 都 null → skipped(私有化未配 knowledge+mem0)', async () => {
    const svc = new RagContextProvider(null, null, null, makeLogger());
    const rag = await svc.getRagContext(REQ);
    expect(rag.skipped).toBe(true);
    expect(rag.context).toBe('');
  });

  it('LLM 判定 yes → 召回 knowledge + memory 并合并 context', async () => {
    const knowledge = makeKnowledge([{ title: '报销制度', content: '填表提交审批', score: 0.9 }]);
    const memory = makeMemory([{ content: '上次报销 5000', origin: 'personal', score: 0.8 }]);
    const llm = makeLlm('yes');
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext(REQ);

    expect(rag.skipped).toBe(false);
    expect(rag.context).toContain('【知识库参考】');
    expect(rag.context).toContain('报销制度');
    expect(rag.context).toContain('【相关记忆】');
    expect(rag.context).toContain('上次报销 5000');
    expect(rag.sources).toEqual({ knowledge: 1, memory: 1 });
    // LLM 判断调了一次
    expect(llm.chatCompletion).toHaveBeenCalledTimes(1);
    const msgs = (llm.chatCompletion as ReturnType<typeof vi.fn>).mock.calls[0][0] as ChatMessage[];
    expect(msgs[0].role).toBe('system');
  });

  it('LLM 判定 no → skipped(纯指令不召回)', async () => {
    const knowledge = makeKnowledge([{ title: 't', content: 'c', score: 0.9 }]);
    const memory = makeMemory([{ content: 'm', score: 0.8 }]);
    const llm = makeLlm('no');
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext({ ...REQ, prompt: '帮我写个 hello world 函数' });

    expect(rag.skipped).toBe(true);
    expect(knowledge.search).not.toHaveBeenCalled();
    expect(memory.search).not.toHaveBeenCalled();
  });

  it('LLM 不可用 → 默认召回(宁可有噪声不漏)', async () => {
    const knowledge = makeKnowledge([{ title: 't', content: 'c', score: 0.9 }]);
    const memory = makeMemory([]);
    const llm = makeLlm(null, false); // isAvailable=false
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext(REQ);

    expect(rag.skipped).toBe(false);
    expect(knowledge.search).toHaveBeenCalledWith('tn_demo', REQ.prompt, undefined, { topK: 3 });
  });

  it('无 instanceId → 只召回 knowledge,memory 跳过', async () => {
    const knowledge = makeKnowledge([{ title: 't', content: 'c', score: 0.9 }]);
    const memory = makeMemory([]);
    const memorySearch = memory.search as ReturnType<typeof vi.fn>;
    const llm = makeLlm('yes');
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext({ tenantId: 'tn', prompt: '问' }); // 无 instanceId

    expect(rag.skipped).toBe(false);
    expect(rag.sources.knowledge).toBe(1);
    expect(rag.sources.memory).toBe(0);
    expect(memory.getStoreByInstance).not.toHaveBeenCalled();
    expect(memorySearch).not.toHaveBeenCalled();
  });

  it('memory store 不存在(instance 无记忆)→ 只召回 knowledge', async () => {
    const knowledge = makeKnowledge([{ title: 't', content: 'c', score: 0.9 }]);
    const memory = makeMemory([], false); // hasStore=false
    const llm = makeLlm('yes');
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext(REQ);

    expect(rag.sources.knowledge).toBe(1);
    expect(rag.sources.memory).toBe(0);
  });

  it('knowledge 召回抛错 → 容错,只返回 memory(不阻断)', async () => {
    const knowledge: KnowledgeSearchPort = {
      search: vi.fn().mockRejectedValue(new Error('weknora down')),
    };
    const memory = makeMemory([{ content: 'm', score: 0.8 }]);
    const llm = makeLlm('yes');
    const logger = makeLogger();
    const svc = new RagContextProvider(knowledge, memory, llm, logger);
    const rag = await svc.getRagContext(REQ);

    expect(rag.skipped).toBe(false);
    expect(rag.sources.knowledge).toBe(0);
    expect(rag.sources.memory).toBe(1);
  });

  it('召回结果均空 → skipped(无内容注入)', async () => {
    const knowledge = makeKnowledge([]);
    const memory = makeMemory([]);
    const llm = makeLlm('yes');
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext(REQ);

    expect(rag.skipped).toBe(true);
    expect(rag.context).toBe('');
  });

  it('LLM 判断抛错 → 默认召回(降级)', async () => {
    const knowledge = makeKnowledge([{ title: 't', content: 'c', score: 0.9 }]);
    const memory = makeMemory([]);
    const llm: ILLMClient = {
      isAvailable: true,
      chatCompletion: vi.fn().mockRejectedValue(new Error('llm down')),
    } as unknown as ILLMClient;
    const logger = makeLogger();
    const svc = new RagContextProvider(knowledge, memory, llm, logger);
    const rag = await svc.getRagContext(REQ);

    expect(rag.skipped).toBe(false);
    expect(rag.sources.knowledge).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('topK 限制:knowledge 返回 5 条只取 3', async () => {
    const knowledge = makeKnowledge(
      Array.from({ length: 5 }, (_, i) => ({ title: `t${i}`, content: `c${i}`, score: 0.9 }))
    );
    const memory = makeMemory([]);
    const llm = makeLlm('yes');
    const svc = new RagContextProvider(knowledge, memory, llm, makeLogger());
    const rag = await svc.getRagContext(REQ);

    expect(rag.sources.knowledge).toBe(3);
  });
});
