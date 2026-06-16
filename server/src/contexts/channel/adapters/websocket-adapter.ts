import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  ChannelConversation,
  ChannelStatus,
  InboundMessage,
} from '../channel-adapter.js';

export type WebSocketSendFn = (roomId: string, payload: unknown) => void;

export class WebSocketChannelAdapter implements IChannelAdapter {
  readonly channelType = 'websocket' as const;
  readonly supportsInbound = true;
  private sendFn: WebSocketSendFn | null = null;
  private inboundHandlers: Array<(msg: InboundMessage) => void> = [];

  setSendFunction(fn: WebSocketSendFn): void {
    this.sendFn = fn;
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
    if (!this.sendFn) {
      throw new Error('WebSocket send function not configured');
    }
    this.sendFn(target.roomId, {
      type: 'message',
      channelType: 'websocket',
      roomId: target.roomId,
      content: message.content,
      messageType: message.type,
      metadata: message.metadata,
      timestamp: new Date().toISOString(),
    });
  }

  async getStatus(): Promise<ChannelStatus> {
    return {
      channelType: 'websocket',
      connected: this.sendFn !== null,
    };
  }

  async listConversations(_userId: string): Promise<ChannelConversation[]> {
    return [];
  }
}
