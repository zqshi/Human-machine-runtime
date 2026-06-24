/**
 * SharedAgentChatView — IM 模式内共享 Agent 对话视图（浅色主题）
 *
 * IM 模式下点击无 Matrix 账号的共享 Agent「对话」时渲染（由 AgentsHub 在
 * imChatAgentId 非空时挂载）。复用 OpenClaw 的对话收发能力（useAgentChat +
 * openclawStore），但以 IM 浅色主题呈现，不切 appMode、不跳 Almighty 工作面板。
 *
 * TODO(runtime-port): useAgentChat 当前绑定 openclaw 运行时；运行时可替换任务
 * 完成前，此处为过渡实现（依赖经 sharedAgentChatService 收敛，见该 service 注释）。
 */
import { useRef, useEffect, useCallback, useState, type KeyboardEvent } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../../components/ui/Icon';
import { useAgentChat } from '../../../application/hooks/useAgentChat';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { sharedAgentChatService } from '../../../application/services/sharedAgentChatService';
import { getCategoryDisplay } from '../../../domain/agent/AgentCategoryConfig';
import { sanitizeHtml } from '../../utils/sanitize';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function SharedAgentChatView() {
  const imChatAgentId = useUIStore((s) => s.imChatAgentId);
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const { messages, sendMessage, isSending } = useAgentChat();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const agent = sharedAgents.find((a) => a.id === imChatAgentId);
  const catDisplay = agent ? getCategoryDisplay(agent.category) : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const resize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    sendMessage(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, isSending, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-white-var">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-light">
        <button
          type="button"
          onClick={() => sharedAgentChatService.close()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-text-secondary hover:bg-bg-hover transition-colors"
          title="返回 Agent Team"
        >
          <Icon name="arrow_back" size={18} />
        </button>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={
            catDisplay
              ? {
                  background: `linear-gradient(135deg, ${catDisplay.color}, ${catDisplay.color}cc)`,
                }
              : undefined
          }
        >
          <Icon name={agent?.icon || 'smart_toy'} size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {agent?.name ?? 'Agent'}
          </div>
          <div className="text-[11px] text-text-muted truncate">{agent?.role}</div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <Icon name="chat" size={36} className="opacity-30" />
            <p className="text-sm">向 {agent?.name ?? 'Agent'} 提问开始对话</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-fill-tertiary text-text-primary border border-border'
                }`}
              >
                {msg.html ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.html) }} />
                ) : msg.role !== 'user' && msg.text ? (
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                ) : (
                  msg.text
                )}
                <div
                  className={`text-[10px] mt-1 ${
                    msg.role === 'user' ? 'text-white/70 text-right' : 'text-text-muted'
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3 bg-bg-light">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-bg-white-var px-2 py-1.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`向 ${agent?.name ?? 'Agent'} 提问…`}
            className="flex-1 min-h-[36px] max-h-[140px] resize-none outline-none text-sm text-text-primary placeholder:text-text-muted bg-transparent py-1.5"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white disabled:opacity-40 hover:bg-primary-dark transition-colors shrink-0"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
