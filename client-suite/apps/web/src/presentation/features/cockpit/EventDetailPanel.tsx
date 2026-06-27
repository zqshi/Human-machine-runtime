/**
 * EventDetailPanel — B 栏事件详情面板
 *
 * 三条操作路径：
 * 1. 采纳 — 发送 Agent 草稿到外部渠道 + 注入 C 栏对话，面板不关闭
 * 2. 修改 — 将草稿填充到 C 栏输入框，用户自行编辑后发送
 * 3. 和 Agent 讨论 — C 栏显示事件讨论卡片 + Agent 建议快捷操作
 *
 * Agent 建议区域提供完整的推理审计链，用户无需离开即可理解判断依据。
 */
import { useState } from 'react';
import { useNotificationStore } from '../../../application/stores/notificationStore';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';
import { CoTMessage } from '../../../domain/agent/CoTMessage';
import type { Confidence, ReasoningStep, ContextMessage } from '../../../domain/notification/Notification';

const CHANNEL_COLORS: Record<string, string> = {
  lark: '#34C759', email: '#007AFF', slack: '#FF3B30',
  matrix: '#AF52DE', wechat: '#07C160', teams: '#6264A7',
};

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; color: string; bgColor: string }> = {
  high: { label: '高置信', color: '#34C759', bgColor: 'rgba(52,199,89,0.1)' },
  medium: { label: '中置信', color: '#FF9500', bgColor: 'rgba(255,149,0,0.1)' },
  low: { label: '低置信', color: '#FF3B30', bgColor: 'rgba(255,59,48,0.1)' },
};

