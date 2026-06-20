import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  ChannelConversation,
  ChannelStatus,
  InboundMessage,
} from '../channel-adapter.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../app/logger.js';
import { parseSyncResponse } from './matrix-sync-parser.js';

/** /sync 长轮询：服务端等待时长 + 失败退避 */
const SYNC_SERVER_TIMEOUT_MS = 20_000;
const SYNC_BACKOFF_MS = 5_000;

export class MatrixChannelAdapter implements IChannelAdapter {
  readonly channelType = 'matrix' as const;
  readonly supportsInbound = true;
  private readonly homeserverUrl: string;
  private readonly botAccessToken: string;
  private readonly botUserId: string;
  private inboundHandlers: Array<(msg: InboundMessage) => void> = [];
  private since = '';
  private syncing = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.homeserverUrl = config.matrix.homeserverUrl;
    this.botAccessToken = config.matrix.botAccessToken;
    this.botUserId = config.matrix.botUserId;
  }

  // ── 入站：/sync 长轮询 ───────────────────────────────────────────

  onInboundMessage(handler: (msg: InboundMessage) => void): () => void {
    this.inboundHandlers.push(handler);
    this.startSync();
    return () => {
      this.inboundHandlers = this.inboundHandlers.filter((h) => h !== handler);
    };
  }

  private emitInbound(msg: InboundMessage): void {
    for (const h of this.inboundHandlers) {
      try {
        h(msg);
      } catch (err) {
        logger.warn({ err: String(err) }, 'matrix inbound handler error');
      }
    }
  }

  /** 启动 /sync 长轮询（幂等；未配置 token 则跳过，避免无效请求） */
  private startSync(): void {
    if (this.syncing) return;
    if (!this.botAccessToken) return;
    this.syncing = true;
    void this.syncLoop().catch((err) => {
      this.syncing = false;
      logger.warn({ err: String(err) }, 'matrix sync loop crashed');
    });
  }

  private async syncLoop(): Promise<void> {
    while (this.syncing && this.inboundHandlers.length > 0) {
      try {
        const url = new URL(`${this.homeserverUrl}/_matrix/client/v3/sync`);
        url.searchParams.set('timeout', String(SYNC_SERVER_TIMEOUT_MS));
        if (this.since) url.searchParams.set('since', this.since);
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.botAccessToken}` },
          signal: AbortSignal.timeout(SYNC_SERVER_TIMEOUT_MS + 5_000),
        });
        if (!res.ok) {
          logger.warn({ status: res.status }, 'matrix /sync non-ok, backing off');
          await this.backoff();
          continue;
        }
        const json = await res.json();
        const parsed = parseSyncResponse(json, this.botUserId);
        this.since = parsed.nextBatch || this.since;
        for (const msg of parsed.messages) this.emitInbound(msg);
      } catch (err) {
        logger.warn({ err: String(err) }, 'matrix /sync error, backing off');
        await this.backoff();
      }
    }
    this.syncing = false;
  }

  private backoff(): Promise<void> {
    return new Promise((resolve) => {
      this.syncTimer = setTimeout(resolve, SYNC_BACKOFF_MS);
    });
  }

  /** 停止入站同步（应用关闭 / 测试用） */
  stop(): void {
    this.syncing = false;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
  }

  // ── 出站 ─────────────────────────────────────────────────────────

  async sendMessage(target: ChannelTarget, message: ChannelMessage): Promise<void> {
    const txnId = `hmr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
