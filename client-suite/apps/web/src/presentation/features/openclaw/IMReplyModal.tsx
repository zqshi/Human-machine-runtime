/**
 * IMReplyModal — IM 快速回复弹窗 (openclaw_ai_3)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { appEvents } from '../../../application/events/eventBus';

interface IMReplyModalProps {
  roomId?: string;
  senderName?: string;
  originalMessage?: string;
  channel?: string;
  onClose: () => void;
}

const QUICK_REPLIES = ['收到，明白了', '正在检查，请稍等', '让我确认一下'];

export function IMReplyModal({
  roomId,
  senderName,
  originalMessage,
  channel,
  onClose,
}: IMReplyModalProps) {
  const [reply, setReply] = useState('');

  const handleSend = () => {
    if (!reply.trim()) return;
    if (roomId) {
      appEvents.emit('im:reply-sent', { roomId, message: reply.trim() });
    } else if (channel) {
      appEvents.emit('im:cross-channel-reply', {
        channel,
        sender: senderName ?? '',
        message: reply.trim(),
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[420px] rounded-2xl border border-white/10 bg-bg-white-var shadow-2xl overflow-hidden animate-[loginCardIn_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {senderName ?? 'Lark - 王经理'}
            </h3>
            <p className="text-[10px] text-slate-500">刚刚</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Original message */}
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm text-slate-300 leading-relaxed">
            {originalMessage ?? '"安全扫描报告已经看过了，什么时候可以开始下一阶段？"'}
          </p>
        </div>

        {/* Reply input */}
        <div className="px-4 py-3 space-y-3">
          <textarea
            placeholder="输入您的回复..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />

          {/* Quick replies */}
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => setReply(qr)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>
        </div>

        {/* Send */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={handleSend}
            disabled={!reply.trim()}
            className="w-full h-9 rounded-lg bg-primary text-sm text-white font-medium hover:bg-primary-dark disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="send" size={16} />
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
