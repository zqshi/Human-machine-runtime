import { Icon } from '../../components/ui/Icon';
import { APP_TEMPLATES, type AppTemplate, type ChatMessage } from './ai-creation-helpers';

export function EmptyChat({
  onSelect,
  onHover,
}: {
  onSelect: (text: string) => void;
  onHover: (tpl: AppTemplate | null) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-5">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon name="auto_awesome" size={24} className="text-primary" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-text-primary">AI 应用创建助手</p>
        <p className="text-xs text-text-muted leading-relaxed max-w-[260px]">
          选择模板快速开始，或直接描述需求
        </p>
      </div>
      <div className="w-full space-y-2">
        {APP_TEMPLATES.map((tpl) => (
          <button
            key={tpl.key}
            type="button"
            onClick={() => onSelect(tpl.prompt)}
            onMouseEnter={() => onHover(tpl)}
            onMouseLeave={() => onHover(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-bg-white-var hover:border-primary/40 hover:shadow-sm transition-all text-left group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${tpl.color}14` }}
            >
              <Icon name={tpl.icon} size={18} style={{ color: tpl.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">
                {tpl.name}
              </p>
              <p className="text-[10px] text-text-muted truncate">{tpl.tagline}</p>
            </div>
            <Icon
              name="arrow_forward"
              size={14}
              className="text-text-muted group-hover:text-primary shrink-0 transition-colors"
            />
          </button>
        ))}
      </div>
      <p className="text-[10px] text-text-muted">
        或直接输入自定义需求，如「做一个会议室预约系统」
      </p>
    </div>
  );
}

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-thinking') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="psychology" size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Icon name="psychology" size={12} />
            思考过程
            {msg.streaming && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div className="text-xs text-text-secondary leading-relaxed bg-fill-tertiary border border-border rounded-xl px-3 py-2.5 whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-action') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="smart_toy" size={14} className="text-primary" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fill-tertiary border border-border text-xs">
          <Icon name={msg.actionIcon || 'build'} size={14} className="text-primary" />
          <span className="font-medium text-text-primary">{msg.actionLabel}</span>
          <span className="text-text-muted">{msg.content}</span>
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-code') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="smart_toy" size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Icon name="code" size={12} />
            创建文件
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-gray-800 px-3 py-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <pre className="bg-gray-900 text-green-400 text-[11px] leading-relaxed px-3 py-3 overflow-x-auto">
              <code>{msg.content}</code>
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon name="smart_toy" size={14} className="text-primary" />
      </div>
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-fill-tertiary border border-border text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );
}
