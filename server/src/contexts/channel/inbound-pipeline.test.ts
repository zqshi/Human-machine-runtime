import { describe, it, expect, vi } from 'vitest';
import { InboundPipeline } from './inbound-pipeline.js';
import type { InboundMessage } from './channel-adapter.js';

function makeMsg(overrides: Partial<InboundMessage> = {}): InboundMessage {
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

describe('InboundPipeline', () => {
  it('calls all handlers in order', async () => {
    const pipeline = new InboundPipeline();
    const order: number[] = [];

    pipeline.use(async () => {
      order.push(1);
    });
    pipeline.use(async () => {
      order.push(2);
    });
    pipeline.use(async () => {
      order.push(3);
    });

    await pipeline.process(makeMsg());
    expect(order).toEqual([1, 2, 3]);
  });

  it('passes message to each handler', async () => {
    const pipeline = new InboundPipeline();
    const received: InboundMessage[] = [];

    pipeline.use(async (msg) => {
      received.push(msg);
    });

    const msg = makeMsg({ content: 'test-content' });
    await pipeline.process(msg);
    expect(received[0].content).toBe('test-content');
  });

  it('aborts pipeline if a handler throws (prevents propagation on inconsistent state)', async () => {
    const pipeline = new InboundPipeline();
    const called = vi.fn();

    pipeline.use(async () => {
      throw new Error('boom');
    });
    pipeline.use(called);

    await expect(pipeline.process(makeMsg())).rejects.toThrow('boom');
    expect(called).not.toHaveBeenCalled();
  });

  it('works with zero handlers', async () => {
    const pipeline = new InboundPipeline();
    await expect(pipeline.process(makeMsg())).resolves.toBeUndefined();
  });
});
