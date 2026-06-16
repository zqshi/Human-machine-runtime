import { useEffect, useRef } from 'react';
import { useCallStore } from '../../../application/stores/callStore';
import type { ParticipantFeed } from '../../../application/stores/callStore';
import { useCall } from '../../../application/hooks/useCall';
import { useGroupCall } from '../../../application/hooks/useGroupCall';
import { Icon } from '../../components/ui/Icon';
import { CallTimer } from './CallTimer';
import { Avatar } from '../../components/ui/Avatar';

function ParticipantTile({ feed }: { feed: ParticipantFeed }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && feed.stream) {
      videoRef.current.srcObject = feed.stream;
    }
  }, [feed.stream]);

  const hasVideo = feed.stream?.getVideoTracks().some((t) => t.enabled) ?? false;

  return (
    <div className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[80px]">
      {hasVideo && feed.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={feed.isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-1 py-3">
          <Avatar letter={feed.displayName[0]} size={36} />
          <span className="text-[10px] text-white/80">{feed.displayName}</span>
        </div>
      )}
      <span className="absolute bottom-1 left-1.5 text-[9px] text-white/70 bg-black/40 px-1 py-0.5 rounded">
        {feed.isLocal ? '我' : feed.displayName}
      </span>
    </div>
  );
}

function gridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

function MinimizedBar() {
  const call = useCallStore((s) => s.currentCall);
  const micMuted = useCallStore((s) => s.micMuted);
  const { hangup, toggleMic } = useCall();
  const { leaveGroupCall, toggleMic: toggleGroupMic } = useGroupCall();
  const setMinimized = useCallStore((s) => s.setMinimized);

  if (!call) return null;

  const isGroup = call.isGroup;
  const handleHangup = isGroup ? leaveGroupCall : hangup;
  const handleToggleMic = isGroup ? toggleGroupMic : toggleMic;

  return (
    <div className="fixed bottom-6 right-6 z-[9000] flex items-center gap-3 bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl px-4 py-2.5 shadow-2xl border border-white/10">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      <span className="text-xs font-medium truncate max-w-[120px]">{call.peerName}</span>
      {call.status === 'connected' && call.startTime && <CallTimer startTime={call.startTime} />}
      <button
        type="button"
        onClick={handleToggleMic}
        className={`p-1.5 rounded-full transition-colors ${micMuted ? 'bg-red-500/80' : 'bg-white/15 hover:bg-white/25'}`}
      >
        <Icon name={micMuted ? 'mic_off' : 'mic'} size={16} className="text-white" />
      </button>
      <button
        type="button"
        onClick={handleHangup}
        className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
      >
        <Icon name="call_end" size={16} className="text-white" />
      </button>
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
        title="展开"
      >
        <Icon name="open_in_full" size={14} className="text-white" />
      </button>
    </div>
  );
}

