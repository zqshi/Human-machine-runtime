import { useState } from 'react';
import { useChatStore } from '../../../application/stores/chatStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useCall } from '../../../application/hooks/useCall';
import { getMatrixClient } from '../../../application/hooks/useMatrixClient';
import { Icon } from '../../components/ui/Icon';
import { CallMemberPicker } from '../call/CallMemberPicker';
import { GroupInfoPanel } from './GroupInfoPanel';
import type { CallMode } from '../../../domain/call/CallSession';

const CONNECTION_LABEL: Record<string, { text: string; color: string }> = {
  connected: { text: '在线', color: 'text-green-500' },
  connecting: { text: '连接中...', color: 'text-amber-500' },
  reconnecting: { text: '重连中...', color: 'text-amber-500' },
  disconnected: { text: '已断开', color: 'text-red-500' },
  error: { text: '连接失败', color: 'text-red-500' },
};

export function ChatHeader() {
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const room = rooms.find((r) => r.id === currentRoomId);
  const connectionState = useChatStore((s) => s.connectionState);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const { placeCall } = useCall();
  const [pickerMode, setPickerMode] = useState<CallMode | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  if (!room) return null;

  const conn = CONNECTION_LABEL[connectionState] ?? CONNECTION_LABEL.connected;
  const statusText = room.isBot ? `数字员工 · ${conn.text}` : conn.text;
  const isGroupRoom = room.type === 'group';

  const handleCall = (mode: CallMode) => {
    if (!currentRoomId) return;

    if (isGroupRoom) {
      const client = getMatrixClient();
      const members = client?.getRoomMembers(currentRoomId) ?? [];
      if (members.length <= 1) {
        placeCall(currentRoomId, mode);
      } else {
        setPickerMode(mode);
      }
    } else {
      placeCall(currentRoomId, mode);
    }
  };

  return (
    <>
      <div className="h-14 px-5 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-text-primary">{room.name}</h1>
              {room.isBot && (
                <span className="text-[10px] font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full uppercase">
                  Bot
                </span>
              )}
              {room.memberCount > 0 && (
                <span className="text-xs text-text-muted">{room.memberCount} 人</span>
              )}
            </div>
            <p className={`text-[11px] leading-none mt-0.5 ${conn.color}`}>{statusText}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
            title={isGroupRoom ? '群语音通话' : '语音通话'}
            onClick={() => handleCall('voice')}
          >
            <Icon name="call" size={18} />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
            title={isGroupRoom ? '群视频通话' : '视频通话'}
            onClick={() => handleCall('video')}
          >
            <Icon name="videocam" size={18} />
          </button>
          {isGroupRoom && (
            <button
              className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
              title="邀请成员"
              onClick={() => setShowGroupInfo(true)}
            >
              <Icon name="person_add" size={18} />
            </button>
          )}
          {room.type === 'subscription' && (
            <button
              className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
              title="订阅管理"
              onClick={() =>
                openDrawer({ type: 'subscription', title: `${room.name} 订阅设置`, data: {} })
              }
            >
              <Icon name="tune" size={18} />
            </button>
          )}
          <button
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
            title="会话信息"
            onClick={() => {
              if (isGroupRoom && currentRoomId) {
                setShowGroupInfo(true);
              } else {
                useToastStore.getState().addToast('会话详情面板即将上线', 'info');
              }
            }}
          >
            <Icon name="info" size={18} />
          </button>
        </div>
      </div>

      {pickerMode && currentRoomId && (
        <CallMemberPicker
          roomId={currentRoomId}
          mode={pickerMode}
          onClose={() => setPickerMode(null)}
        />
      )}

      {showGroupInfo && currentRoomId && (
        <GroupInfoPanel
          roomId={currentRoomId}
          roomName={room.name}
          onClose={() => setShowGroupInfo(false)}
        />
      )}
    </>
  );
}
