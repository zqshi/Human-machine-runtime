import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAddToast = vi.fn();

vi.mock('../stores/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('../stores/openclawStore', () => ({
  useOpenClawStore: { getState: () => ({ selectBColumnDecision: vi.fn() }) },
}));

import { appEvents } from '../events/eventBus';
import { initPushPolicy } from './PushPolicyService';

describe('PushPolicyService', () => {
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAddToast.mockClear();
    cleanup = initPushPolicy();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('critical urgency shows error toast immediately', () => {
    appEvents.emit('decision:created', {
      decisionId: 'dec-1',
      agentId: 'ops',
      urgency: 'critical',
    });
    expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('紧急决策'), 'error');
  });

  it('high urgency batches within window', () => {
    appEvents.emit('decision:created', { decisionId: 'dec-1', agentId: 'ops', urgency: 'high' });
    appEvents.emit('decision:created', { decisionId: 'dec-2', agentId: 'ops', urgency: 'high' });
    expect(mockAddToast).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5001);
    expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('2 项'), 'info');
  });

  it('high urgency single item shows count 1', () => {
    appEvents.emit('decision:created', { decisionId: 'dec-1', agentId: 'ops', urgency: 'high' });
    vi.advanceTimersByTime(5001);
    expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('1 项'), 'info');
  });

  it('normal/low urgency does not trigger toast', () => {
    appEvents.emit('decision:created', { decisionId: 'dec-1', agentId: 'ops', urgency: 'normal' });
    appEvents.emit('decision:created', { decisionId: 'dec-2', agentId: 'ops', urgency: 'low' });
    vi.advanceTimersByTime(10000);
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
