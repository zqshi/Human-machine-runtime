/**
 * EmailDraftBlock — 邮件草稿结构化卡片
 *
 * 在 C 栏对话中渲染 Agent 草拟的邮件回复，
 * 以真实邮件结构展示（From / To / Subject / Date / Body）。
 */
import { Icon } from '../../../components/ui/Icon';

interface Props {
  from: string;
  to?: string;
  cc?: string;
  subject: string;
  date: string;
  body: string;
}

export function EmailDraftBlockComponent({ from, to, cc, subject, date, body }: Props) {
  return (
    <div className="rounded-xl border border-primary/20 bg-white/[0.03] overflow-hidden">
      {/* 邮件头部 */}
      <div className="flex items-center gap-2 px-3.5 py-2 bg-primary/[0.04] border-b border-primary/10">
        <Icon name="edit_note" size={15} className="text-primary shrink-0" />
        <span className="text-[11px] font-medium text-primary">建议回复草稿</span>
      </div>

      {/* 邮件结构 */}
      <div className="px-3.5 py-2.5 space-y-1.5">
        {/* Subject */}
        <div className="text-sm font-semibold text-slate-100 pb-2 border-b border-white/[0.06]">
          {subject}
        </div>

        {/* From / To / CC / Date */}
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 w-8 shrink-0">发件</span>
            <span className="text-slate-300">{from}</span>
          </div>
          {to && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-8 shrink-0">收件</span>
              <span className="text-slate-400">{to}</span>
            </div>
          )}
          {cc && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-8 shrink-0">抄送</span>
              <span className="text-slate-400">{cc}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 w-8 shrink-0">时间</span>
            <span className="text-slate-400">{date}</span>
          </div>
        </div>

        {/* Body */}
        <div className="pt-2 mt-1 border-t border-white/[0.06]">
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">{body}</p>
        </div>
      </div>
    </div>
  );
}
