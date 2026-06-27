import { describe, it, expect, vi } from 'vitest';
import { ChannelService } from './channel-service.js';
import { InboundPipeline } from './inbound-pipeline.js';
import type {
  IChannelAdapter,
  ChannelTarget,
  ChannelMessage,
  InboundMessage,
} from './channel-adapter.js';

function mockAdapter(type: string, connected = true): IChannelAdapter {
  return {
    channelType: type,
    supportsInbound: false,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ channelType: type, connected }),
    listConversations: vi.fn().mockResolvedValue([
      {
        id: `room_${type}_1`,
        channelType: type,
        name: `Room ${type}`,
        lastMessageAt: new Date(),
      },
    ]),
  };
}

function mockInboundAdapter(
  type: string
): IChannelAdapter & { emitInbound(msg: InboundMessage): void } {
  const handlers: Array<(msg: InboundMessage) => void> = [];
  return {
    channelType: type,
    supportsInbound: true,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ channelType: type, connected: true }),
    listConversations: vi.fn().mockResolvedValue([]),
    onInboundMessage(handler: (msg: InboundMessage) => void) {
      handlers.push(handler);
      return () => {
        handlers.splice(handlers.indexOf(handler), 1);
      };
    },
    emitInbound(msg: InboundMessage) {
      for (const h of handlers) h(msg);
    },
  };
}

