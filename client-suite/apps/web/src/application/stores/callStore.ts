import { create } from 'zustand';
import type { CallSessionData, CallStatus, Participant } from '../../domain/call/CallSession';
import { CallSession } from '../../domain/call/CallSession';

export interface ParticipantFeed {
  userId: string;
  displayName: string;
  isLocal: boolean;
  stream: MediaStream | null;
}

interface CallState {
  currentCall: CallSession | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  participantFeeds: ParticipantFeed[];
  micMuted: boolean;
  videoMuted: boolean;
  minimized: boolean;
}

interface CallActions {
  setCall: (data: CallSessionData) => void;
  updateStatus: (
    status: CallStatus,
    extras?: Partial<Pick<CallSessionData, 'startTime' | 'endReason'>>
  ) => void;
  endCall: (reason?: string) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setParticipantFeeds: (feeds: ParticipantFeed[]) => void;
  updateParticipants: (participants: Participant[]) => void;
  setMicMuted: (muted: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  reset: () => void;
}

const initialState: CallState = {
  currentCall: null,
  remoteStream: null,
  localStream: null,
  participantFeeds: [],
  micMuted: false,
  videoMuted: false,
  minimized: false,
};

export const useCallStore = create<CallState & CallActions>((set) => ({
  ...initialState,

  setCall: (data) => set({ currentCall: CallSession.create(data) }),

  updateStatus: (status, extras) =>
    set((s) => ({
      currentCall: s.currentCall ? s.currentCall.withStatus(status, extras) : null,
    })),

  endCall: (reason) =>
    set((s) => ({
      currentCall: s.currentCall ? s.currentCall.withStatus('ended', { endReason: reason }) : null,
      remoteStream: null,
      localStream: null,
      participantFeeds: [],
      minimized: false,
    })),

  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setParticipantFeeds: (feeds) => set({ participantFeeds: feeds }),
  updateParticipants: (participants) =>
    set((s) => ({
      currentCall: s.currentCall
        ? CallSession.create({ ...s.currentCall.toData(), participants })
        : null,
    })),
  setMicMuted: (muted) => set({ micMuted: muted }),
  setVideoMuted: (muted) => set({ videoMuted: muted }),
  setMinimized: (minimized) => set({ minimized }),
  reset: () => set(initialState),
}));
