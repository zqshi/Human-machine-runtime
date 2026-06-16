import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import type { ChatRoom } from '../../../domain/chat/ChatRoom';
import { getRoomActions, type RoomAction } from '../../../domain/chat/ChatRoom';
import { useChatStore } from '../../../application/stores/chatStore';
import { formatRelativeTime } from '../../../domain/shared/formatTime';

interface RoomListItemProps {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  onLeave?: (roomId: string) => void;
}

const ACTION_META: Record<RoomAction, { icon: string; label: string; danger?: boolean }> = {
  pin: { icon: 'push_pin', label: '置顶' },
  unpin: { icon: 'push_pin', label: '取消置顶' },
  markRead: { icon: 'done_all', label: '标为已读' },
  markUnread: { icon: 'mark_email_unread', label: '标为未读' },
  leave: { icon: 'logout', label: '退出群组', danger: true },
};

function GroupSubmenu({
  roomId,
  position,
  onClose,
}: {
  roomId: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const roomGroups = useChatStore((s) => s.roomGroups);
  const roomGroupMap = useChatStore((s) => s.roomGroupMap);
  const setRoomGroup = useChatStore((s) => s.setRoomGroup);
  const addRoomGroup = useChatStore((s) => s.addRoomGroup);
  const currentGroupId = roomGroupMap[roomId] ?? null;

  const handleSelect = (groupId: string | null) => {
    setRoomGroup(roomId, groupId);
    onClose();
  };

  const handleNewGroup = () => {
    const name = prompt('输入新分组名称');
    if (!name?.trim()) return;
    addRoomGroup(name.trim());
    const groups = useChatStore.getState().roomGroups;
    const newest = groups[groups.length - 1];
    if (newest) setRoomGroup(roomId, newest.id);
    onClose();
  };

  return createPortal(
    <div
      className="fixed z-[110] min-w-[140px] py-1 bg-bg-white-var/95 backdrop-blur-xl border border-border rounded-xl shadow-card animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {currentGroupId && (
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
        >
          <Icon name="close" size={14} className="text-text-secondary" />
          移出分组
        </button>
      )}
      {roomGroups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => handleSelect(g.id)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
        >
          {currentGroupId === g.id ? (
            <Icon name="check" size={14} className="text-primary" />
          ) : (
            <span className="w-[14px]" />
          )}
          {g.name}
        </button>
      ))}
      <div className="h-px bg-border mx-2 my-0.5" />
      <button
        type="button"
        onClick={handleNewGroup}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-bg-hover"
      >
        <Icon name="add" size={14} className="text-primary" />
        新建分组...
      </button>
    </div>,
    document.body
  );
}

export function RoomListItem({ room, isActive, onClick, onLeave }: RoomListItemProps) {
  const isSystem = room.type === 'system';
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [groupSubmenuPos, setGroupSubmenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const togglePin = useChatStore((s) => s.togglePin);
  const toggleUnread = useChatStore((s) => s.toggleUnread);

  const actions = getRoomActions(room);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleAction = (action: RoomAction) => {
    if (action === 'pin' || action === 'unpin') togglePin(room.id);
    if (action === 'markRead' || action === 'markUnread') toggleUnread(room.id);
    if (action === 'leave' && onLeave) onLeave(room.id);
    setMenuPos(null);
  };

  useEffect(() => {
    if (!menuPos) return;
    const close = () => {
      setMenuPos(null);
      setGroupSubmenuPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuPos]);

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContext}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
          isActive
            ? 'bg-primary/8 border border-primary/15'
            : room.pinned
              ? 'bg-primary/[0.03] hover:bg-primary/[0.06] border border-transparent'
              : 'hover:bg-bg-hover border border-transparent'
        }`}
      >
        <Avatar letter={room.avatarLetter} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-text-primary truncate flex-1">
              {room.name}
            </span>
            {room.pinned && (
              <Icon name="push_pin" size={12} className="text-text-muted shrink-0 rotate-45" />
            )}
            {isSystem ? (
              <span className="text-[10px] text-white bg-primary px-1.5 rounded-full shrink-0">
                系统
              </span>
            ) : room.isBot ? (
              <span className="text-[10px] text-primary bg-primary/8 px-1.5 rounded-full shrink-0">
                Bot
              </span>
            ) : null}
            {room.lastMessageTs && (
              <span className="text-[10px] text-text-muted shrink-0 ml-1">
                {formatRelativeTime(room.lastMessageTs)}
              </span>
            )}
          </div>
          {room.lastMessage && (
            <p className="text-xs text-text-muted truncate mt-0.5">{room.lastMessage}</p>
          )}
        </div>
        <Badge count={room.unreadCount} />
      </button>

      {/* Context menu */}
      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] min-w-[140px] py-1 bg-bg-white-var/95 backdrop-blur-xl border border-border rounded-xl shadow-card animate-in fade-in zoom-in-95 duration-100"
            style={{ left: menuPos.x, top: menuPos.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {actions.map((action) => {
              const meta = ACTION_META[action];
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleAction(action)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    meta.danger
                      ? 'text-red-500 hover:bg-red-50'
                      : 'text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <Icon
                    name={meta.icon}
                    size={14}
                    className={meta.danger ? 'text-red-400' : 'text-text-secondary'}
                  />
                  {meta.label}
                </button>
              );
            })}
            {/* Move to group */}
            <button
              type="button"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setGroupSubmenuPos({ x: rect.right + 4, y: rect.top });
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setGroupSubmenuPos((prev) => (prev ? null : { x: rect.right + 4, y: rect.top }));
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
            >
              <Icon name="folder" size={14} className="text-text-secondary" />
              <span className="flex-1 text-left">移到分组</span>
              <Icon name="chevron_right" size={12} className="text-text-muted" />
            </button>
          </div>,
          document.body
        )}

      {/* Group submenu */}
      {groupSubmenuPos && menuPos && (
        <GroupSubmenu
          roomId={room.id}
          position={groupSubmenuPos}
          onClose={() => {
            setMenuPos(null);
            setGroupSubmenuPos(null);
          }}
        />
      )}
    </>
  );
}
