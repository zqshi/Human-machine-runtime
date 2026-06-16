/**
 * DiscussionInitPage — 事件讨论初始化界面
 *
 * 作为 discuss-<id> 对话的顶部上下文锚点，提供完整的讨论背景：
 * - 事件来源（渠道/发送人/内容）
 * - 对话脉络摘要（时间线）
 * - Agent 初始判断
 * - 关闭讨论按钮
 */
import { useMemo, useState } from 'react';
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

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function DiscussionInitPage() {
  const discussingNotificationId = useOpenClawStore((s) => s.discussingNotificationId);
  const notifications = useNotificationStore((s) => s.notifications);
  const tasks = useOpenClawStore((s) => s.tasks);
  const activeTasks = useMemo(() => tasks.filter((t) => t.isActive), [tasks]);

  const notification = useMemo(
    () => notifications.find((n) => n.id === discussingNotificationId),
    [notifications, discussingNotificationId],
  );

  const [collapsed, setCollapsed] = useState(false);

  if (!notification) return null;

  const channelColor = CHANNEL_COLORS[notification.channel ?? ''] ?? '#64748b';
  const channelLabel = CHANNEL_LABELS[notification.channel ?? ''] ?? notification.channel ?? '';
  const ctxMessages = notification.contextMessages ?? [];
  const reaction = notification.agentReaction;
  const isEmail = notification.channel === 'email';

  // 对话时间线：取最近 5 条关键节点
  const timeline = ctxMessages.length > 0
    ? ctxMessages.slice(-5).map((m) => ({
        sender: m.senderName,
        body: m.body.length > 40 ? m.body.slice(0, 40) + '…' : m.body,
        isOwn: m.isOwn,
        time: formatTimeAgo(m.timestamp),
      }))
    : [];

  const handleClose = () => {
    useOpenClawStore.getState().setDiscussingNotificationId(null);
  };

  // 邮件元数据
  const emailMeta = notification.emailMeta;
  const emailSubject = notification.title.replace(/^Email\s*·\s*/, '');
  const emailDate = notification.timestamp
    ? new Date(notification.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="space-y-3">
      {/* 事件来源卡片 */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header — always visible, click to toggle collapse */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: channelColor }} />
          <Icon name={isEmail ? 'mail' : 'forum'} size={15} className="text-primary shrink-0" />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-xs font-medium text-slate-200 truncate">
              {isEmail ? `邮件讨论：${emailSubject}` : `讨论：${notification.sender.name} 的消息`}
            </span>
            <Icon name={collapsed ? 'expand_more' : 'expand_less'} size={14} className="text-slate-500 shrink-0" />
          </button>
          {collapsed && (
            <span className="text-[10px] text-slate-500 truncate max-w-[200px] shrink-0">
              {notification.body.slice(0, 30)}{notification.body.length > 30 ? '…' : ''}
            </span>
          )}
          <span className="text-[10px] text-slate-500 shrink-0">{channelLabel}</span>
          {notification.isNeedsHuman && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium shrink-0">待处理</span>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Collapsible body */}
        {!collapsed && (
          <div>
        {isEmail ? (
          <div className="px-4 py-3">
            {/* Subject */}
            <h4 className="text-sm font-semibold text-slate-100 mb-2">{emailSubject}</h4>
            {/* Email headers */}
            <div className="space-y-1 mb-2.5 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-8 shrink-0">发件</span>
                <span className="text-[11px] text-slate-300">{notification.sender.name}</span>
              </div>
              {emailMeta?.to && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-8 shrink-0">收件</span>
                  <span className="text-[11px] text-slate-400">{emailMeta.to}</span>
                </div>
              )}
              {emailMeta?.cc && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-8 shrink-0">抄送</span>
                  <span className="text-[11px] text-slate-400">{emailMeta.cc}</span>
                </div>
              )}
              {emailDate && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-8 shrink-0">时间</span>
                  <span className="text-[11px] text-slate-400">{emailDate}</span>
                </div>
              )}
            </div>
            {/* Email body */}
            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">{notification.body}</p>
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-slate-300">{notification.sender.name[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-300 mb-0.5">{notification.sender.name}</p>
                <p className="text-sm text-slate-100 leading-relaxed">{notification.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* 对话脉络 / 邮件往来 */}
        {timeline.length > 0 && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name={isEmail ? 'mail' : 'timeline'} size={12} className="text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">{isEmail ? '邮件往来' : '对话脉络'}</span>
              <span className="text-[10px] text-slate-600">({ctxMessages.length} 条)</span>
            </div>
            <div className="space-y-1.5">
              {timeline.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${item.isOwn ? 'bg-primary' : 'bg-slate-500'}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`text-[10px] ${item.isOwn ? 'text-primary' : 'text-slate-500'}`}>{item.sender}</span>
                    <span className="text-[10px] text-slate-600 ml-1.5">{item.time}</span>
                    <p className="text-[10px] text-slate-400 truncate">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent 初始判断 */}
        {reaction && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="smart_toy" size={12} className="text-primary" />
              <span className="text-[10px] font-medium text-primary">Agent 初始判断</span>
              {reaction.confidence && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  reaction.confidence === 'high' ? 'bg-green-500/15 text-green-400' :
                  reaction.confidence === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {reaction.confidence === 'high' ? '高置信' : reaction.confidence === 'medium' ? '中置信' : '低置信'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300">{reaction.summary}</p>
          </div>
        )}

        {/* 邮件草稿建议 — 如果有 draftReply 则在讨论上下文中突出显示 */}
        {isEmail && reaction?.draftReply && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="edit_note" size={12} className="text-primary" />
              <span className="text-[10px] font-medium text-primary">Agent 建议回复草稿</span>
            </div>
            <div className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.03] px-3 py-2">
              <p className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">{reaction.draftReply}</p>
            </div>
          </div>
        )}

        {/* 当前任务上下文 */}
        {activeTasks.length > 0 && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="running_with_errors" size={12} className="text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">进行中任务</span>
              <span className="text-[10px] text-slate-600">({activeTasks.length})</span>
            </div>
            <div className="space-y-1">
              {activeTasks.map((task) => {
                const runningSub = task.subtasks.find((s) => s.status === 'running');
                return (
                  <div key={task.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
                    <span className="text-[10px] text-slate-300 flex-1 truncate">{task.name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{task.progress}%</span>
                    {runningSub && (
                      <span className="text-[9px] text-slate-600 shrink-0 max-w-[120px] truncate">{runningSub.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
}
