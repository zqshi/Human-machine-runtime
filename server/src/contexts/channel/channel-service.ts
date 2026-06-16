import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  ChannelConversation,
  ChannelStatus,
  ChannelType,
} from './channel-adapter.js';
import type { InboundPipeline } from './inbound-pipeline.js';
import { logger } from '../../app/logger.js';

export class ChannelService {
  private adapters = new Map<ChannelType, IChannelAdapter>();
  private inboundPipeline?: InboundPipeline;

  setInboundPipeline(pipeline: InboundPipeline): void {
    this.inboundPipeline = pipeline;
    for (const adapter of this.adapters.values()) {
      this.bindInbound(adapter);
    }
  }

  registerAdapter(adapter: IChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
    this.bindInbound(adapter);
  }

  private bindInbound(adapter: IChannelAdapter): void {
    if (!this.inboundPipeline) return;
    if (!adapter.supportsInbound || !adapter.onInboundMessage) return;
    const pipeline = this.inboundPipeline;
    adapter.onInboundMessage((msg) => {
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