describe('ChannelService', () => {
  it('registers and lists channel types', () => {
    const svc = new ChannelService();
    svc.registerAdapter(mockAdapter('matrix'));
    svc.registerAdapter(mockAdapter('wps'));
    expect(svc.listChannelTypes()).toEqual(['matrix', 'wps']);
  });

  it('sends message to the correct adapter', async () => {
    const svc = new ChannelService();
    const matrix = mockAdapter('matrix');
    svc.registerAdapter(matrix);

    const target: ChannelTarget = { channelType: 'matrix', roomId: '!room:test' };
    const msg: ChannelMessage = { type: 'text', content: 'hello' };
    await svc.sendToChannel(target, msg);

    expect(matrix.sendMessage).toHaveBeenCalledWith(target, msg);
  });

  it('throws for unknown channel type', async () => {
    const svc = new ChannelService();
    const target: ChannelTarget = { channelType: 'unknown', roomId: 'room' };
    await expect(svc.sendToChannel(target, { type: 'text', content: 'x' })).rejects.toThrow(
      'No adapter registered'
    );
  });

  it('matrix 入站消息走 matrixInboundHandler(不进 pipeline)', async () => {
    const svc = new ChannelService();
    const matrix = mockInboundAdapter('matrix');
    const pipelineHandler = vi.fn(async () => {});
    const pipeline = new InboundPipeline();
    pipeline.use(pipelineHandler);
    svc.setInboundPipeline(pipeline);
    const matrixHandler = vi.fn(async () => {});
    svc.setMatrixInboundHandler(matrixHandler);
    svc.registerAdapter(matrix);

    const msg: InboundMessage = {
      id: 'm1',
      channelType: 'matrix',
      sender: { id: '@alice:localhost', channel: 'matrix' },
      roomId: '!room1:localhost',
      content: '你好',
      contentType: 'text',
      receivedAt: new Date(),
    };
    matrix.emitInbound(msg);
    await new Promise((r) => setTimeout(r, 0));

    expect(matrixHandler).toHaveBeenCalledWith(msg);
    expect(pipelineHandler).not.toHaveBeenCalled();
  });

  it('matrix handler 未注入则 fallback 进 pipeline', async () => {
    const svc = new ChannelService();
    const matrix = mockInboundAdapter('matrix');
    const pipelineHandler = vi.fn(async () => {});
    const pipeline = new InboundPipeline();
    pipeline.use(pipelineHandler);
    svc.setInboundPipeline(pipeline);
    svc.registerAdapter(matrix);

    const msg: InboundMessage = {
      id: 'm1',
      channelType: 'matrix',
      sender: { id: '@alice:localhost', channel: 'matrix' },
      roomId: '!room1:localhost',
      content: '你好',
      contentType: 'text',
      receivedAt: new Date(),
    };
    matrix.emitInbound(msg);
    await new Promise((r) => setTimeout(r, 0));

    expect(pipelineHandler).toHaveBeenCalledWith(msg);
  });

  it('非 matrix 消息走 pipeline(不受 matrixHandler 影响)', async () => {
    const svc = new ChannelService();
    const wps = mockInboundAdapter('wps');
    const pipelineHandler = vi.fn(async () => {});
    const pipeline = new InboundPipeline();
    pipeline.use(pipelineHandler);
    svc.setInboundPipeline(pipeline);
    const matrixHandler = vi.fn(async () => {});
    svc.setMatrixInboundHandler(matrixHandler);
    svc.registerAdapter(wps);

    const msg: InboundMessage = {
      id: 'm1',
      channelType: 'wps',
      sender: { id: 'u1', channel: 'wps' },
      roomId: 'r1',
      content: 'hi',
      contentType: 'text',
      receivedAt: new Date(),
    };
    wps.emitInbound(msg);
    await new Promise((r) => setTimeout(r, 0));

    expect(pipelineHandler).toHaveBeenCalledWith(msg);
    expect(matrixHandler).not.toHaveBeenCalled();
  });

  it('matrix handler 抛错不崩(被 catch 不传播)', async () => {
    const svc = new ChannelService();
    const matrix = mockInboundAdapter('matrix');
    const pipeline = new InboundPipeline();
    pipeline.use(vi.fn(async () => {}));
    svc.setInboundPipeline(pipeline);
    svc.setMatrixInboundHandler(vi.fn(async () => Promise.reject(new Error('boom'))));
    svc.registerAdapter(matrix);

    const msg: InboundMessage = {
      id: 'm1',
      channelType: 'matrix',
      sender: { id: '@alice:localhost', channel: 'matrix' },
      roomId: '!room1:localhost',
      content: '你好',
      contentType: 'text',
      receivedAt: new Date(),
    };
    // emitInbound 同步触发 handler(promise),.catch 内部消化,不应抛
    expect(() => matrix.emitInbound(msg)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('aggregates conversations from all adapters', async () => {
    const svc = new ChannelService();
    svc.registerAdapter(mockAdapter('matrix'));
    svc.registerAdapter(mockAdapter('wps'));

    const convs = await svc.getAggregatedConversations('user1');
    expect(convs).toHaveLength(2);
    expect(convs.map((c) => c.channelType)).toEqual(expect.arrayContaining(['matrix', 'wps']));
  });

  it('gets all statuses', async () => {
    const svc = new ChannelService();
    svc.registerAdapter(mockAdapter('matrix', true));
    svc.registerAdapter(mockAdapter('wps', false));

    const statuses = await svc.getAllStatuses();
    expect(statuses).toHaveLength(2);
    expect(statuses.find((s) => s.channelType === 'matrix')?.connected).toBe(true);
    expect(statuses.find((s) => s.channelType === 'wps')?.connected).toBe(false);
  });

  describe('inbound pipeline binding', () => {
    it('binds adapter registered BEFORE setInboundPipeline', async () => {
      const svc = new ChannelService();
      const adapter = mockInboundAdapter('websocket');
      const pipeline = new InboundPipeline();
      const handler = vi.fn();
      pipeline.use(handler);

      svc.registerAdapter(adapter);
      svc.setInboundPipeline(pipeline);

      const msg: InboundMessage = {
        id: 'x',
        channelType: 'websocket',
        sender: { id: 'u1', channel: 'ws' },
        roomId: 'r1',
        content: 'hi',
        contentType: 'text',
        receivedAt: new Date(),
      };
      adapter.emitInbound(msg);

      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    });

    it('binds adapter registered AFTER setInboundPipeline', async () => {
      const svc = new ChannelService();
      const adapter = mockInboundAdapter('websocket');
      const pipeline = new InboundPipeline();
      const handler = vi.fn();
      pipeline.use(handler);

      svc.setInboundPipeline(pipeline);
      svc.registerAdapter(adapter);

      const msg: InboundMessage = {
        id: 'x',
        channelType: 'websocket',
        sender: { id: 'u1', channel: 'ws' },
        roomId: 'r1',
        content: 'hi',
        contentType: 'text',
        receivedAt: new Date(),
      };
      adapter.emitInbound(msg);

      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    });

    it('does not bind adapters that do not support inbound', () => {
      const svc = new ChannelService();
      const adapter = mockAdapter('matrix');
      const pipeline = new InboundPipeline();
      const handler = vi.fn();
      pipeline.use(handler);

      svc.setInboundPipeline(pipeline);
      svc.registerAdapter(adapter);
      // no emitInbound available, adapter.supportsInbound = false
      // pipeline handler should never fire
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
