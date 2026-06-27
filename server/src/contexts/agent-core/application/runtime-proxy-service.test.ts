import { describe, it, expect, vi } from 'vitest';
import { RuntimeProxyService } from './runtime-proxy-service.js';
import type { ChatService, ChatResult } from './chat-service.js';
import { MatrixConversationStore } from './matrix-conversation-store.js';

function makeChat(result: ChatResult) {
  return {
    chat: vi.fn(async () => result),
  } as unknown as ChatService;
}

const basePayload = {
  input: '你好',
  source: 'matrix',
  sender: '@alice:localhost',
  roomId: '!room1:localhost',
  channel: 'matrix',
};

describe('RuntimeProxyService', () => {
  it('成功返 runtime_proxy + output,追加 user+assistant 历史', async () => {
    const store = new MatrixConversationStore();
    const svc = new RuntimeProxyService(
      makeChat({ ok: true, status: 200, reply: '你好,我是Alice', model: 'glm-4-flash' }),
      store
    );
    const out = await svc.invoke('inst_1', basePayload);
    expect(out.mode).toBe('runtime_proxy');
    expect(out.response?.output).toBe('你好,我是Alice');
    expect(store.getHistory('!room1:localhost')).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好,我是Alice' },
    ]);
  });

  it('chat 传 history(来自 store)与 userId=sender', async () => {
    const store = new MatrixConversationStore();
    store.append('!room1:localhost', 'user', '我叫张三');
    const chat = makeChat({ ok: true, status: 200, reply: '记得' });
    const svc = new RuntimeProxyService(chat, store);
    await svc.invoke('inst_1', basePayload);
    expect(chat.chat).toHaveBeenCalledWith(
      'inst_1',
      '你好',
      expect.objectContaining({
        history: [{ role: 'user', content: '我叫张三' }],
        userId: '@alice:localhost',
        sessionId: '!room1:localhost',
        traceSource: 'matrix-bot',
      })
    );
  });

  it('guardrail blocked(reply=拒答话术)仍按成功路径回填+追加历史', async () => {
    const store = new MatrixConversationStore();
    const svc = new RuntimeProxyService(
      makeChat({ ok: true, status: 200, reply: '薪资问题不回答', blocked: true }),
      store
    );
    const out = await svc.invoke('inst_1', basePayload);
    expect(out.mode).toBe('runtime_proxy');
    expect(out.response?.output).toBe('薪资问题不回答');
    expect(store.getHistory('!room1:localhost')).toHaveLength(2);
  });

  it('未配置(503)返 degraded + 错误话术,不追加历史', async () => {
    const store = new MatrixConversationStore();
    const svc = new RuntimeProxyService(
      makeChat({ ok: false, status: 503, reason: 'LiteLLM 未配置,对话服务不可用' }),
      store
    );
    const out = await svc.invoke('inst_1', basePayload);
    expect(out.mode).toBe('degraded');
    expect(out.response?.output).toBe('LiteLLM 未配置,对话服务不可用');
    expect(store.getHistory('!room1:localhost')).toEqual([]);
  });

  it('未授权(403)返 degraded + reason', async () => {
    const svc = new RuntimeProxyService(
      makeChat({ ok: false, status: 403, reason: 'not granted' }),
      new MatrixConversationStore()
    );
    const out = await svc.invoke('inst_1', basePayload);
    expect(out.mode).toBe('degraded');
    expect(out.response?.output).toBe('not granted');
  });

  it('调用失败(502)返 degraded + 错误话术', async () => {
    const svc = new RuntimeProxyService(
      makeChat({ ok: false, status: 502, reason: '对话服务调用失败' }),
      new MatrixConversationStore()
    );
    const out = await svc.invoke('inst_1', basePayload);
    expect(out.mode).toBe('degraded');
    expect(out.response?.output).toBe('对话服务调用失败');
  });

  it('多轮:第二轮 history 含第一轮 user+assistant', async () => {
    const store = new MatrixConversationStore();
    const chat = makeChat({ ok: true, status: 200, reply: '回复1' });
    const svc = new RuntimeProxyService(chat, store);
    await svc.invoke('inst_1', { ...basePayload, input: '第一轮' });
    await svc.invoke('inst_1', { ...basePayload, input: '第二轮' });
    // 第二轮调用时传的 history 应含第一轮 user+assistant
    const secondCall = (chat.chat as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(secondCall[2].history).toEqual([
      { role: 'user', content: '第一轮' },
      { role: 'assistant', content: '回复1' },
    ]);
  });
});
