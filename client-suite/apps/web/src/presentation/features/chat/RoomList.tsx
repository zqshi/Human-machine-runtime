import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRooms } from '../../../application/hooks/useRooms';
import { useMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useChatStore } from '../../../application/stores/chatStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Icon } from '../../components/ui/Icon';
import { RoomListItem } from './RoomListItem';

interface RoomListProps {
  onSelectRoom: (roomId: string) => void;
  onLeaveRoom?: (roomId: string) => void;
}

export function MessagesSidebar() {
  const { selectRoom, leaveRoom } = useMatrixClient();
  return <RoomList onSelectRoom={selectRoom} onLeaveRoom={leaveRoom} />;
}

function GroupTabContextMenu({
  groupId,
  position,
  onClose,
}: {
  groupId: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const renameRoomGroup = useChatStore((s) => s.renameRoomGroup);
  const removeRoomGroup = useChatStore((s) => s.removeRoomGroup);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleRename = () => {
    onClose();
    const name = prompt('输入新分组名称');
    if (name?.trim()) renameRoomGroup(groupId, name.trim());
  };

  const handleDelete = () => {
    onClose();
    removeRoomGroup(groupId);
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[120px] py-1 bg-bg-white-var/95 backdrop-blur-xl border border-border rounded-xl shadow-card animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleRename}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
      >
        <Icon name="edit" size={14} className="text-text-secondary" />
        重命名
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
      >
        <Icon name="delete" size={14} className="text-red-400" />
        删除分组
      </button>
    </div>,
    document.body
  );
}

export function RoomList({ onSelectRoom, onLeaveRoom }: RoomListProps) {
  const { rooms, filter, searchQuery, setFilter, setSearch } = useRooms();
  const roomGroups = useChatStore((s) => s.roomGroups);
  const addRoomGroup = useChatStore((s) => s.addRoomGroup);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const appMode = useUIStore((s) => s.appMode);
  const isOC = appMode === 'openclaw';
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [tabMenu, setTabMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'starred', label: '星标' },
    ...roomGroups.map((g) => ({ key: g.id, label: g.name })),
  ];

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    addRoomGroup(name);
    setNewGroupName('');
    setShowNewGroup(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">消息</h3>
        </div>
        <SearchInput value={searchQuery} onChange={setSearch} placeholder="搜索会话..." />

        {/* Dynamic Tab Bar */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/[0.04] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              onContextMenu={(e) => {
                if (tab.key.startsWith('grp-')) {
                  e.preventDefault();
                  setTabMenu({ groupId: tab.key, x: e.clientX, y: e.clientY });
                }
              }}
              className={`shrink-0 px-3 h-7 rounded-md text-xs font-medium transition-all ${
                filter === tab.key
                  ? 'bg-bg-white-var text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewGroup(true)}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="新建分组"
          >
            <Icon name="add" size={14} />
          </button>
        </div>

        {/* New group input */}
        {showNewGroup && (
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') handleAddGroup();
                if (e.key === 'Escape') setShowNewGroup(false);
              }}
              placeholder="分组名称..."
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border bg-bg-white-var focus:border-primary outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddGroup}
              disabled={!newGroupName.trim()}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              创建
            </button>
          </div>
        )}
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-auto px-2 py-2 dcf-scrollbar">
        {(() => {
          const pinnedRooms = rooms.filter((r) => r.pinned);
          const botRooms = rooms.filter((r) => !r.pinned && r.type === 'bot');
          const normalRooms = rooms.filter((r) => !r.pinned && r.type !== 'bot');
          return (
            <>
              {/* 编排者 Agent — 仅 Almighty 模式常驻置顶 */}
              {isOC && (
                <>
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => onSelectRoom('orchestrator-agent')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        currentRoomId === 'orchestrator-agent'
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'hover:bg-bg-hover'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        AI
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-[13px] font-semibold text-text-primary">编排者</div>
                        <div className="text-[11px] text-text-muted truncate">
                          任务分解 · 协调调度 · 常驻
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    </button>
                  </div>
                  <div className="h-px bg-border mx-2 mb-2" />
                </>
              )}

              {pinnedRooms.length > 0 && (
                <>
                  <SectionLabel>置顶</SectionLabel>
                  <div className="flex flex-col gap-0.5 mb-2">
                    {pinnedRooms.map((room) => (
                      <RoomListItem
                        key={room.id}
                        room={room}
                        isActive={room.id === currentRoomId}
                        onClick={() => onSelectRoom(room.id)}
                        onLeave={onLeaveRoom}
                      />
                    ))}
                  </div>
                  <div className="h-px bg-border mx-2 mb-2" />
                </>
              )}

              {/* 数字员工对话 */}
              {botRooms.length > 0 && (
                <>
                  <SectionLabel>数字员工</SectionLabel>
                  <div className="flex flex-col gap-0.5 mb-2">
                    {botRooms.map((room) => (
                      <RoomListItem
                        key={room.id}
                        room={room}
                        isActive={room.id === currentRoomId}
                        onClick={() => onSelectRoom(room.id)}
                        onLeave={onLeaveRoom}
                      />
                    ))}
                  </div>
                  <div className="h-px bg-border mx-2 mb-2" />
                </>
              )}

              {/* 普通会话 */}
              <div className="flex flex-col gap-0.5">
                {normalRooms.map((room) => (
                  <RoomListItem
                    key={room.id}
                    room={room}
                    isActive={room.id === currentRoomId}
                    onClick={() => onSelectRoom(room.id)}
                    onLeave={onLeaveRoom}
                  />
                ))}
                {rooms.length === 0 && (
                  <p className="text-xs text-text-muted px-2 py-4">暂无会话</p>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {/* Tab context menu */}
      {tabMenu && (
        <GroupTabContextMenu
          groupId={tabMenu.groupId}
          position={{ x: tabMenu.x, y: tabMenu.y }}
          onClose={() => setTabMenu(null)}
        />
      )}
    </div>
  );
}
