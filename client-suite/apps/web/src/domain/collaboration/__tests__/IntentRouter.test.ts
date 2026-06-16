import { describe, it, expect } from 'vitest';
import { IntentProtocol } from '../IntentProtocol';
import { IntentRouter } from '../IntentRouter';

describe('IntentRouter', () => {
  function setupProtocol() {
    const protocol = new IntentProtocol();
    protocol.register('agent-a', [
      {
        type: 'request_simulation',
        description: '运行模拟',
        requiredParams: ['scenario'],
        optionalParams: [],
        expectedOutputType: 'SimResult',
        maxLatencyMs: 5000,
      },
    ]);
    protocol.register('agent-b', [
      {
        type: 'request_simulation',
        description: '运行模拟',
        requiredParams: ['scenario'],
        optionalParams: ['iterations'],
        expectedOutputType: 'SimResult',
        maxLatencyMs: 3000,
      },
      {
        type: 'draft_response',
        description: '草拟回复',
        requiredParams: ['context'],
        optionalParams: [],
        expectedOutputType: 'DraftResult',
        maxLatencyMs: 2000,
      },
    ]);
    protocol.register('agent-c', [
      {
        type: 'notify_anomaly',
        description: '异常通知',
        requiredParams: ['anomalyId'],
        optionalParams: [],
        expectedOutputType: 'void',
        maxLatencyMs: 1000,
      },
    ]);
    return protocol;
  }

  it('routes to available handler', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);
    const result = router.route('draft_response', 'agent-a');
    expect(result).not.toBeNull();
    expect(result!.targetAgentId).toBe('agent-b');
  });

  it('returns null when no handler exists', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);
    const result = router.route('nonexistent_intent', 'agent-a');
    expect(result).toBeNull();
  });

  it('excludes sender from routing', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);
    const result = router.route('notify_anomaly', 'agent-c');
    expect(result).toBeNull();
  });

  it('selects best agent based on load scores', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);

    router.updateLoad({
      agentId: 'agent-a',
      pendingIntents: 8,
      avgResponseMs: 4000,
      successRate: 0.6,
    });
    router.updateLoad({
      agentId: 'agent-b',
      pendingIntents: 1,
      avgResponseMs: 1000,
      successRate: 0.95,
    });

    const result = router.route('request_simulation', 'agent-c');
    expect(result).not.toBeNull();
    expect(result!.targetAgentId).toBe('agent-b');
    expect(result!.scores.length).toBe(2);
  });

  it('dispatch creates routed message', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);

    const msg = IntentProtocol.createMessage({
      type: 'draft_response',
      fromAgentId: 'agent-a',
      toAgentId: '',
      params: { context: 'test' },
      priority: 'normal',
    });

    const { routed, target, message } = router.dispatch(msg);
    expect(routed).toBe(true);
    expect(target).toBe('agent-b');
    expect(message!.toAgentId).toBe('agent-b');
  });

  it('dispatch returns routed=false when no handler', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);

    const msg = IntentProtocol.createMessage({
      type: 'unknown_type',
      fromAgentId: 'agent-a',
      toAgentId: '',
      params: {},
      priority: 'normal',
    });

    const { routed } = router.dispatch(msg);
    expect(routed).toBe(false);
  });

  it('routeToSpecific checks capability', () => {
    const protocol = setupProtocol();
    const router = new IntentRouter(protocol);

    expect(router.routeToSpecific('draft_response', 'agent-b')).toBe(true);
    expect(router.routeToSpecific('draft_response', 'agent-a')).toBe(false);
    expect(router.routeToSpecific('draft_response', 'nonexistent')).toBe(false);
  });
});
