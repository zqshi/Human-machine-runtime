/**
 * EventDiscussionView — 事件讨论上下文锚点
 *
 * 仅作为对话流顶部的紧凑上下文指示条，告知用户当前正在讨论哪个事件。
 * 具体分析和建议操作已通过 CoTMessage + SuggestedActionsBlock 注入对话流。
 */
import { useMemo } from 'react';
import { useNotificationStore } from '../../../application/stores/notificationStore';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { Icon } from '../../components/ui/Icon';

const CHANNEL_COLORS: Record<string, string> = {
  lark: '#34C759', email: '#007AFF', slack: '#FF3B30',
  matrix: '#AF52DE', wechat: '#07C160', teams: '#6264A7',
};

const CHANNEL_LABELS: Record<string, string> = {
  lark: '飞书', email: '邮件', slack: 'Slack',
  matrix: 'Matrix', wechat: '微信', teams: 'Teams',
};

export function EventDiscussionView() {
  const discussingNotificationId = useOpenClawStore((s) => s.discussingNotificationId);
  const notifications = useNotificationStore((s) => s.notifications);

  const notification = useMemo(
    () => notifications.find((n) => n.id === discussingNotificationId),
    [notifications, discussingNotificationId],
  );

  if (!notification) return null;

  const channelColor = CHANNEL_COLORS[notification.channel ?? ''] ?? '#64748b';
  const channelLabel = CHANNEL_LABELS[notification.channel ?? ''] ?? notification.channel;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10">
      <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: channelColor }} />
      <span className="text-[10px] text-slate-500 shrink-0">{channelLabel}</span>
      <span className="text-[11px] text-slate-300 truncate flex-1">
        {notification.sender.name}: {notification.body}
      </span>
      {notification.isNeedsHuman && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium shrink-0">待处理</span>
      )}
      <button
        type="button"
        onClick={() => useOpenClawStore.getState().setDiscussingNotificationId(null)}
        className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
