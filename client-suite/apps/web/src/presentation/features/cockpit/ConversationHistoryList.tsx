/**
 * ConversationHistoryList — 对话历史列表
 *
 * 显示所有历史对话会话，支持新建对话和切换对话。
 */
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import type { ConversationSession } from '../../../application/stores/cockpitStore';
import { Icon } from '../../components/ui/Icon';

const TYPE_ICONS: Record<string, string> = {
  primary: 'chat',
  discussion: 'forum',
  shared: 'smart_toy',
};

const TYPE_COLORS: Record<string, string> = {
  primary: 'text-primary',
  discussion: 'text-orange-400',
  shared: 'text-purple-400',
};

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function SessionCard({
  session,
  isActive,
  onClick,
}: {
  session: ConversationSession;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
        isActive
          ? 'border-primary/40 bg-primary/[0.08]'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Icon
          name={TYPE_ICONS[session.type] ?? 'chat'}
          size={12}
          className={TYPE_COLORS[session.type] ?? 'text-primary'}
        />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{session.title}</span>
      </div>
      <div className="flex items-center gap-2 pl-[20px]">
        <span className="text-[10px] text-slate-500">{formatTime(session.lastMessageAt)}</span>
        {session.messageCount > 0 && (
          <span className="text-[10px] text-slate-600">{session.messageCount} 条消息</span>
        )}
      </div>
    </button>
  );
}

export function ConversationHistoryList() {
  const sessions = useCockpitStore((s) => s.conversationSessions);
  const activeConversationId = useCockpitStore((s) => s.activeConversationId);
  const switchToSession = useCockpitStore((s) => s.switchToSession);

  // 主对话置顶，其余按 lastMessageAt 倒序
  const sorted = [...sessions].sort((a, b) => {
    if (a.id === 'primary') return -1;
    if (b.id === 'primary') return 1;
    return b.lastMessageAt - a.lastMessageAt;
  });

  return (
    <div className="p-2 space-y-2">
      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Icon name="chat_bubble_outline" size={32} className="text-slate-600 mb-2" />
          <p className="text-[11px]">暂无对话记录</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={activeConversationId === session.id}
              onClick={() => switchToSession(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
