import { describe, it, expect, vi } from 'vitest';
import { WebSocketChannelAdapter } from './websocket-adapter.js';
import type { InboundMessage } from '../channel-adapter.js';

function makeInbound(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: 'msg-1',
    channelType: 'websocket',
    sender: { id: 'u1', channel: 'websocket' },
    roomId: 'room-1',
    content: 'hello',
    contentType: 'text',
    receivedAt: new Date(),
    ...overrides,
  };
}

describe('WebSocketChannelAdapter', () => {
  describe('sendMessage', () => {
    it('throws if sendFn not configured', async () => {
      const adapter = new WebSocketChannelAdapter();
      await expect(
        adapter.sendMessage(
          { channelType: 'websocket', roomId: 'r1' },
          { type: 'text', content: 'hi' }
        )
      ).rejects.toThrow('WebSocket send function not configured');
    });

    it('calls sendFn with structured payload', async () => {
      const adapter = new WebSocketChannelAdapter();
      const sendFn = vi.fn();
      adapter.setSendFunction(sendFn);

      await adapter.sendMessage(
        { channelType: 'websocket', roomId: 'r1' },
        { type: 'text', content: 'hello' }
      );

      expect(sendFn).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          type: 'message',
          content: 'hello',
          roomId: 'r1',
        })
      );
    });
  });

  describe('getStatus', () => {
    it('reports disconnected when no sendFn', async () => {
      const adapter = new WebSocketChannelAdapter();
      const status = await adapter.getStatus();
      expect(status.connected).toBe(false);
    });

    it('reports connected when sendFn set', async () => {
      const adapter = new WebSocketChannelAdapter();
      adapter.setSendFunction(vi.fn());
      const status = await adapter.getStatus();
      expect(status.connected).toBe(true);
    });
  });

  describe('onInboundMessage', () => {
    it('registers handler and emits messages', () => {
      const adapter = new WebSocketChannelAdapter();
      const handler = vi.fn();
      adapter.onInboundMessage(handler);

      const msg = makeInbound();
      adapter.emitInbound(msg);

      expect(handler).toHaveBeenCalledWith(msg);
    });

    it('supports multiple handlers', () => {
      const adapter = new WebSocketChannelAdapter();
      const h1 = vi.fn();
      const h2 = vi.fn();
      adapter.onInboundMessage(h1);
      adapter.onInboundMessage(h2);

      adapter.emitInbound(makeInbound());

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('unsubscribe removes only that handler', () => {
      const adapter = new WebSocketChannelAdapter();
      const h1 = vi.fn();
      const h2 = vi.fn();
      const unsub = adapter.onInboundMessage(h1);
      adapter.onInboundMessage(h2);

      unsub();
      adapter.emitInbound(makeInbound());

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });
  });
});