function IncomingCallCard() {
  const call = useCallStore((s) => s.currentCall);
  const { answerCall, reject } = useCall();

  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10 text-center hmr-fade-in">
        <Avatar letter={call.peerName[0]} size={64} />
        <h3 className="text-lg font-semibold text-white mt-4">{call.peerName}</h3>
        <p className="text-sm text-white/60 mt-1">
          {call.mode === 'video' ? '视频来电' : '语音来电'}...
        </p>
        <div className="flex items-center gap-0.5 justify-center mt-2">
          <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            type="button"
            onClick={reject}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          >
            <Icon name="call_end" size={28} className="text-white" />
          </button>
          <button
            type="button"
            onClick={answerCall}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
          >
            <Icon name="call" size={28} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectCallPanel() {
  const call = useCallStore((s) => s.currentCall);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const localStream = useCallStore((s) => s.localStream);
  const micMuted = useCallStore((s) => s.micMuted);
  const videoMuted = useCallStore((s) => s.videoMuted);
  const setMinimized = useCallStore((s) => s.setMinimized);
  const { hangup, toggleMic, toggleVideo } = useCall();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!call) return null;

  const isVideo = call.mode === 'video';

  return (
    <div className="fixed bottom-6 right-6 z-[9000] w-80 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden hmr-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
          <span className="text-xs font-medium text-white truncate">{call.peerName}</span>
        </div>
        <div className="flex items-center gap-1">
          {call.status === 'connected' && call.startTime && (
            <CallTimer startTime={call.startTime} />
          )}
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="最小化"
          >
            <Icon name="minimize" size={14} className="text-white/70" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {isVideo && remoteStream ? (
          <div className="relative aspect-video bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {localStream && (
              <div className="absolute top-2 right-2 w-20 h-14 rounded-lg overflow-hidden border border-white/20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <Avatar letter={call.peerName[0]} size={56} />
            <span className="text-sm font-medium text-white">{call.peerName}</span>
            <span className="text-xs text-white/50">
              {call.status === 'connecting' &&
                (call.direction === 'outbound' ? '正在呼叫...' : '连接中...')}
              {call.status === 'connected' && '通话中'}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-3 border-t border-white/10">
        <button
          type="button"
          onClick={toggleMic}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            micMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/15 hover:bg-white/25'
          }`}
        >
          <Icon name={micMuted ? 'mic_off' : 'mic'} size={18} className="text-white" />
        </button>
        {isVideo && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              videoMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/15 hover:bg-white/25'
            }`}
          >
            <Icon
              name={videoMuted ? 'videocam_off' : 'videocam'}
              size={18}
              className="text-white"
            />
          </button>
        )}
        <button
          type="button"
          onClick={hangup}
          className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
        >
          <Icon name="call_end" size={22} className="text-white" />
        </button>
      </div>
    </div>
  );
}

function GroupCallPanel() {
  const call = useCallStore((s) => s.currentCall);
  const participantFeeds = useCallStore((s) => s.participantFeeds);
  const micMuted = useCallStore((s) => s.micMuted);
  const videoMuted = useCallStore((s) => s.videoMuted);
  const setMinimized = useCallStore((s) => s.setMinimized);
  const { leaveGroupCall, toggleMic, toggleVideo } = useGroupCall();

  if (!call) return null;

  const isVideo = call.mode === 'video';

  return (
    <div className="fixed bottom-6 right-6 z-[9000] w-96 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden hmr-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
          <span className="text-xs font-medium text-white truncate">{call.peerName}</span>
          <span className="text-[10px] text-white/40">{participantFeeds.length} 人</span>
        </div>
        <div className="flex items-center gap-1">
          {call.status === 'connected' && call.startTime && (
            <CallTimer startTime={call.startTime} />
          )}
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="最小化"
          >
            <Icon name="minimize" size={14} className="text-white/70" />
          </button>
        </div>
      </div>

      {/* Participant grid */}
      <div className={`p-3 grid ${gridCols(participantFeeds.length)} gap-2`}>
        {participantFeeds.map((feed) => (
          <ParticipantTile key={feed.userId} feed={feed} />
        ))}
        {participantFeeds.length === 0 && (
          <div className="flex items-center justify-center text-white/40 text-xs py-8 col-span-full">
            {call.status === 'connecting' ? '连接中...' : '等待其他参会者加入...'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-3 border-t border-white/10">
        <button
          type="button"
          onClick={toggleMic}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            micMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/15 hover:bg-white/25'
          }`}
        >
          <Icon name={micMuted ? 'mic_off' : 'mic'} size={18} className="text-white" />
        </button>
        {isVideo && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              videoMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/15 hover:bg-white/25'
            }`}
          >
            <Icon
              name={videoMuted ? 'videocam_off' : 'videocam'}
              size={18}
              className="text-white"
            />
          </button>
        )}
        <button
          type="button"
          onClick={leaveGroupCall}
          className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
        >
          <Icon name="call_end" size={22} className="text-white" />
        </button>
      </div>
    </div>
  );
}

export function CallOverlay() {
  const call = useCallStore((s) => s.currentCall);
  const minimized = useCallStore((s) => s.minimized);

  if (!call || call.status === 'ended') return null;

  const isRinging = call.status === 'ringing' && call.direction === 'inbound';

  if (isRinging) return <IncomingCallCard />;
  if (minimized) return <MinimizedBar />;
  if (call.isGroup) return <GroupCallPanel />;
  return <DirectCallPanel />;
}
