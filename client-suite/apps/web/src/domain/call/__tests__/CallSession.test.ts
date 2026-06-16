import { describe, it, expect } from 'vitest';
import { CallSession } from '../CallSession';
import type { CallSessionData } from '../CallSession';

const BASE: CallSessionData = {
  callId: 'call-1',
  roomId: '!room:example.com',
  peerId: '@peer:example.com',
  peerName: 'Peer',
  direction: 'outbound',
  mode: 'voice',
  status: 'connecting',
  scope: 'direct',
};

describe('CallSession', () => {
  it('creates from data', () => {
    const session = CallSession.create(BASE);
    expect(session.callId).toBe('call-1');
    expect(session.status).toBe('connecting');
    expect(session.isActive).toBe(true);
  });

  it('transitions status via withStatus', () => {
    const session = CallSession.create(BASE);
    const connected = session.withStatus('connected', { startTime: 1000 });
    expect(connected.status).toBe('connected');
    expect(connected.startTime).toBe(1000);
    expect(session.status).toBe('connecting');
  });

  it('reports ended as not active', () => {
    const session = CallSession.create(BASE).withStatus('ended', { endReason: 'hangup' });
    expect(session.isActive).toBe(false);
    expect(session.endReason).toBe('hangup');
  });

  it('calculates duration', () => {
    const now = Date.now();
    const session = CallSession.create({ ...BASE, status: 'connected', startTime: now - 5000 });
    expect(session.durationMs).toBeGreaterThanOrEqual(4900);
    expect(session.durationMs).toBeLessThan(6000);
  });

  it('returns 0 duration when no startTime', () => {
    const session = CallSession.create(BASE);
    expect(session.durationMs).toBe(0);
  });

  it('round-trips through toData', () => {
    const session = CallSession.create(BASE);
    expect(session.toData()).toEqual({ ...BASE, participants: [] });
  });

  it('reports isGroup for group scope', () => {
    const session = CallSession.create({ ...BASE, scope: 'group' });
    expect(session.isGroup).toBe(true);
  });

  it('reports not isGroup for direct scope', () => {
    const session = CallSession.create(BASE);
    expect(session.isGroup).toBe(false);
  });
});
