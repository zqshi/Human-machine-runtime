import { useState, useCallback } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/ui/Icon';
import { getMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useToastStore } from '../../../application/stores/toastStore';
import { useChatStore } from '../../../application/stores/chatStore';
import type { SearchUserResult } from '../../../domain/shared/types';

interface GroupInfoPanelProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
}

export function GroupInfoPanel({ roomId, roomName, onClose }: GroupInfoPanelProps) {
  const client = getMatrixClient();
  const { leaveRoom } = useMatrixClient();
  const [members, setMembers] = useState<SearchUserResult[]>(
    () => client?.getRoomMembers(roomId) ?? []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (term: string) => {
      setSearchTerm(term);
      if (!term.trim() || !client) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await client.searchUsers(term);
        const memberIds = new Set(members.map((m) => m.userId));
        setSearchResults(results.filter((u) => !memberIds.has(u.userId)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [client, members]
  );

  const handleInvite = useCallback(
    async (user: SearchUserResult) => {
      if (!client) return;
      setInviting(user.userId);
      try {
        await client.inviteToRoom(roomId, user.userId);
        setMembers((prev) => [...prev, user]);
        setSearchResults((prev) => prev.filter((u) => u.userId !== user.userId));
        useToastStore.getState().addToast(`已邀请 ${user.displayName}`, 'success');
      } catch {
        useToastStore.getState().addToast(`邀请 ${user.displayName} 失败`, 'error');
      } finally {
        setInviting(null);
      }
    },
    [client, roomId]
  );

  const handleLeave = useCallback(async () => {
    if (!leaveRoom) return;
    try {
      await leaveRoom(roomId);
      useChatStore.getState().setCurrentRoom(null);
      useToastStore.getState().addToast('已退出群聊', 'info');
      onClose();
    } catch {
      useToastStore.getState().addToast('退出群聊失败', 'error');
    }
  }, [leaveRoom, roomId, onClose]);

  return (
    <Modal open onClose={onClose} title={roomName} width="max-w-sm">
      <div className="space-y-4">
        {/* Member list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">
              群成员 ({members.length})
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 hmr-scrollbar">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 py-1.5 px-2 rounded-lg">
                <Avatar letter={m.displayName[0]} size={28} />
                <span className="text-sm text-text-primary flex-1 truncate">{m.displayName}</span>
              </div>
            ))}
            {members.length === 0 && <p className="text-xs text-text-muted py-2">暂无其他成员</p>}
          </div>
        </div>

        {/* Invite section */}
        <div>
          <span className="text-xs font-medium text-text-secondary mb-2 block">邀请成员</span>
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索用户..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var focus:border-primary outline-none"
            />
          </div>
          {searching && <p className="text-xs text-text-muted mt-1">搜索中...</p>}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1 hmr-scrollbar">
              {searchResults.map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover"
                >
                  <Avatar letter={u.displayName[0]} size={28} />
                  <span className="text-sm text-text-primary flex-1 truncate">{u.displayName}</span>
                  <button
                    type="button"
                    onClick={() => handleInvite(u)}
                    disabled={inviting === u.userId}
                    className="text-xs text-primary font-medium hover:text-primary/80 disabled:opacity-50"
                  >
                    {inviting === u.userId ? '邀请中...' : '邀请'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave button */}
        <button
          type="button"
          onClick={handleLeave}
          className="w-full py-2 text-sm text-red-500 font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
        >
          退出群聊
        </button>
      </div>
    </Modal>
  );
}
