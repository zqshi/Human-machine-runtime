import { useState, useCallback } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/ui/Icon';
import { getMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useToastStore } from '../../../application/stores/toastStore';
import type { SearchUserResult } from '../../../domain/shared/types';

interface CreateGroupModalProps {
  onCreated: (roomId: string) => void;
  onClose: () => void;
}

export function CreateGroupModal({ onCreated, onClose }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [selected, setSelected] = useState<SearchUserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSearch = useCallback(
    async (term: string) => {
      setSearchTerm(term);
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }
      const client = getMatrixClient();
      if (!client) return;
      setSearching(true);
      try {
        const results = await client.searchUsers(term);
        const selectedIds = new Set(selected.map((s) => s.userId));
        setSearchResults(results.filter((u) => !selectedIds.has(u.userId)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [selected]
  );

  const handleSelect = (user: SearchUserResult) => {
    setSelected((prev) => [...prev, user]);
    setSearchResults((prev) => prev.filter((u) => u.userId !== user.userId));
  };

  const handleRemove = (userId: string) => {
    setSelected((prev) => prev.filter((u) => u.userId !== userId));
  };

  const handleCreate = async () => {
    if (selected.length === 0) {
      useToastStore.getState().addToast('请至少选择一位成员', 'info');
      return;
    }
    const client = getMatrixClient();
    if (!client) {
      useToastStore.getState().addToast('未连接到服务器', 'error');
      return;
    }
    setCreating(true);
    try {
      const name = groupName.trim() || selected.map((u) => u.displayName).join('、');
      const roomId = await client.createGroupRoom(
        name,
        selected.map((u) => u.userId)
      );
      if (roomId) {
        useToastStore.getState().addToast(`群聊「${name}」创建成功`, 'success');
        onCreated(roomId);
        onClose();
      } else {
        useToastStore.getState().addToast('创建群聊失败', 'error');
      }
    } catch {
      useToastStore.getState().addToast('创建群聊失败', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="新建群聊" width="max-w-sm">
      <div className="space-y-4">
        {/* Group name */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            群名称（可选）
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="不填则自动生成..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var focus:border-primary outline-none"
          />
        </div>

        {/* Selected members */}
        {selected.length > 0 && (
          <div>
            <span className="text-xs font-medium text-text-secondary mb-1 block">
              已选成员 ({selected.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.userId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/8 text-primary text-xs rounded-lg"
                >
                  {u.displayName}
                  <button
                    type="button"
                    onClick={() => handleRemove(u.userId)}
                    className="hover:text-red-500"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search users */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">添加成员</label>
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
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1 dcf-scrollbar">
              {searchResults.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => handleSelect(u)}
                  className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover text-left"
                >
                  <Avatar letter={u.displayName[0]} size={28} />
                  <span className="text-sm text-text-primary flex-1 truncate">{u.displayName}</span>
                  <Icon name="add" size={14} className="text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={selected.length === 0 || creating}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-primary text-white disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {creating
            ? '创建中...'
            : `创建群聊${selected.length > 0 ? ` (${selected.length} 人)` : ''}`}
        </button>
      </div>
    </Modal>
  );
}
