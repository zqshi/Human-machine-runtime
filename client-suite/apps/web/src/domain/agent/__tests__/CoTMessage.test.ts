import { describe, it, expect } from 'vitest';
import { CoTMessage } from '../CoTMessage';
import type { CoTMessageProps, CoTStep } from '../CoTMessage';
import type { MessageBlock } from '../MessageBlock';

function makeProps(overrides?: Partial<CoTMessageProps>): CoTMessageProps {
  return {
    id: 'msg-1',
    agentId: 'agent-a',
    sessionId: 'session-1',
    role: 'agent',
    text: 'Hello',
    timestamp: 1000,
    ...overrides,
  };
}

describe('CoTMessage', () => {
  it('creates from props', () => {
    const msg = CoTMessage.create(makeProps());
    expect(msg.id).toBe('msg-1');
    expect(msg.role).toBe('agent');
    expect(msg.text).toBe('Hello');
  });

  it('withText returns new instance with updated text', () => {
    const msg = CoTMessage.create(makeProps());
    const updated = msg.withText('World');
    expect(updated.text).toBe('World');
    expect(msg.text).toBe('Hello');
    expect(updated.id).toBe(msg.id);
  });

  it('appendText appends to existing text', () => {
    const msg = CoTMessage.create(makeProps({ text: 'A' }));
    const updated = msg.appendText('B');
    expect(updated.text).toBe('AB');
  });

  it('withHtml sets html field', () => {
    const msg = CoTMessage.create(makeProps());
    const updated = msg.withHtml('<b>bold</b>');
    expect(updated.html).toBe('<b>bold</b>');
    expect(msg.html).toBeUndefined();
  });

  it('withSteps replaces cotSteps', () => {
    const steps: CoTStep[] = [{ id: 's1', label: 'Step 1', status: 'done', detail: 'ok' }];
    const msg = CoTMessage.create(makeProps());
    const updated = msg.withSteps(steps);
    expect(updated.cotSteps).toEqual(steps);
    expect(msg.cotSteps).toBeUndefined();
  });

  it('appendBlock adds to blocks array', () => {
    const block: MessageBlock = { type: 'task-card', taskId: 't1' };
    const msg = CoTMessage.create(makeProps());
    const updated = msg.appendBlock(block);
    expect(updated.blocks).toHaveLength(1);
    expect(updated.blocks![0]).toEqual(block);
    expect(msg.blocks).toBeUndefined();
  });

  it('appendBlock appends to existing blocks', () => {
    const b1: MessageBlock = { type: 'task-card', taskId: 't1' };
    const b2: MessageBlock = { type: 'task-card', taskId: 't2' };
    const msg = CoTMessage.create(makeProps({ blocks: [b1] }));
    const updated = msg.appendBlock(b2);
    expect(updated.blocks).toHaveLength(2);
    expect(updated.blocks![0]).toEqual(b1);
    expect(updated.blocks![1]).toEqual(b2);
  });

  it('withBlocks replaces all blocks', () => {
    const b1: MessageBlock = { type: 'task-card', taskId: 't1' };
    const msg = CoTMessage.create(makeProps({ blocks: [b1] }));
    const updated = msg.withBlocks([]);
    expect(updated.blocks).toEqual([]);
  });

  it('withAttachments sets attachments', () => {
    const att = [
      {
        id: 'a1',
        type: 'file' as const,
        name: 'test.pdf',
        url: '/f',
        size: 100,
        mimeType: 'application/pdf',
      },
    ];
    const msg = CoTMessage.create(makeProps());
    const updated = msg.withAttachments(att);
    expect(updated.attachments).toEqual(att);
  });

  it('immutability — original instance is never modified', () => {
    const msg = CoTMessage.create(makeProps({ text: 'original' }));
    msg.withText('changed');
    msg.appendText(' more');
    msg.appendBlock({ type: 'task-card', taskId: 'x' } as MessageBlock);
    expect(msg.text).toBe('original');
    expect(msg.blocks).toBeUndefined();
  });
});
