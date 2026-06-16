import { describe, it, expect } from 'vitest';
import { CollaborationSession } from '../CollaborationSession';

describe('CollaborationSession', () => {
  it('creates with initiator as first participant', () => {
    const session = CollaborationSession.create({
      purpose: '联合分析异常',
      triggerIntentType: 'notify_anomaly',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    });

    expect(session.status).toBe('forming');
    expect(session.participants).toHaveLength(1);
    expect(session.participants[0].id).toBe('agent-a');
    expect(session.participants[0].role).toBe('initiator');
    expect(session.events).toHaveLength(1);
    expect(session.events[0].type).toBe('created');
  });

  it('adds participant and transitions to active', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    });

    const updated = session.addParticipant('agent-b', 'agent');
    expect(updated.participants).toHaveLength(2);
    expect(updated.status).toBe('active');
    expect(updated.events).toHaveLength(2);
    expect(updated.events[1].type).toBe('participant-joined');
  });

  it('does not duplicate participants', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    });

    const dup = session.addParticipant('agent-a', 'agent');
    expect(dup.participants).toHaveLength(1);
  });

  it('escalates session with reason', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    }).activate();

    const escalated = session.escalate('confidence below threshold');
    expect(escalated.status).toBe('escalated');
    expect(escalated.events[escalated.events.length - 1].type).toBe('escalated');
  });

  it('completes session', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    })
      .activate()
      .complete();

    expect(session.status).toBe('completed');
  });

  it('dissolves session', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    }).dissolve();

    expect(session.status).toBe('dissolved');
  });

  it('reports human involvement', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
    }).addParticipant('user-1', 'human', 'escalation-target');

    expect(session.hasHumanInvolved).toBe(true);
    expect(session.humanParticipants).toHaveLength(1);
    expect(session.agentParticipants).toHaveLength(1);
  });

  it('checks expiry based on maxDurationMs', () => {
    const session = CollaborationSession.create({
      purpose: 'test',
      triggerIntentType: 'sim',
      initiatorId: 'agent-a',
      initiatorType: 'agent',
      maxDurationMs: 0,
    });

    expect(session.isExpired).toBe(true);
  });
});
