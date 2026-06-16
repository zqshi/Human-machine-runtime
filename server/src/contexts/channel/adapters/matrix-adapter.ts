import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  ChannelConversation,
  ChannelStatus,
} from '../channel-adapter.js';
import { config } from '../../../config/index.js';

export class MatrixChannelAdapter implements IChannelAdapter {
  readonly channelType = 'matrix' as const;
  readonly supportsInbound = false;
  private homeserverUrl: string;
  private botAccessToken: string;

  constructor() {
    this.homeserverUrl = config.matrix.homeserverUrl;
    this.botAccessToken = config.matrix.botAccessToken;
  }

  async sendMessage(target: ChannelTarget, message: ChannelMessage): Promise<void> {
    const txnId = `dcf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const body =
      message.type === 'rich_text'
        ? {
            msgtype: 'm.notice',
            body: message.content,
            format: 'org.matrix.custom.html',
            formatted_body: message.content,
          }
        : { msgtype: 'm.text', body: message.content };

    const res = await fetch(
      `${this.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(target.roomId)}/send/m.room.message/${txnId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.botAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      throw new Error(`Matrix send failed: ${res.status}`);
    }
  }

  async getStatus(): Promise<ChannelStatus> {
    if (!this.botAccessToken) {
      return { channelType: 'matrix', connected: false, error: 'Not configured' };
    }
    try {
      const res = await fetch(`${this.homeserverUrl}/_matrix/client/v3/account/whoami`, {
        headers: { Authorization: `Bearer ${this.botAccessToken}` },
        signal: AbortSignal.timeout(5_000),
      });
      return { channelType: 'matrix', connected: res.ok };
    } catch (err) {
      return {
        channelType: 'matrix',
        connected: false,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }

  async listConversations(_userId: string): Promise<ChannelConversation[]> {
    if (!this.botAccessToken) return [];
    try {
      const res = await fetch(`${this.homeserverUrl}/_matrix/client/v3/joined_rooms`, {
        headers: { Authorization: `Bearer ${this.botAccessToken}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { joined_rooms?: string[] };
      return (data.joined_rooms ?? []).map((roomId) => ({
        id: roomId,
        channelType: 'matrix',
        name: roomId,
      }));
    } catch {
      return [];
    }
  }
}
