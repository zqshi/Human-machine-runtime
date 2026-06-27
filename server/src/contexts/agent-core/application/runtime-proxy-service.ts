/**
 * RuntimeProxyService — IRuntimeProxyService 首个实现(T47 后 MatrixBot 对话闭环接通)。
 *
 * MatrixBot.processChannelMessage(runtime_proxy 模式)调 runtimeProxyService.invoke(instanceId, {input, ...})
 * 期望返回对话回复。本实现:取 MatrixConversationStore 按 roomId 存的多轮历史 → ChatService.chat
 * 调 LLM(persona/guardrail/LiteLLM)生成回复 → 回填 InvokeResult.response.output,并 append 历史。
 *
 * 这是 Matrix bot 的"大脑":消息始终走 Matrix 协议(MatrixChannelAdapter /sync 收 / sendMessage 发),
 * 本 service 只负责生成回复内容。不绑 IM:仅 bot 对话触发的房间有历史,未对话房间零成本。
 */
import type {
  IRuntimeProxyService,
  InvokePayload,
  InvokeResult,
} from '../../../integrations/matrix/matrix-bot-types.js';
import type { ChatService } from './chat-service.js';
import type { MatrixConversationStore } from './matrix-conversation-store.js';

export class RuntimeProxyService implements IRuntimeProxyService {
  constructor(
    private readonly chatService: ChatService,
    private readonly conversationStore: MatrixConversationStore
  ) {}

  async invoke(instanceId: string, payload: InvokePayload): Promise<InvokeResult> {
    const history = this.conversationStore.getHistory(payload.roomId);

    const result = await this.chatService.chat(instanceId, payload.input, {
      history,
      userId: payload.sender || 'matrix-bot',
      sessionId: payload.roomId,
      traceSource: 'matrix-bot',
      tenantId: 'unknown', // IM opt-in 不绑定账号/房间,归户精度待后续从 instance 查
    });

    // 成功(含 guardrail blocked:reply 为拒答话术)→ 回填 output + 追加历史
    if (result.ok && result.reply) {
      this.conversationStore.append(payload.roomId, 'user', payload.input);
      this.conversationStore.append(payload.roomId, 'assistant', result.reply);
      return {
        mode: 'runtime_proxy',
        response: { output: result.reply, model: result.model },
      };
    }

    // 失败(503 未配置 / 403 未授权 / 502 调用失败)→ degraded,回填错误话术
    // MatrixBot.extractAssistantText 取 response.output 显示给用户(故障暴露非假数据)
    return {
      mode: 'degraded',
      response: { output: result.reason || '对话服务暂不可用' },
    };
  }
}
