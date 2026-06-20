/**
 * parseSyncResponse — Matrix /sync 响应 → InboundMessage[] + nextBatch 纯函数。
 *
 * 从 joined rooms 的 timeline 中筛选 m.room.message 事件，过滤 bot 自身消息，
 * 映射为运行时可消费的 InboundMessage。抽离自 adapter 以便单测与复用。
 * 不依赖网络，输入输出确定。
 */

import type { InboundMessage } from '../channel-adapter.js';

export interface ParsedSync {
  messages: InboundMessage[];
  nextBatch: string;
}

interface MatrixSyncResp {
  next_batch?: unknown;
  rooms?: { join?: Record<string, { timeline?: { events?: unknown[] } }> };
}

interface MatrixEvent {
  type?: unknown;
  sender?: unknown;
  event_id?: unknown;
  origin_server_ts?: unknown;
  room_id?: unknown;
  content?: { msgtype?: unknown; body?: unknown };
}

export function parseSyncResponse(response: unknown, botUserId: string): ParsedSync {
  const resp = (response ?? {}) as MatrixSyncResp;
  const nextBatch = typeof resp.next_batch === 'string' ? resp.next_batch : '';
  const messages: InboundMessage[] = [];

  const joined = resp.rooms?.join;
  if (!joined || typeof joined !== 'object') return { messages, nextBatch };

  for (const [roomId, room] of Object.entries(joined)) {
    const events = room?.timeline?.events;
    if (!Array.isArray(events)) continue;
    for (const ev of events) {
      const parsed = parseMessageEvent(ev, roomId, botUserId);
      if (parsed) messages.push(parsed);
    }
  }
  return { messages, nextBatch };
}

function parseMessageEvent(ev: unknown, roomId: string, botUserId: string): InboundMessage | null {
  if (!ev || typeof ev !== 'object') return null;
  const e = ev as MatrixEvent;

  if (e.type !== 'm.room.message') return null;
  if (typeof e.sender !== 'string' || e.sender === botUserId) return null;
  if (typeof e.content?.body !== 'string') return null;

  const ts = typeof e.origin_server_ts === 'number' ? e.origin_server_ts : Date.now();
  return {
    id: typeof e.event_id === 'string' ? e.event_id : `${e.sender}:${roomId}:${ts}`,
    channelType: 'matrix',
    sender: { id: e.sender, channel: 'matrix' },
    roomId,
    content: e.content.body,
    contentType: e.content.msgtype === 'm.notice' ? 'rich_text' : 'text',
    rawPayload: ev,
    receivedAt: new Date(ts),
  };
}
