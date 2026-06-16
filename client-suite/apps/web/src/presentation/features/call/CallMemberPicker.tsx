import { useState, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/ui/Icon';
import { getMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useCall } from '../../../application/hooks/useCall';
import { useGroupCall } from '../../../application/hooks/useGroupCall';
import type { CallMode } from '../../../domain/call/CallSession';

interface CallMemberPickerProps {
  roomId: string;
  mode: CallMode;
  onClose: () => void;
}

export function CallMemberPicker({ roomId, mode, onClose }: CallMemberPickerProps) {
  const members = useMemo(() => {
    const client = getMatrixClient();
    return client?.getRoomMembers(roomId) ?? [];
  }, [roomId]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.map((m) => m.userId))
  );
  const { placeCall } = useCall();
  const { startGroupCall } = useGroupCall();

  const allSelected = selected.size === members.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.userId)));
    }
  };

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleStart = () => {
    if (selected.size === 0) return;
    onClose();
    if (selected.size === 1) {
      placeCall(roomId, mode);
    } else {
      startGroupCall(roomId, mode);
    }
  };

  const modeLabel = mode === 'video' ? '视频通话' : '语音通话';

  return (
    <Modal open onClose={onClose} title={`${modeLabel} — 选择参会成员`}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm font-medium text-text-primary">全选（{members.length} 人）</span>
        </label>

        <div className="border-t border-border" />

        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {members.map((m) => (
            <label
              key={m.userId}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-bg-hover cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(m.userId)}
                onChange={() => toggle(m.userId)}
                className="w-4 h-4 rounded accent-primary"
              />
              <Avatar letter={m.displayName[0]} size={32} />
              <span className="text-sm text-text-primary flex-1">{m.displayName}</span>
            </label>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">暂无可用成员</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={selected.size === 0}
            className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Icon name={mode === 'video' ? 'videocam' : 'call'} size={16} />
            发起{modeLabel}（{selected.size} 人）
          </button>
        </div>
      </div>
    </Modal>
  );
}
