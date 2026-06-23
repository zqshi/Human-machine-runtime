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
import {
  CircuitBreaker,
  CircuitOpenError,
  retryWithBackoff,
  withTimeout,
  type CircuitBreakerOptions,
} from '../../../shared/resilience.js';

/** /sync 长轮询:服务端等待时长 + 单次 fetch 超时 + 连续失败退避 */
const SYNC_SERVER_TIMEOUT_MS = 20_000;
const SYNC_FETCH_TIMEOUT_MS = SYNC_SERVER_TIMEOUT_MS + 5_000;
const SYNC_BREAKER_RESET_MS = 30_000;

/** 出站调用超时 */
const SEND_TIMEOUT_MS = 10_000;
const STATUS_TIMEOUT_MS = 5_000;
const LIST_TIMEOUT_MS = 5_000;

/**
 * Matrix 渠道适配器:用 retryWithBackoff + CircuitBreaker + withTimeout 包裹所有出/入站 fetch,
 * 替代原裸 fetch + 固定 5s backoff,提升对 Conduit / homeserver 抖动的韧性。
 */
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

  /** per-homeserver 熔断器:连续失败 N 次 → 开 30s,半开放探测 */
  private readonly breaker: CircuitBreaker;
  private readonly breakerOptions: Required<
    Pick<CircuitBreakerOptions, 'failureThreshold' | 'resetTimeoutMs' | 'halfOpenSuccessThreshold'>
  >;

  constructor(opts?: {
    breaker?: CircuitBreaker;
    breakerOptions?: Partial<CircuitBreakerOptions>;
  }) {
    this.homeserverUrl = config.matrix.homeserverUrl;
    this.botAccessToken = config.matrix.botAccessToken;
    this.botUserId = config.matrix.botUserId;
    this.breakerOptions = {
      failureThreshold: opts?.breakerOptions?.failureThreshold ?? 5,
      resetTimeoutMs: opts?.breakerOptions?.resetTimeoutMs ?? SYNC_BREAKER_RESET_MS,
      halfOpenSuccessThreshold: opts?.breakerOptions?.halfOpenSuccessThreshold ?? 2,
    };
    this.breaker = opts?.breaker ?? new CircuitBreaker(this.breakerOptions);
  }

  // ── 入站:/sync 长轮询 ───────────────────────────────────────────

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

  /** 启动 /sync 长轮询(幂等;未配置 token 则跳过,避免无效请求) */
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
        await this.breaker.execute(() => this.fetchSyncOnce());
      } catch (err) {
        if (err instanceof CircuitOpenError) {
          // 熔断打开:暂停 SYNC_BREAKER_RESET_MS 后让 breaker 自然进入 half-open
          logger.warn(
            { breakerResetMs: this.breakerOptions.resetTimeoutMs },
            'matrix sync circuit open, pausing'
          );
          await this.sleep(this.breakerOptions.resetTimeoutMs);
        } else {
          logger.warn({ err: String(err) }, 'matrix /sync error, backing off');
          // 指数退避 1s→2s→4s (上限 8s),jitter 在 retryWithBackoff 内部已应用
          await this.sleep(1_000);
        }
      }
    }
    this.syncing = false;
  }

  private async fetchSyncOnce(): Promise<void> {
    const url = new URL(`${this.homeserverUrl}/_matrix/client/v3/sync`);
    url.searchParams.set('timeout', String(SYNC_SERVER_TIMEOUT_MS));
    if (this.since) url.searchParams.set('since', this.since);

    const res = await withTimeout(
      retryWithBackoff(
        async () => {
          const r = await fetch(url, {
            headers: { Authorization: `Bearer ${this.botAccessToken}` },
            signal: AbortSignal.timeout(SYNC_FETCH_TIMEOUT_MS),
          });
          if (!r.ok) throw new Error(`sync http ${r.status}`);
          return r;
        },
        {
          maxAttempts: 3,
          baseDelayMs: 500,
          maxDelayMs: 4_000,
          shouldRetry: (err) =>
            !/http 4\d\d/.test(err instanceof Error ? err.message : String(err)),
        }
      ),
      SYNC_FETCH_TIMEOUT_MS
    );

    const json = await res.json();
    const parsed = parseSyncResponse(json, this.botUserId);
    this.since = parsed.nextBatch || this.since;
    for (const msg of parsed.messages) this.emitInbound(msg);
  }

  /** 停止入站同步(应用关闭 / 测试用) */
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

    const url = `${this.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(target.roomId)}/send/m.room.message/${txnId}`;

    try {
      await this.breaker.execute(() =>
        withTimeout(
          retryWithBackoff(
            async () => {
              const r = await fetch(url, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${this.botAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
              });
              if (!r.ok) throw new Error(`Matrix send failed: ${r.status}`);
            },
            {
              maxAttempts: 3,
              baseDelayMs: 500,
              shouldRetry: (err) => {
                const msg = err instanceof Error ? err.message : String(err);
                // 4xx(权限/参数错误)不重试
                return !/failed: 4\d\d/.test(msg);
              },
            }
          ),
          SEND_TIMEOUT_MS
        )
      );
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        throw new Error('Matrix send failed: circuit breaker open', { cause: err });
      }
      throw err;
    }
  }

  async getStatus(): Promise<ChannelStatus> {
    if (!this.botAccessToken) {
      return { channelType: 'matrix', connected: false, error: 'Not configured' };
    }
    try {
      return await this.breaker.execute(async () => {
        const res = await withTimeout(
          fetch(`${this.homeserverUrl}/_matrix/client/v3/account/whoami`, {
            headers: { Authorization: `Bearer ${this.botAccessToken}` },
            signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
          }),
          STATUS_TIMEOUT_MS
        );
        return { channelType: 'matrix', connected: res.ok };
      });
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        return { channelType: 'matrix', connected: false, error: 'circuit open' };
      }
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
      return await this.breaker.execute(async () => {
        const res = await withTimeout(
          fetch(`${this.homeserverUrl}/_matrix/client/v3/joined_rooms`, {
            headers: { Authorization: `Bearer ${this.botAccessToken}` },
            signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
          }),
          LIST_TIMEOUT_MS
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { joined_rooms?: string[] };
        return (data.joined_rooms ?? []).map((roomId) => ({
          id: roomId,
          channelType: 'matrix',
          name: roomId,
        }));
      });
    } catch {
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.syncTimer = setTimeout(resolve, ms);
    });
  }
}
