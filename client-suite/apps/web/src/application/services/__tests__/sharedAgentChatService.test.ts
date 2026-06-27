import { describe, it, expect, vi } from 'vitest';

/**
 * T20b-A:openInstalledInstance 是 marketplace「安装即对话」的前端入口。
 * 用 vi.mock 隔离 cockpitStore/uiStore,避免触发真实 store 初始化副作用
 * (cockpitStore import 链会读 localStorage,测试环境无)。
 *
 * 核心断言:复用 open 的对话上下文 + 设 activeInstanceId(让 useAgentChat chat
 * 请求带真 instanceId → cockpit chat route 拉 persona/apiKey 真响应)。
 */
const mocks = vi.hoisted(() => ({
  setActiveInstanceId: vi.fn(),
  initConversation: vi.fn(),
  setSharedAgentMeta: vi.fn(),
  startSharedAgentChat: vi.fn(),
  setImChatAgentId: vi.fn(),
}));

vi.mock('../../stores/cockpitStore', () => ({
  useCockpitStore: {
    getState: () => ({
      initConversation: mocks.initConversation,
      setSharedAgentMeta: mocks.setSharedAgentMeta,
      startSharedAgentChat: mocks.startSharedAgentChat,
      setActiveInstanceId: mocks.setActiveInstanceId,
    }),
  },
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({ setImChatAgentId: mocks.setImChatAgentId }),
  },
}));

import { sharedAgentChatService } from '../sharedAgentChatService';

describe('sharedAgentChatService - openInstalledInstance (T20b-A)', () => {
  it('调 open + setActiveInstanceId(instanceId)', () => {
    // spy open 避免其内部副作用(initConversation/startSharedAgentChat)干扰断言
    const openSpy = vi.spyOn(sharedAgentChatService, 'open').mockImplementation(() => {});
    mocks.setActiveInstanceId.mockClear();

    sharedAgentChatService.openInstalledInstance('inst-1', '客服助手');

    expect(openSpy).toHaveBeenCalledWith('inst-1', '客服助手');
    expect(mocks.setActiveInstanceId).toHaveBeenCalledWith('inst-1');

    openSpy.mockRestore();
  });
});
