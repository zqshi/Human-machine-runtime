import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  ChannelConversation,
  ChannelStatus,
  InboundMessage,
} from '../channel-adapter.js';
import type { ContainerOrchestratorClient } from '../../gateway/clients/container-orchestrator-client.js';
import { logger } from '../../../app/logger.js';

export class WpsChannelAdapter implements IChannelAdapter {
  readonly channelType = 'wps' as const;
  readonly supportsInbound = true;
  private farmClient: ContainerOrchestratorClient;
  private inboundHandlers: Array<(msg: InboundMessage) => void> = [];

  constructor(farmClient: ContainerOrchestratorClient) {
    this.farmClient = farmClient;
  }

  onInboundMessage(handler: (msg: InboundMessage) => void): () => void {
    this.inboundHandlers.push(handler);
    return () => {
      this.inboundHandlers = this.inboundHandlers.filter((h) => h !== handler);
    };
  }

  emitInbound(msg: InboundMessage): void {
    for (const handler of this.inboundHandlers) {
      handler(msg);
    }
  }

  async sendMessage(target: ChannelTarget, message: ChannelMessage): Promise<void> {
    if (!this.farmClient.isConfigured()) return;
    const wpsMessage = {
      content: message.content,
      type: message.type === 'card' ? 'card' : 'text',
      replyTo: message.metadata?.replyTo as string | undefined,
    };
    await this.farmClient.sendMessage(target.roomId, wpsMessage);
  }

  async getStatus(): Promise<ChannelStatus> {
    if (!this.farmClient.isConfigured()) {
      return {
        channelType: 'wps',
        connected: false,
        error: 'container-orchestrator not configured',
      };
    }
    try {
      await this.farmClient.listChannels();
      return { channelType: 'wps', connected: true };
    } catch (err) {
      return {
        channelType: 'wps',
        connected: false,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }

  async listConversations(_userId: string): Promise<ChannelConversation[]> {
    if (!this.farmClient.isConfigured()) return [];
    try {
      const channels = (await this.farmClient.listChannels()) as Array<{
        id: string;
        name?: string;
      }>;
      return channels.map((ch) => ({
        id: ch.id,
        channelType: 'wps',
        name: ch.name ?? ch.id,
      }));
    } catch (err) {
      logger.warn({ err }, 'wps listConversations failed, returning empty');
      return [];
    }
  }
}
