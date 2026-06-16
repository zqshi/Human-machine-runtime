export type CallDirection = 'inbound' | 'outbound';
export type CallMode = 'voice' | 'video';
export type CallStatus = 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallScope = 'direct' | 'group';

export interface Participant {
  userId: string;
  displayName: string;
  isLocal: boolean;
}

export interface CallSessionData {
  callId: string;
  roomId: string;
  peerId: string;
  peerName: string;
  direction: CallDirection;
  mode: CallMode;
  status: CallStatus;
  scope: CallScope;
  participants?: Participant[];
  startTime?: number;
  endReason?: string;
}

export class CallSession {
  readonly callId: string;
  readonly roomId: string;
  readonly peerId: string;
  readonly peerName: string;
  readonly direction: CallDirection;
  readonly mode: CallMode;
  readonly status: CallStatus;
  readonly scope: CallScope;
  readonly participants: Participant[];
  readonly startTime?: number;
  readonly endReason?: string;

  private constructor(data: CallSessionData) {
    this.callId = data.callId;
    this.roomId = data.roomId;
    this.peerId = data.peerId;
    this.peerName = data.peerName;
    this.direction = data.direction;
    this.mode = data.mode;
    this.status = data.status;
    this.scope = data.scope;
    this.participants = data.participants ?? [];
    this.startTime = data.startTime;
    this.endReason = data.endReason;
  }

  static create(data: CallSessionData): CallSession {
    return new CallSession(data);
  }

  withStatus(
    status: CallStatus,
    extras?: Partial<Pick<CallSessionData, 'startTime' | 'endReason'>>
  ): CallSession {
    return new CallSession({ ...this.toData(), status, ...extras });
  }

  get isActive(): boolean {
    return this.status !== 'ended';
  }

  get isGroup(): boolean {
    return this.scope === 'group';
  }

  get durationMs(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  toData(): CallSessionData {
    return {
      callId: this.callId,
      roomId: this.roomId,
      peerId: this.peerId,
      peerName: this.peerName,
      direction: this.direction,
      mode: this.mode,
      status: this.status,
      scope: this.scope,
      participants: this.participants,
      startTime: this.startTime,
      endReason: this.endReason,
    };
  }
}
