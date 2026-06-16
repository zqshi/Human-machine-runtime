/**
 * NotificationCard — 通知列表项（纯摘要，点击 → 右侧 Drawer 详情）
 */
import type { Notification } from '../../../domain/notification/Notification';

const CHANNEL_COLORS: Record<string, string> = {
  lark: '#34C759',
  email: '#007AFF',
  slack: '#FF3B30',
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${Math.floor(diff / 86_400_000)}天前`;
}

interface NotificationCardProps {
  notification: Notification;
  selected: boolean;
  onClick: () => void;
}

export function NotificationCard({ notification: n, selected, onClick }: NotificationCardProps) {
  const channelColor = CHANNEL_COLORS[n.channel ?? ''] ?? '#64748b';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
        selected
          ? 'border-primary/40 bg-primary/[0.08]'
          : n.isUnread
            ? 'border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06]'
            : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ backgroundColor: channelColor }}
          />
          <span className="text-xs font-medium text-slate-200 truncate">{n.title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[10px] text-slate-500">{relativeTime(n.timestamp)}</span>
          {n.isUnread && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 line-clamp-1 pl-3.5">{n.body}</p>
    </button>
  );
}
