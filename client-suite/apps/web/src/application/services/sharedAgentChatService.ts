/**
 * sharedAgentChatService —— IM 模式内共享 Agent 对话入口（薄 seams）
 *
 * IM 模式下点击无 Matrix 账号的共享 Agent「对话」时调用：在 IM 主题内打开
 * 对话视图（SharedAgentChatView），复用 OpenClaw 的对话收发能力（useAgentChat
 * + openclawStore），不切 appMode/dock，不跳 Almighty 工作面板。
 *
 * TODO(runtime-port): 当前直接绑定 openclawStore（openclaw 运行时）。
 * 后续「openclaw 可替换运行时 / Agent 定义与运行分离」任务应将此处的对话
 * 能力抽象为 AgentRuntimePort 接口，届时仅替换本 service 的实现即可，
 * IM 侧（SharedAgentChatView + AgentsHub）无需改动。
 */
import { useOpenClawStore } from '../stores/openclawStore';
import { useUIStore } from '../stores/uiStore';

export const sharedAgentChatService = {
  /**
   * 在 IM 模式内打开与某共享 Agent 的对话。
   *
   * IM 模式未走 openclawStore.initialize()（该初始化拉通知/事件等 OC 专属数据，
   * 仅在 appMode==='openclaw' 时由 WorkspacePage 触发）。此处先调幂等的
   * initConversation() 准备对话状态机（sessionId + primary 对话 + 持久化恢复），
   * 再 startSharedAgentChat 切到 `shared-${agentId}` 对话上下文。
   *
   * @param agentId 共享 Agent id
   * @param name Agent 显示名（注入 _sharedAgentMeta，供会话标题使用）
   */
  open(agentId: string, name: string): void {
    const oc = useOpenClawStore.getState();
    oc.initConversation();
    oc.setSharedAgentMeta(agentId, name);
    oc.startSharedAgentChat(agentId);
    useUIStore.getState().setImChatAgentId(agentId);
  },

  /** 关闭 IM 内共享 Agent 对话，回到 Agent Team 列表 */
  close(): void {
    useUIStore.getState().setImChatAgentId(null);
  },
};
