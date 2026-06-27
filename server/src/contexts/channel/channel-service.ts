import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  ChannelConversation,
  ChannelStatus,
  ChannelType,
  InboundMessage,
} from './channel-adapter.js';
import type { InboundPipeline } from './inbound-pipeline.js';
import { logger } from '../../app/logger.js';

export class ChannelService {
  private adapters = new Map<ChannelType, IChannelAdapter>();
  private inboundPipeline?: InboundPipeline;
  /**
   * Matrix 入站分流 handler:matrix 消息走 bot 对话(不进评分决策 pipeline)。
   * 由 bootstrap 注入(调 matrixBot.processTextMessage + sendToChannel 回发),
   * channel-service 不耦合 MatrixBot(回调注入,守 §1 分层)。
   */
  private matrixInboundHandler?: (msg: InboundMessage) => Promise<void>;

  setInboundPipeline(pipeline: InboundPipeline): void {
    this.inboundPipeline = pipeline;
    for (const adapter of this.adapters.values()) {
      this.bindInbound(adapter);
    }
  }

  /** 注入 Matrix 入站分流 handler(bootstrap 装配 matrixBot 后调用) */
  setMatrixInboundHandler(handler: (msg: InboundMessage) => Promise<void>): void {
    this.matrixInboundHandler = handler;
  }

  registerAdapter(adapter: IChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
    this.bindInbound(adapter);
  }

  private bindInbound(adapter: IChannelAdapter): void {
    if (!this.inboundPipeline && !this.matrixInboundHandler) return;
    if (!adapter.supportsInbound || !adapter.onInboundMessage) return;
    adapter.onInboundMessage((msg) => {
      // matrix 消息走 bot 对话分流(不进评分决策 pipeline);handler 未注入则 fallback 进 pipeline
      if (msg.channelType === 'matrix' && this.matrixInboundHandler) {
        this.matrixInboundHandler(msg).catch((err) => {
          logger.warn(
            { channelType: msg.channelType, err: String(err) },
            'matrix inbound handler error'
          );
        });
        return;
      }
      const pipeline = this.inboundPipeline;
      if (!pipeline) return;
      pipeline.process(msg).catch((err) => {
        logger.warn(
          { channelType: adapter.channelType, err: String(err) },
          'inbound pipeline error from adapter'
        );
      });
    });
  }

  getAdapter(channelType: ChannelType): IChannelAdapter | undefined {
    return this.adapters.get(channelType);
  }

  listChannelTypes(): ChannelType[] {
    return Array.from(this.adapters.keys());
  }

  async sendToChannel(target: ChannelTarget, message: ChannelMessage): Promise<void> {
    const adapter = this.adapters.get(target.channelType);
    if (!adapter) {
      throw new Error(`No adapter registered for channel type "${target.channelType}"`);
    }
    await adapter.sendMessage(target, message);
  }

  async broadcastToUser(userId: string, message: ChannelMessage): Promise<void> {
    const errors: Error[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const conversations = await adapter.listConversations(userId);
        for (const conv of conversations) {
          await adapter.sendMessage(
            { channelType: adapter.channelType, roomId: conv.id, userId },
            message
          );
        }
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    if (errors.length === this.adapters.size && errors.length > 0) {
      throw new AggregateError(errors, 'All channel adapters failed');
    }
  }

  async getAggregatedConversations(userId: string): Promise<ChannelConversation[]> {
    const all: ChannelConversation[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const convs = await adapter.listConversations(userId);
        all.push(...convs);
      } catch (err) {
        logger.warn(
          { channelType: adapter.channelType, err },
          'channel unavailable during conversation aggregation'
        );
      }
    }
    return all.sort((a, b) => {
      const ta = a.lastMessageAt?.getTime() ?? 0;
      const tb = b.lastMessageAt?.getTime() ?? 0;
      return tb - ta;
    });
  }

  async getAllStatuses(): Promise<ChannelStatus[]> {
    const results: ChannelStatus[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        results.push(await adapter.getStatus());
      } catch (err) {
        results.push({
          channelType: adapter.channelType,
          connected: false,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
    return results;
  }
}