const CHANNEL_LABELS: Record<string, string> = {
  lark: '飞书', email: '邮件', slack: 'Slack',
  matrix: 'Matrix', wechat: '微信', teams: 'Teams',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function ReasoningChain({ steps }: { steps: ReasoningStep[] }) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={13} />
        <span>推理过程</span>
        <span className="text-slate-600">{steps.length} 步</span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 pl-3 border-l border-primary/15">
          {steps.map((step, i) => (
            <div key={i}>
              <p className="text-[10px] font-medium text-slate-300">{step.label}</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">{step.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 邮件时间格式化 */
function formatEmailDate(ts: string): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

/** 单封邮件渲染（主邮件 + 邮件线程中的历史邮件） */
function EmailMessage({ msg, isMain }: { msg: { senderName: string; body: string; timestamp: number }; isMain?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isMain ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
      {/* 邮件头：发件人 + 时间 */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-slate-300">{msg.senderName[0]}</span>
          </div>
          <span className={`text-[11px] font-medium ${isMain ? 'text-slate-200' : 'text-slate-400'}`}>{msg.senderName}</span>
        </div>
        <span className="text-[9px] text-slate-600 shrink-0">
          {formatTime(msg.timestamp)}
        </span>
      </div>
      {/* 邮件正文 */}
      <p className={`text-[11px] leading-relaxed whitespace-pre-line ${isMain ? 'text-slate-100' : 'text-slate-400'}`}>{msg.body}</p>
    </div>
  );
}

/** 邮件详情渲染 — 替代聊天气泡，以邮件结构展示 */
function EmailDetail({
  subject,
  senderName,
  body,
  timestamp,
  to,
  cc,
  threadMessages,
}: {
  subject: string;
  senderName: string;
  body: string;
  timestamp: string;
  to?: string;
  cc?: string;
  threadMessages?: ContextMessage[];
}) {
  return (
    <div className="space-y-3">
      {/* 邮件主题 */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
        <h4 className="text-sm font-semibold text-slate-100 mb-2">{subject}</h4>

        {/* From / To / Date */}
        <div className="space-y-1 mb-3 pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-8 shrink-0">发件</span>
            <span className="text-[11px] text-slate-300">{senderName}</span>
          </div>
          {to && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-8 shrink-0">收件</span>
              <span className="text-[11px] text-slate-400">{to}</span>
            </div>
          )}
          {cc && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-8 shrink-0">抄送</span>
              <span className="text-[11px] text-slate-400">{cc}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-8 shrink-0">时间</span>
            <span className="text-[11px] text-slate-400">{formatEmailDate(timestamp)}</span>
          </div>
        </div>

        {/* 邮件正文 */}
        <p className="text-[12px] text-slate-200 leading-relaxed whitespace-pre-line">{body}</p>
      </div>

      {/* 邮件线程 — 历史往来以邮件形式展示 */}
      {threadMessages && threadMessages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="mail" size={12} className="text-slate-500" />
            <span className="text-[10px] font-medium text-slate-400">邮件往来</span>
            <span className="text-[10px] text-slate-600">({threadMessages.length})</span>
          </div>
          <div className="space-y-2">
            {threadMessages.map((msg) => (
              <EmailMessage key={msg.id} msg={msg} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EventDetailPanel() {
  const selectedNotificationId = useNotificationStore((s) => s.selectedNotificationId);
  const notifications = useNotificationStore((s) => s.notifications);
  const acceptAgentReply = useNotificationStore((s) => s.acceptAgentReply);
  const sendInboxReply = useNotificationStore((s) => s.sendInboxReply);
  const delegateToAgent = useNotificationStore((s) => s.delegateToAgent);
  const selectNotification = useNotificationStore((s) => s.selectNotification);

  const notification = notifications.find((n) => n.id === selectedNotificationId);

  const [quickReply, setQuickReply] = useState('');
  const [isQuickSending, setIsQuickSending] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  if (!notification) return null;

  const channelColor = CHANNEL_COLORS[notification.channel ?? ''] ?? '#64748b';
  const channelLabel = CHANNEL_LABELS[notification.channel ?? ''] ?? notification.channel;
  const draft = notification.agentReaction?.draftReply ?? '';
  const confidence = notification.agentReaction?.confidence;
  const reasoningSteps = notification.agentReaction?.reasoningSteps ?? [];
  const suggestedActions = notification.agentReaction?.suggestedActions ?? [];
  const isEmail = notification.channel === 'email';
  const needsHuman = notification.isNeedsHuman;

  const close = () => selectNotification(null);

  /** 采纳：发送到外部渠道 + 注入 C 栏对话，面板不关闭 */
  const handleAccept = async () => {
    if (!draft) return;
    setIsAccepting(true);
    try {
      await acceptAgentReply(notification.id);

      // 注入消息到 C 栏对话
      const store = useCockpitStore.getState();
      const sessionId = store.sessionId ?? '';
      const userMsg = CoTMessage.create({
        id: `m-${Date.now()}`,
        agentId: 'primary',
        sessionId,
        role: 'user',
        text: draft,
        timestamp: Date.now(),
      });
      store.appendMessage(userMsg);

      const botMsg = CoTMessage.create({
        id: `r-${Date.now()}`,
        agentId: 'primary',
        sessionId,
        role: 'agent',
        text: `已通过 ${channelLabel} 渠道发送回复给 ${notification.sender.name}。`,
        timestamp: Date.now(),
        cotSteps: [{
          id: `s-${Date.now()}`,
          label: '回复发送完成',
          status: 'done',
          detail: `已将回复通过 ${channelLabel} 渠道送达 ${notification.sender.name}`,
        }],
      });
      store.appendMessage(botMsg);

      useToastStore.getState().addToast('已采纳并发送', 'success');
    } finally {
      setIsAccepting(false);
    }
  };

  /** 修改：将草稿填充到 C 栏输入框 */
  const handleEdit = () => {
    useCockpitStore.getState().setComposerPrefill(draft);
  };

  /** 忽略 Agent 建议 */
  const handleDismiss = () => {
    useToastStore.getState().addToast('已忽略建议', 'info');
  };

  /** 全权委托 Agent */
  const handleDelegate = () => {
    delegateToAgent(notification.id);
    useToastStore.getState().addToast('已授权 Agent 自动处理', 'success');
  };

  /** 快速回复：直接发送到外部渠道，不走 Agent */
  const handleQuickSend = async () => {
    if (!quickReply.trim()) return;
    setIsQuickSending(true);
    try {
      await sendInboxReply(notification.id, quickReply.trim());
      useToastStore.getState().addToast('已直接回复', 'success');
      setQuickReply('');
    } finally {
      setIsQuickSending(false);
    }
  };

  return (
    <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden animate-[slideInLeft_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: channelColor }}
        />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{notification.sender.name}</span>
        <span className="text-[9px] text-slate-500 shrink-0">{channelLabel}</span>
        <button
          type="button"
          onClick={handleDelegate}
          className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors shrink-0"
        >
          <Icon name="auto_awesome" size={12} />
          全权
        </button>
        <button
          type="button"
          onClick={close}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Scrollable content: email detail or chat-style */}
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3">
        {isEmail ? (
          <EmailDetail
            subject={notification.title.replace(/^Email\s*·\s*/, '')}
            senderName={notification.sender.name}
            body={notification.body}
            timestamp={notification.timestamp}
            to={notification.emailMeta?.to}
            cc={notification.emailMeta?.cc}
            threadMessages={notification.contextMessages}
          />
        ) : (
          <div className="space-y-3">
            {/* Notification body (always visible) */}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-slate-300">{notification.sender.name[0]}</span>
                </div>
                <span className="text-[11px] font-medium text-slate-300">{notification.sender.name}</span>
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">{notification.body}</p>
            </div>

            {/* Context messages thread */}
            {notification.contextMessages && notification.contextMessages.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="chat" size={12} className="text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-400">对话上下文</span>
                  <span className="text-[10px] text-slate-600">({notification.contextMessages.length})</span>
                </div>
                <div className="space-y-2">
                  {notification.contextMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                        msg.isOwn ? 'bg-primary/10 text-slate-200' : 'bg-white/[0.04] text-slate-300'
                      }`}>
                        <p className="text-[9px] font-medium mb-0.5 text-slate-400">{msg.senderName}</p>
                        <p>{msg.body}</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">{formatTime(msg.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom */}
      <div className="border-t border-white/10 shrink-0">
        {/* Escalation banner — when Agent needs human intervention */}
        {needsHuman && (
          <div className="px-4 py-2.5 border-b border-white/[0.06]" style={{ backgroundColor: 'rgba(255,149,0,0.06)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-orange-400">需要人工介入</span>
              {confidence && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{
                  color: CONFIDENCE_CONFIG[confidence].color,
                  backgroundColor: CONFIDENCE_CONFIG[confidence].bgColor,
                }}>
                  Agent 置信度: {CONFIDENCE_CONFIG[confidence].label}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
              Agent 已完成初步分析但无法独立做出决策。请审阅下方推理过程后选择操作。
            </p>
            {reasoningSteps.length > 0 && (
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.03] p-2 mb-2">
                <div className="text-[9px] font-semibold text-orange-400 mb-1.5">Agent 执行过程</div>
                {reasoningSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1 last:mb-0">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5" style={{
                      backgroundColor: 'rgba(52,199,89,0.15)',
                      color: '#34C759',
                    }}>{i + 1}</div>
                    <div>
                      <div className="text-[10px] text-slate-300">{step.label}</div>
                      {step.detail && <div className="text-[9px] text-slate-500">{step.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <button type="button" onClick={handleAccept} disabled={!draft || isAccepting}
                className="flex-1 h-6 rounded-md bg-primary text-[10px] text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-1">
                <Icon name={isAccepting ? 'hourglass_top' : 'check'} size={12} />{isAccepting ? '发送中' : '采纳 Agent 建议'}
              </button>
              {draft && (
                <button type="button" onClick={handleEdit}
                  className="flex-1 h-6 rounded-md border border-primary/30 text-[10px] text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1">
                  <Icon name="edit" size={12} />修改后回复
                </button>
              )}
              <button type="button" onClick={handleDelegate}
                className="h-6 px-2 rounded-md border border-white/10 text-[10px] text-slate-400 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                title="委托 Agent 自动处理">
                <Icon name="smart_toy" size={12} />委托
              </button>
            </div>
          </div>
        )}

        {/* Agent suggestion block (仅非邮件 & 非 needs-human 类型，needs-human 已在上方 banner 显示) */}
        {!isEmail && !needsHuman && notification.agentReaction && (
            <div className="px-4 py-2.5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon name="smart_toy" size={12} className="text-primary" />
                  <span className="text-[10px] font-semibold text-primary">Agent 建议</span>
                </div>
                {confidence && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      color: CONFIDENCE_CONFIG[confidence].color,
                      backgroundColor: CONFIDENCE_CONFIG[confidence].bgColor,
                    }}
                  >
                    {CONFIDENCE_CONFIG[confidence].label}
                  </span>
                )}
              </div>

              <p className="text-[10px] text-slate-400">{notification.agentReaction.summary}</p>

              <ReasoningChain steps={reasoningSteps} />

              {draft && (
                <div className="mt-1.5">
                  <div className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.03] px-2.5 py-1.5">
                    <p className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">{draft}</p>
                  </div>
                </div>
              )}

              {/* Suggested actions — data-driven chips */}
              {suggestedActions.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {suggestedActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => useCockpitStore.getState().setComposerPrefill(action.command)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-[10px] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] hover:border-primary/20 transition-colors"
                      >
                        <Icon name={action.icon} size={11} />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!draft || isAccepting}
                  className="flex-1 h-6 rounded-md bg-primary text-[10px] text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <Icon name={isAccepting ? 'hourglass_top' : 'check'} size={12} />
                  {isAccepting ? '发送中' : '采纳'}
                </button>
                {draft && (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="flex-1 h-6 rounded-md border border-primary/30 text-[10px] text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
                  >
                    <Icon name="edit" size={12} />
                    修改
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="h-6 px-2 rounded-md border border-white/10 text-[10px] text-slate-400 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Quick reply (仅非邮件类型) */}
          {!isEmail && (
            <div className="px-4 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="快速回复…"
                  value={quickReply}
                  onChange={(e) => setQuickReply(e.target.value)}
                  onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' && !e.shiftKey) handleQuickSend(); }}
                  disabled={isQuickSending}
                  className="flex-1 bg-white/[0.04] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={handleQuickSend}
                  disabled={!quickReply.trim() || isQuickSending}
                  className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40 shrink-0"
                >
                  <Icon name="send" size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
