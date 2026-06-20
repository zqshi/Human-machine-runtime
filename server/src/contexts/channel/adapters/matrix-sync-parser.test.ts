import { describe, it, expect } from 'vitest';
import { parseSyncResponse } from './matrix-sync-parser.js';
import type { InboundMessage } from '../channel-adapter.js';

/**
 * parseSyncResponse — Matrix /sync 响应 → InboundMessage[] + nextBatch 纯函数。
 * 抽离自 adapter 以便单测：解析 joined rooms 的 timeline，筛 m.room.message，
 * 过滤 bot 自己发的，映射为运行时可消费的 InboundMessage。
 */

const BOT = '@hmr-bot:localhost';

function msgEvent(opts: {
  sender: string;
  body: string;
  eventId: string;
  roomId?: string;
  msgtype?: string;
  ts?: number;
}) {
  return {
    type: 'm.room.message',
    sender: opts.sender,
    event_id: opts.eventId,
    origin_server_ts: opts.ts ?? 1_700_000_000_000,
    room_id: opts.roomId ?? '!r1:localhost',
    content: { msgtype: opts.msgtype ?? 'm.text', body: opts.body },
  };
}

function memberEvent(sender: string, eventId: string) {
  return {
    type: 'm.room.member',
    sender,
    event_id: eventId,
    origin_server_ts: 1_700_000_000_000,
    room_id: '!r1:localhost',
    content: { membership: 'join' },
  };
}

function syncResp(events: unknown[], nextBatch = 'NB1', roomId = '!r1:localhost') {
  return { next_batch: nextBatch, rooms: { join: { [roomId]: { timeline: { events } } } } };
}

describe('parseSyncResponse', () => {
  it('把 m.room.message 解析为 InboundMessage，字段正确', () => {
    const res = parseSyncResponse(
      syncResp([msgEvent({ sender: '@alice:localhost', body: '生产 API 异常', eventId: '$ev1' })]),
      BOT
    );
    expect(res.messages).toHaveLength(1);
    const m: InboundMessage = res.messages[0];
    expect(m.id).toBe('$ev1');
    expect(m.channelType).toBe('matrix');
    expect(m.content).toBe('生产 API 异常');
    expect(m.sender).toEqual({ id: '@alice:localhost', channel: 'matrix' });
    expect(m.roomId).toBe('!r1:localhost');
    expect(m.contentType).toBe('text');
    expect(m.receivedAt.getTime()).toBe(1_700_000_000_000);
    expect(m.rawPayload).toMatchObject({ type: 'm.room.message' });
  });

  it('过滤 bot 自己发的消息（避免自循环）', () => {
    const res = parseSyncResponse(
      syncResp([
        msgEvent({ sender: '@alice:localhost', body: 'hi', eventId: '$e_alice' }),
        msgEvent({ sender: BOT, body: '我回复', eventId: '$e_bot' }),
      ]),
      BOT
    );
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].sender.id).toBe('@alice:localhost');
  });

  it('过滤非 m.room.message 事件（如 m.room.member）', () => {
    const res = parseSyncResponse(
      syncResp([
        memberEvent('@bob:localhost', '$m1'),
        msgEvent({ sender: '@bob:localhost', body: 'hello', eventId: '$e1' }),
      ]),
      BOT
    );
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].id).toBe('$e1');
  });

  it('多 room 多消息全部解析', () => {
    const resp = {
      next_batch: 'NB2',
      rooms: {
        join: {
          '!r1:localhost': {
            timeline: {
              events: [
                msgEvent({ sender: '@a:l', body: 'a1', eventId: '$1', roomId: '!r1:localhost' }),
              ],
            },
          },
          '!r2:localhost': {
            timeline: {
              events: [
                msgEvent({ sender: '@b:l', body: 'b1', eventId: '$2', roomId: '!r2:localhost' }),
              ],
            },
          },
        },
      },
    };
    const res = parseSyncResponse(resp, BOT);
    expect(res.messages).toHaveLength(2);
    expect(res.messages.map((m) => m.roomId).sort()).toEqual(['!r1:localhost', '!r2:localhost']);
  });

  it('空 rooms / 空 timeline → 0 消息，nextBatch 仍返回', () => {
    expect(parseSyncResponse({ next_batch: 'NB3', rooms: { join: {} } }, BOT).messages).toEqual([]);
    expect(parseSyncResponse({ next_batch: 'NB3', rooms: { join: {} } }, BOT).nextBatch).toBe(
      'NB3'
    );
    expect(
      parseSyncResponse(
        { next_batch: 'NB3', rooms: { join: { '!r:localhost': { timeline: { events: [] } } } } },
        BOT
      ).messages
    ).toEqual([]);
  });

  it('nextBatch 正确提取', () => {
    expect(parseSyncResponse(syncResp([], 'TOKEN_X'), BOT).nextBatch).toBe('TOKEN_X');
  });

  it('msgtype m.notice → contentType rich_text；其他 → text', () => {
    const res = parseSyncResponse(
      syncResp([
        msgEvent({ sender: '@a:l', body: '普通', eventId: '$t', msgtype: 'm.text' }),
        msgEvent({ sender: '@b:l', body: '通知', eventId: '$n', msgtype: 'm.notice' }),
        msgEvent({ sender: '@c:l', body: '表情', eventId: '$e', msgtype: 'm.emote' }),
      ]),
      BOT
    );
    const byId = new Map(res.messages.map((m) => [m.id, m.contentType]));
    expect(byId.get('$t')).toBe('text');
    expect(byId.get('$n')).toBe('rich_text');
    expect(byId.get('$e')).toBe('text');
  });

  it('缺 content.body 或异常结构的事件被跳过（不抛）', () => {
    const res = parseSyncResponse(
      syncResp([
        {
          type: 'm.room.message',
          sender: '@a:l',
          event_id: '$x',
          room_id: '!r1:localhost',
          content: {},
        },
        {
          type: 'm.room.message',
          sender: '@a:l',
          event_id: '$y',
          room_id: '!r1:localhost',
          content: { body: 123 },
        },
      ]),
      BOT
    );
    expect(res.messages).toEqual([]);
  });
});
