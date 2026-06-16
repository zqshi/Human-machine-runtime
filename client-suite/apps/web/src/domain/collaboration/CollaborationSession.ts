/**
 * CollaborationSession — 临时任务群
 *
 * 多 Agent + 可选人参与的协作会话，有生命周期（分钟~周）。
 * 按 intent 自动组群，完成后自动解散。
 */

export type SessionStatus = 'forming' | 'active' | 'escalated' | 'completed' | 'dissolved';

export interface SessionParticipant {
  readonly id: string;
  readonly type: 'agent' | 'human';
  readonly role: 'initiator' | 'collaborator' | 'observer' | 'escalation-target';
  readonly joinedAt: number;
}

export interface SessionEvent {
  readonly id: string;
  readonly type:
    | 'created'
    | 'participant-joined'
    | 'intent-dispatched'
    | 'escalated'
    | 'completed'
    | 'dissolved';
  readonly participantId?: string;
  readonly payload?: Record<string, unknown>;
  readonly timestamp: number;
}

export interface CollaborationSessionProps {
  id: string;
  purpose: string;
  triggerIntentType: string;
  status: SessionStatus;
  participants: SessionParticipant[];
  events: SessionEvent[];
  createdAt: number;
  updatedAt: number;
  maxDurationMs: number;
  confidenceThreshold: number;
}

export class CollaborationSession {
  readonly id: string;
  readonly purpose: string;
  readonly triggerIntentType: string;
  readonly status: SessionStatus;
  readonly participants: readonly SessionParticipant[];
  readonly events: readonly SessionEvent[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly maxDurationMs: number;
  readonly confidenceThreshold: number;

  private constructor(props: CollaborationSessionProps) {
    this.id = props.id;
    this.purpose = props.purpose;
    this.triggerIntentType = props.triggerIntentType;
    this.status = props.status;
    this.participants = props.participants;
    this.events = props.events;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.maxDurationMs = props.maxDurationMs;
    this.confidenceThreshold = props.confidenceThreshold;
  }

  static create(props: {
    purpose: string;
    triggerIntentType: string;
    initiatorId: string;
    initiatorType: 'agent' | 'human';
    maxDurationMs?: number;
    confidenceThreshold?: number;
  }): CollaborationSession {
    const now = Date.now();
    const id = `session-${now}-${Math.random().toString(36).slice(2, 7)}`;

    const initiator: SessionParticipant = {
      id: props.initiatorId,
      type: props.initiatorType,
      role: 'initiator',
      joinedAt: now,
    };

    const createdEvent: SessionEvent = {
      id: `evt-${now}-0`,
      type: 'created',
      participantId: props.initiatorId,
      timestamp: now,
    };

    return new CollaborationSession({
      id,
      purpose: props.purpose,
      triggerIntentType: props.triggerIntentType,
      status: 'forming',
      participants: [initiator],
      events: [createdEvent],
      createdAt: now,
      updatedAt: now,
      maxDurationMs: props.maxDurationMs ?? 7 * 24 * 60 * 60 * 1000,
      confidenceThreshold: props.confidenceThreshold ?? 0.7,
    });
  }

  addParticipant(
    id: string,
    type: 'agent' | 'human',
    role: SessionParticipant['role'] = 'collaborator'
  ): CollaborationSession {
    if (this.participants.some((p) => p.id === id)) return this;

    const now = Date.now();
    const participant: SessionParticipant = { id, type, role, joinedAt: now };
    const event: SessionEvent = {
      id: `evt-${now}-${this.events.length}`,
      type: 'participant-joined',
      participantId: id,
      timestamp: now,
    };

    return new CollaborationSession({
      ...this.toProps(),
      participants: [...this.participants, participant],
      events: [...this.events, event],
      status: this.status === 'forming' ? 'active' : this.status,
      updatedAt: now,
    });
  }

  activate(): CollaborationSession {
    if (this.status !== 'forming') return this;
    return new CollaborationSession({
      ...this.toProps(),
      status: 'active',
      updatedAt: Date.now(),
    });
  }

  escalate(reason: string): CollaborationSession {
    if (this.status !== 'active') return this;
    const now = Date.now();
    const event: SessionEvent = {
      id: `evt-${now}-${this.events.length}`,
      type: 'escalated',
      payload: { reason },
      timestamp: now,
    };

    return new CollaborationSession({
      ...this.toProps(),
      status: 'escalated',
      events: [...this.events, event],
      updatedAt: now,
    });
  }

  complete(): CollaborationSession {
    if (this.status === 'completed' || this.status === 'dissolved') return this;
    const now = Date.now();
    const event: SessionEvent = {
      id: `evt-${now}-${this.events.length}`,
      type: 'completed',
      timestamp: now,
    };

    return new CollaborationSession({
      ...this.toProps(),
      status: 'completed',
      events: [...this.events, event],
      updatedAt: now,
    });
  }

  dissolve(): CollaborationSession {
    const now = Date.now();
    const event: SessionEvent = {
      id: `evt-${now}-${this.events.length}`,
      type: 'dissolved',
      timestamp: now,
    };

    return new CollaborationSession({
      ...this.toProps(),
      status: 'dissolved',
      events: [...this.events, event],
      updatedAt: now,
    });
  }

  get isExpired(): boolean {
    return Date.now() - this.createdAt >= this.maxDurationMs;
  }

  get agentParticipants(): readonly SessionParticipant[] {
    return this.participants.filter((p) => p.type === 'agent');
  }

  get humanParticipants(): readonly SessionParticipant[] {
    return this.participants.filter((p) => p.type === 'human');
  }

  get hasHumanInvolved(): boolean {
    return this.participants.some((p) => p.type === 'human');
  }

  get durationMs(): number {
    return Date.now() - this.createdAt;
  }

  private toProps(): CollaborationSessionProps {
    return {
      id: this.id,
      purpose: this.purpose,
      triggerIntentType: this.triggerIntentType,
      status: this.status,
      participants: [...this.participants],
      events: [...this.events],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      maxDurationMs: this.maxDurationMs,
      confidenceThreshold: this.confidenceThreshold,
    };
  }
}
