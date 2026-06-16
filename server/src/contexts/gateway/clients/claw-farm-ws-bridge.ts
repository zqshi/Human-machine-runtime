import { EventEmitter } from 'node:events';
import { logger } from '../../../app/logger.js';
import type { ClawFarmClient } from './claw-farm-client.js';

export interface WsBridgeMessage {
  type: string;
  from?: string;
  to?: string;
  content?: string;
  channelId?: string;
  instanceId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface UpstreamConnection {
  ws: WebSocket;
  userId: string;
  instanceId: string;
  createdAt: number;
  lastPingAt: number;
  reconnectAttempts: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_MS = 2_000;
const PING_INTERVAL_MS = 30_000;
const CONNECTION_IDLE_MS = 300_000;

export class ClawFarmWsBridge extends EventEmitter {
  private connections = new Map<string, UpstreamConnection>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private clawFarmClient: ClawFarmClient) {
    super();
  }

  start(): void {
    this.pingTimer = setInterval(() => this.sweepConnections(), PING_INTERVAL_MS);
  }

  stop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    for (const [key, conn] of this.connections) {
      this.closeUpstream(key, conn, 1000, 'bridge shutting down');
    }
    this.connections.clear();
  }

  async connect(userId: string, instanceId: string, authToken?: string): Promise<string> {
    const key = this.connectionKey(userId, instanceId);
    const existing = this.connections.get(key);
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      return key;
    }

    const wsUrl = this.buildWsUrl(instanceId, authToken);
    const ws = new WebSocket(wsUrl);
    const conn: UpstreamConnection = {
      ws,
      userId,
      instanceId,
      createdAt: Date.now(),
      lastPingAt: Date.now(),
      reconnectAttempts: 0,
    };

    ws.addEventListener('open', () => {
      logger.info({ userId, instanceId }, 'claw-farm WS upstream connected');
      conn.reconnectAttempts = 0;
      this.emit('upstream:open', key);
    });

    ws.addEventListener('message', (event) => {
      conn.lastPingAt = Date.now();
      try {
        const data = typeof event.data === 'string' ? event.data : String(event.data);
        const parsed = JSON.parse(data) as WsBridgeMessage;
        parsed.instanceId = instanceId;
        this.emit('message', key, parsed);
      } catch {
        this.emit('message', key, {
          type: 'raw',
          content: String(event.data),
          instanceId,
        } as WsBridgeMessage);
      }
    });

    ws.addEventListener('close', (event) => {
      logger.info({ userId, instanceId, code: event.code }, 'claw-farm WS upstream closed');
      this.emit('upstream:close', key, event.code);
      this.maybeReconnect(key, conn, authToken);
    });

    ws.addEventListener('error', () => {
      logger.warn({ userId, instanceId }, 'claw-farm WS upstream error');
    });

    this.connections.set(key, conn);
    return key;
  }

  send(connectionKey: string, message: WsBridgeMessage): boolean {
    const conn = this.connections.get(connectionKey);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false;
    conn.ws.send(JSON.stringify(message));
    return true;
  }

  disconnect(userId: string, instanceId: string): void {
    const key = this.connectionKey(userId, instanceId);
    const conn = this.connections.get(key);
    if (conn) {
      conn.reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
      this.closeUpstream(key, conn, 1000, 'client disconnected');
    }
  }

  getConnectionState(userId: string, instanceId: string): string {
    const key = this.connectionKey(userId, instanceId);
    const conn = this.connections.get(key);
    if (!conn) return 'disconnected';
    switch (conn.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      default:
        return 'disconnected';
    }
  }

  get activeConnectionCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.ws.readyState === WebSocket.OPEN) count++;
    }
    return count;
  }

  private connectionKey(userId: string, instanceId: string): string {
    return `${userId}:${instanceId}`;
  }

  private buildWsUrl(instanceId: string, authToken?: string): string {
    const base = this.clawFarmClient.getWebSocketUrl();
    const url = new URL(base);
    url.searchParams.set('instanceId', instanceId);
    if (authToken) url.searchParams.set('token', authToken);
    return url.toString();
  }

  private maybeReconnect(key: string, conn: UpstreamConnection, authToken?: string): void {
    if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.connections.delete(key);
      this.emit('upstream:failed', key, 'max reconnect attempts reached');
      return;
    }

    conn.reconnectAttempts++;
    const delay = RECONNECT_BASE_MS * 2 ** (conn.reconnectAttempts - 1);
    logger.info(
      { key, attempt: conn.reconnectAttempts, delayMs: delay },
      'scheduling claw-farm WS reconnect'
    );

    setTimeout(() => {
      if (!this.connections.has(key)) return;
      this.connect(conn.userId, conn.instanceId, authToken).catch((err) => {
        logger.error({ key, err: String(err) }, 'claw-farm WS reconnect failed');
      });
    }, delay);
  }

  private closeUpstream(key: string, conn: UpstreamConnection, code: number, reason: string): void {
    try {
      if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
        conn.ws.close(code, reason);
      }
    } catch {
      // ignore close errors
    }
    this.connections.delete(key);
  }

  private sweepConnections(): void {
    const now = Date.now();
    for (const [key, conn] of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        if (now - conn.lastPingAt > CONNECTION_IDLE_MS) {
          logger.info({ key }, 'closing idle claw-farm WS connection');
          this.closeUpstream(key, conn, 1000, 'idle timeout');
          continue;
        }
        try {
          conn.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // will trigger close event
        }
      } else if (conn.ws.readyState === WebSocket.CLOSED) {
        this.connections.delete(key);
      }
    }
  }
}
