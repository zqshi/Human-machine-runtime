import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/ui/Icon';
import type { ChatMessage } from '../../../domain/chat/ChatMessage';

export interface MessageAction {
  key: string;
  icon: string;
  label: string;
  danger?: boolean;
}

interface MessageContextMenuProps {
  message: ChatMessage;
  isOwn: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onAction: (action: string, message: ChatMessage) => void;
}

function getActions(message: ChatMessage, isOwn: boolean): MessageAction[] {
  const actions: MessageAction[] = [
    { key: 'reply', icon: 'reply', label: '回复' },
    { key: 'copy', icon: 'content_copy', label: '复制文本' },
  ];

  if (isOwn && message.contentType === 'text') {
    actions.push({ key: 'edit', icon: 'edit', label: '编辑' });
  }

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (isOwn && message.timestamp > fiveMinAgo) {
    actions.push({ key: 'redact', icon: 'delete_outline', label: '撤回', danger: true });
  }

  return actions;
}

export function MessageContextMenu({
  message,
  isOwn,
  position,
  onClose,
  onAction,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const close = () => onClose();
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
  }, [position, onClose]);

  if (!position) return null;

  const actions = getActions(message, isOwn);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[140px] py-1 bg-bg-white-var/95 backdrop-blur-xl border border-border rounded-xl shadow-card animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={() => {
            onAction(action.key, message);
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
            action.danger ? 'text-red-500 hover:bg-red-50' : 'text-text-primary hover:bg-bg-hover'
          }`}
        >
          <Icon
            name={action.icon}
            size={14}
            className={action.danger ? 'text-red-400' : 'text-text-secondary'}
          />
          {action.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
