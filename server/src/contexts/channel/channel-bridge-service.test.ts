import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { ChannelBridgeService } from './channel-bridge-service.js';
import { InboundPipeline } from './inbound-pipeline.js';
import type {
  ContainerOrchestratorWsBridge,
  WsBridgeMessage,
} from '../gateway/clients/container-orchestrator-ws-bridge.js';

function makeMockWsBridge(): ContainerOrchestratorWsBridge & EventEmitter {
  const emitter = new EventEmitter() as ContainerOrchestratorWsBridge & EventEmitter;
  emitter.connect = vi.fn().mockResolvedValue('u1:inst1');
  emitter.disconnect = vi.fn();
  emitter.send = vi.fn().mockReturnValue(true);
  return emitter;
}

describe('ChannelBridgeService', () => {
  let bridge: ReturnType<typeof makeMockWsBridge>;
  let pipeline: InboundPipeline;
  let service: ChannelBridgeService;

  beforeEach(() => {
    bridge = makeMockWsBridge();
    pipeline = new InboundPipeline();
    service = new ChannelBridgeService(bridge, pipeline);
  });

  describe('session management', () => {
    it('openSession creates and stores session', async () => {
      const session = await service.openSession('u1', 'inst1', ['websocket', 'matrix']);
      expect(session.userId).toBe('u1');
      expect(session.instanceId).toBe('inst1');
      expect(session.connectionKey).toBe('u1:inst1');
      expect(session.channels).toEqual(['websocket', 'matrix']);
      expect(service.activeSessionCount).toBe(1);
    });

    it('getSession returns stored session', async () => {
      await service.openSession('u1', 'inst1', ['websocket']);
      const s = service.getSession('u1', 'inst1');
      expect(s).toBeDefined();
      expect(s?.userId).toBe('u1');
    });

    it('closeSession removes session and disconnects bridge', () => {
      service['sessions'].set('u1:inst1', {
        userId: 'u1',
        instanceId: 'inst1',
        connectionKey: 'u1:inst1',
        channels: ['websocket'],
        createdAt: Date.now(),
      });

      service.closeSession('u1', 'inst1');
      expect(bridge.disconnect).toHaveBeenCalledWith('u1', 'inst1');
      expect(service.activeSessionCount).toBe(0);
    });

    it('upstream:close event removes session', async () => {
      await service.openSession('u1', 'inst1', ['websocket']);
      expect(service.activeSessionCount).toBe(1);

      bridge.emit('upstream:close', 'u1:inst1');
      expect(service.activeSessionCount).toBe(0);
    });
  });

  describe('sendToUpstream', () => {
    it('delegates to wsBridge.send', () => {
      const msg: WsBridgeMessage = { type: 'text', content: 'hello' };
      const result = service.sendToUpstream('u1:inst1', msg);
      expect(bridge.send).toHaveBeenCalledWith('u1:inst1', msg);
      expect(result).toBe(true);
    });
  });

  describe('inbound message forwarding', () => {
    it('routes upstream message through inbound pipeline', async () => {
      const handler = vi.fn();
      pipeline.use(handler);

      await service.openSession('u1', 'inst1', ['websocket']);

      const msg: WsBridgeMessage = { type: 'text', content: 'from upstream', instanceId: 'inst1' };
      bridge.emit('message', 'u1:inst1', msg);

      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());

      const inbound = handler.mock.calls[0][0];
      expect(inbound.channelType).toBe('websocket');
      expect(inbound.sender.id).toBe('u1');
      expect(inbound.roomId).toBe('inst1');
      expect(inbound.content).toBe('from upstream');
      expect(inbound.contentType).toBe('text');
      expect(inbound.rawPayload).toEqual(msg);
      expect(inbound.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('maps non-text type to rich_text', async () => {
      const handler = vi.fn();
      pipeline.use(handler);

      await service.openSession('u1', 'inst1', ['websocket']);

      bridge.emit('message', 'u1:inst1', { type: 'card', content: '<card/>' });

      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
      expect(handler.mock.calls[0][0].contentType).toBe('rich_text');
    });

    it('ignores messages for unknown sessions', () => {
      const handler = vi.fn();
      pipeline.use(handler);

      bridge.emit('message', 'unknown:key', { type: 'text', content: 'orphan' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('handles empty content gracefully', async () => {
      const handler = vi.fn();
      pipeline.use(handler);

      await service.openSession('u1', 'inst1', ['websocket']);
      bridge.emit('message', 'u1:inst1', { type: 'text' });

      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
      expect(handler.mock.calls[0][0].content).toBe('');
    });
  });
});
