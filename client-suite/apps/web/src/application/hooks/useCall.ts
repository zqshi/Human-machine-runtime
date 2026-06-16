import { useCallback, useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  createNewMatrixCall,
  CallEvent,
  CallState,
  CallType,
  CallErrorCode,
} from 'matrix-js-sdk/lib/webrtc/call';
import type { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import { CallFeedEvent } from 'matrix-js-sdk/lib/webrtc/callFeed';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { getMatrixClient } from './useMatrixClient';
import { useCallStore } from '../stores/callStore';
import { useToastStore } from '../stores/toastStore';
import type { CallMode } from '../../domain/call/CallSession';

function extractStream(feeds: CallFeed[], isLocal: boolean): MediaStream | null {
  const feed = feeds.find((f) => f.isLocal() === isLocal);
  return feed?.stream ?? null;
}

let activeCall: MatrixCall | null = null;

export function useCall() {
  const currentCall = useCallStore((s) => s.currentCall);

  const wireCallEvents = useCallback((call: MatrixCall) => {
    const store = useCallStore.getState;

    call.on(CallEvent.State, (state: CallState) => {
      switch (state) {
        case CallState.Ringing:
          store().updateStatus('ringing');
          break;
        case CallState.Connecting:
        case CallState.CreateOffer:
        case CallState.CreateAnswer:
        case CallState.InviteSent:
        case CallState.WaitLocalMedia:
          store().updateStatus('connecting');
          break;
        case CallState.Connected:
          store().updateStatus('connected', { startTime: Date.now() });
          break;
        case CallState.Ended:
          store().endCall(call.hangupReason ?? 'ended');
          activeCall = null;
          break;
      }
    });

    call.on(CallEvent.FeedsChanged, (feeds: CallFeed[]) => {
      store().setRemoteStream(extractStream(feeds, false));
      store().setLocalStream(extractStream(feeds, true));

      feeds.forEach((feed) => {
        feed.on(CallFeedEvent.NewStream, () => {
          store().setRemoteStream(extractStream(call.getFeeds(), false));
          store().setLocalStream(extractStream(call.getFeeds(), true));
        });
      });
    });

    call.on(CallEvent.Hangup, () => {
      store().endCall(call.hangupReason ?? 'hangup');
      activeCall = null;
    });

    call.on(CallEvent.Error, () => {
      useToastStore.getState().addToast('通话出错', 'error');
      store().endCall('error');
      activeCall = null;
    });
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    const raw = getMatrixClient()?.getUnderlyingClient() as MatrixClient | null;
    if (!raw) return;

    const handler = (call: MatrixCall) => {
      if (activeCall) {
        call.hangup(CallErrorCode.UserBusy, false);
        return;
      }
      activeCall = call;
      const peer = call.getOpponentMember();
      const mode: CallMode = call.type === CallType.Video ? 'video' : 'voice';

      useCallStore.getState().setCall({
        callId: call.callId,
        roomId: call.roomId ?? '',
        peerId: peer?.userId ?? '',
        peerName: peer?.name ?? peer?.userId ?? '未知',
        direction: 'inbound',
        mode,
        status: 'ringing',
        scope: 'direct',
      });

      wireCallEvents(call);
    };

    raw.on(CallEventHandlerEvent.Incoming, handler);
    return () => {
      raw.removeListener(CallEventHandlerEvent.Incoming, handler);
    };
  }, [wireCallEvents]);

  const placeCall = useCallback(
    async (roomId: string, mode: CallMode) => {
      if (activeCall) {
        useToastStore.getState().addToast('当前有通话进行中', 'info');
        return;
      }

      const raw = getMatrixClient()?.getUnderlyingClient() as MatrixClient | null;
      if (!raw) {
        useToastStore.getState().addToast('未连接到服务器', 'error');
        return;
      }

      let call: MatrixCall | null;
      try {
        call = createNewMatrixCall(raw, roomId);
      } catch (e) {
        const msg = (e as Error)?.message ?? '';
        if (msg.includes('device ID')) {
          useToastStore.getState().addToast('请重新登录后再发起通话', 'error');
        } else {
          useToastStore.getState().addToast('无法创建通话', 'error');
        }
        return;
      }
      if (!call) {
        useToastStore.getState().addToast('无法创建通话', 'error');
        return;
      }

      activeCall = call;
      const room = raw.getRoom(roomId);
      const myUserId = raw.getUserId() ?? '';
      const members = room?.getJoinedMembers() ?? [];
      const peer = members.find((m) => m.userId !== myUserId);

      useCallStore.getState().setCall({
        callId: call.callId,
        roomId,
        peerId: peer?.userId ?? '',
        peerName: peer?.name ?? peer?.userId ?? '对方',
        direction: 'outbound',
        mode,
        status: 'connecting',
        scope: 'direct',
      });

      wireCallEvents(call);

      try {
        if (mode === 'video') {
          await call.placeVideoCall();
        } else {
          await call.placeVoiceCall();
        }
      } catch {
        useToastStore.getState().addToast('发起通话失败', 'error');
        useCallStore.getState().endCall('place_failed');
        activeCall = null;
      }
    },
    [wireCallEvents]
  );

  const answerCall = useCallback(async () => {
    const call = activeCall;
    if (!call) return;
    try {
      await call.answer();
    } catch {
      useToastStore.getState().addToast('接听失败', 'error');
      useCallStore.getState().endCall('answer_failed');
      activeCall = null;
    }
  }, []);

  const hangup = useCallback(() => {
    const call = activeCall;
    if (!call) return;
    call.hangup(CallErrorCode.UserHangup, false);
    activeCall = null;
  }, []);

  const reject = useCallback(() => {
    const call = activeCall;
    if (!call) return;
    call.hangup(CallErrorCode.UserHangup, false);
    useCallStore.getState().endCall('rejected');
    activeCall = null;
  }, []);

  const toggleMic = useCallback(async () => {
    const call = activeCall;
    if (!call) return;
    const muted = call.isMicrophoneMuted();
    await call.setMicrophoneMuted(!muted);
    useCallStore.getState().setMicMuted(!muted);
  }, []);

  const toggleVideo = useCallback(async () => {
    const call = activeCall;
    if (!call) return;
    const muted = call.isLocalVideoMuted();
    await call.setLocalVideoMuted(!muted);
    useCallStore.getState().setVideoMuted(!muted);
  }, []);

  return {
    currentCall,
    placeCall,
    answerCall,
    hangup,
    reject,
    toggleMic,
    toggleVideo,
  };
}
