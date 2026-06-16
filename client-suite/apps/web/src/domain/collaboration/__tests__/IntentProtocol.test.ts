import { describe, it, expect } from 'vitest';
import { IntentProtocol, type IntentDescriptor } from '../IntentProtocol';

const makeDescriptor = (type: string): IntentDescriptor => ({
  type,
  description: `${type} intent`,
  requiredParams: ['input'],
  optionalParams: [],
  expectedOutputType: 'text',
  maxLatencyMs: 5000,
});

describe('IntentProtocol', () => {
  it('registers and retrieves an agent', () => {
    const proto = new IntentProtocol();
    const reg = proto.register('agent-1', [makeDescriptor('code-review')]);
    expect(reg.agentId).toBe('agent-1');
    expect(reg.intents).toHaveLength(1);
    expect(proto.getRegistration('agent-1')).toBeDefined();
    expect(proto.registeredAgentCount).toBe(1);
  });

  it('unregister removes agent', () => {
    const proto = new IntentProtocol();
    proto.register('agent-1', [makeDescriptor('code-review')]);
    const removed = proto.unregister('agent-1');
    expect(removed).toBe(true);
    expect(proto.getRegistration('agent-1')).toBeUndefined();
    expect(proto.registeredAgentCount).toBe(0);
  });

  it('unregister returns false for non-existent agent', () => {
    const proto = new IntentProtocol();
    expect(proto.unregister('no-such')).toBe(false);
  });

  it('findHandlers returns matching registrations', () => {
    const proto = new IntentProtocol();
    proto.register('agent-1', [makeDescriptor('code-review'), makeDescriptor('deploy')]);
    proto.register('agent-2', [makeDescriptor('code-review')]);
    proto.register('agent-3', [makeDescriptor('translate')]);
    const handlers = proto.findHandlers('code-review');
    expect(handlers).toHaveLength(2);
    const ids = handlers.map((h) => h.agentId);
    expect(ids).toContain('agent-1');
    expect(ids).toContain('agent-2');
  });

  it('getDescriptor returns specific intent', () => {
    const proto = new IntentProtocol();
    proto.register('agent-1', [makeDescriptor('code-review'), makeDescriptor('deploy')]);
    const desc = proto.getDescriptor('agent-1', 'deploy');
    expect(desc).toBeDefined();
    expect(desc!.type).toBe('deploy');
  });

  it('getDescriptor returns undefined for unknown', () => {
    const proto = new IntentProtocol();
    expect(proto.getDescriptor('no-agent', 'x')).toBeUndefined();
  });

  it('totalIntentTypes counts unique types', () => {
    const proto = new IntentProtocol();
    proto.register('agent-1', [makeDescriptor('code-review'), makeDescriptor('deploy')]);
    proto.register('agent-2', [makeDescriptor('code-review')]);
    expect(proto.totalIntentTypes).toBe(2);
  });

  it('getAllRegistrations returns all', () => {
    const proto = new IntentProtocol();
    proto.register('a1', [makeDescriptor('x')]);
    proto.register('a2', [makeDescriptor('y')]);
    expect(proto.getAllRegistrations()).toHaveLength(2);
  });

  it('createMessage produces pending message', () => {
    const msg = IntentProtocol.createMessage({
      type: 'code-review',
      fromAgentId: 'a1',
      toAgentId: 'a2',
      params: { file: 'main.ts' },
      priority: 'high',
    });
    expect(msg.status).toBe('pending');
    expect(msg.id).toMatch(/^intent-/);
    expect(msg.type).toBe('code-review');
  });

  it('completeMessage sets status to completed', () => {
    const msg = IntentProtocol.createMessage({
      type: 'x',
      fromAgentId: 'a1',
      toAgentId: 'a2',
      params: {},
      priority: 'normal',
    });
    const done = IntentProtocol.completeMessage(msg, { ok: true });
    expect(done.status).toBe('completed');
    expect(done.result).toEqual({ ok: true });
    expect(done.respondedAt).toBeGreaterThan(0);
  });

  it('rejectMessage and expireMessage set correct status', () => {
    const msg = IntentProtocol.createMessage({
      type: 'x',
      fromAgentId: 'a1',
      toAgentId: 'a2',
      params: {},
      priority: 'low',
    });
    const rejected = IntentProtocol.rejectMessage(msg, 'not supported');
    expect(rejected.status).toBe('rejected');
    expect(rejected.error).toBe('not supported');

    const expired = IntentProtocol.expireMessage(msg);
    expect(expired.status).toBe('expired');
  });
});
