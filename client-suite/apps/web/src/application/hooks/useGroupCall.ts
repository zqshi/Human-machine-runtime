import { useCallback } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  GroupCallType,
  GroupCallIntent,
  GroupCallEvent,
  GroupCallState,
} from 'matrix-js-sdk/lib/webrtc/groupCall';
import type { GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { getMatrixClient } from './useMatrixClient';
import { useCallStore } from '../stores/callStore';
import type { ParticipantFeed } from '../stores/callStore';
import { useToastStore } from '../stores/toastStore';
import type { CallMode, Participant } from '../../domain/call/CallSession';

function feedsToParticipantFeeds(feeds: CallFeed[]): ParticipantFeed[] {
  return feeds.map((f) => ({
    userId: f.userId,
    displayName: f.getMember()?.name ?? f.userId,
    isLocal: f.isLocal(),
    stream: f.stream ?? null,
  }));
}

function feedsToParticipants(feeds: CallFeed[]): Participant[] {
  return feeds.map((f) => ({
    userId: f.userId,
    displayName: f.getMember()?.name ?? f.userId,
    isLocal: f.isLocal(),
  }));
}

let activeGroupCall: GroupCall | null = null;

export function useGroupCall() {
  const currentCall = useCallStore((s) => s.currentCall);

  const wireGroupCallEvents = useCallback((gc: GroupCall) => {
    const store = useCallStore.getState;

    gc.on(GroupCallEvent.GroupCallStateChanged, (newState: GroupCallState) => {
      switch (newState) {
        case GroupCallState.Entered:
          store().updateStatus('connected', { startTime: Date.now() });
          break;
        case GroupCallState.Ended:
          store().endCall('ended');
          activeGroupCall = null;
          break;
      }
    });

    gc.on(GroupCallEvent.UserMediaFeedsChanged, (feeds: CallFeed[]) => {
      store().setParticipantFeeds(feedsToParticipantFeeds(feeds));
      store().updateParticipants(feedsToParticipants(feeds));

      const localFeed = feeds.find((f) => f.isLocal());
      store().setLocalStream(localFeed?.stream ?? null);
    });

    gc.on(GroupCallEvent.LocalMuteStateChanged, (audioMuted: boolean, videoMuted: boolean) => {
      store().setMicMuted(audioMuted);
      store().setVideoMuted(videoMuted);
    });

    gc.on(GroupCallEvent.Error, () => {
      useToastStore.getState().addToast('会议出错', 'error');
      store().endCall('error');
      activeGroupCall = null;
    });
  }, []);

  const startGroupCall = useCallback(
    async (roomId: string, mode: CallMode) => {
      if (activeGroupCall || useCallStore.getState().currentCall) {
        useToastStore.getState().addToast('当前有通话进行中', 'info');
        return;
      }

      const raw = getMatrixClient()?.getUnderlyingClient() as MatrixClient | null;
      if (!raw) {
        useToastStore.getState().addToast('未连接到服务器', 'error');
        return;
      }

      const room = raw.getRoom(roomId);
      if (!room) {
        useToastStore.getState().addToast('房间不存在', 'error');
        return;
      }

      const callType = mode === 'video' ? GroupCallType.Video : GroupCallType.Voice;

      useCallStore.getState().setCall({
        callId: `gc-${roomId}-${Date.now()}`,
        roomId,
        peerId: '',
        peerName: room.name ?? '会议',
        direction: 'outbound',
        mode,
        status: 'connecting',
        scope: 'group',
      });

      try {
        const gc = await raw.createGroupCall(roomId, callType, false, GroupCallIntent.Prompt);
        activeGroupCall = gc;
        wireGroupCallEvents(gc);
        await gc.enter();
      } catch {
        useToastStore.getState().addToast('发起会议失败', 'error');
        useCallStore.getState().endCall('create_failed');
        activeGroupCall = null;
      }
    },
    [wireGroupCallEvents]
  );

  const leaveGroupCall = useCallback(() => {
    const gc = activeGroupCall;
    if (!gc) return;
    gc.leave();
    useCallStore.getState().endCall('left');
    activeGroupCall = null;
  }, []);

  const toggleMic = useCallback(async () => {
    const gc = activeGroupCall;
    if (!gc) return;
    const muted = gc.isMicrophoneMuted();
    await gc.setMicrophoneMuted(!muted);
  }, []);

  const toggleVideo = useCallback(async () => {
    const gc = activeGroupCall;
    if (!gc) return;
    const muted = gc.isLocalVideoMuted();
    await gc.setLocalVideoMuted(!muted);
  }, []);

  return {
    currentCall,
    startGroupCall,
    leaveGroupCall,
    toggleMic,
    toggleVideo,
    isGroupCall: currentCall?.isGroup ?? false,
  };
}
