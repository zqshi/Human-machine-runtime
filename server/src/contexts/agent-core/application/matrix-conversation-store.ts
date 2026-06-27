/**
 * MatrixConversationStore — Matrix bot 多轮对话历史(后端按 roomId 存)。
 *
 * T49 为前端 chat 修了多轮记忆(前端传 history);Matrix bot 无前端传 history 机制,
 * 由后端按 roomId 维护对话历史。RuntimeProxyService.invoke 前取 history 拼 messages,
 * 回复后 append(user+assistant)。
 *
 * 内存起步(Map):server 重启丢历史(与 dispatch conclusion 内存态同类债,记 backlog 升级 DB:
 * 新建 matrix_conversation_history 表 + migration)。截断最近 20 轮(40 条,对齐 chat.ts sanitizeHistory)。
 *
 * 不做 IM 绑定:仅 IM 模式下 bot 对话的房间有历史;未对话的房间无记录(零成本)。
 */
import type { ChatHistoryMessage } from './chat-service.js';

/** 最近 20 轮(user+assistant 各一)= 40 条上限 */
const MAX_HISTORY = 40;

export class MatrixConversationStore {
  private readonly store = new Map<string, ChatHistoryMessage[]>();

  /** 取 roomId 的对话历史(返回副本,防外部修改内部数组) */
  getHistory(roomId: string): ChatHistoryMessage[] {
    const arr = this.store.get(roomId);
    return arr ? [...arr] : [];
  }

  /** 追加一条消息(user 或 assistant),空/纯空白不存,超限截断保留最近 MAX_HISTORY 条 */
  append(roomId: string, role: 'user' | 'assistant', content: string): void {
    if (!content || !content.trim()) return;
    const arr = this.store.get(roomId) ?? [];
    arr.push({ role, content });
    if (arr.length > MAX_HISTORY) {
      arr.splice(0, arr.length - MAX_HISTORY);
    }
    this.store.set(roomId, arr);
  }

  /** 清空 roomId 历史(测试/管理用) */
  clear(roomId: string): void {
    this.store.delete(roomId);
  }

  /** 当前跟踪的房间数(测试/可观测用) */
  get size(): number {
    return this.store.size;
  }
}
