/**
 * KnowledgeAIChat — AI 问答视图
 *
 * 简单对话 UI：消息列表 + 输入框，调 weKnoraApi.chat() 流式渲染回答。
 * 回答中引用来源文档可点击跳转到文档阅读视图。
 */
import { useCallback, useRef, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { weKnoraApi } from '../../../application/services/apiGateway';
import type { WeKnoraChatMessage as ChatMessage } from '../../../application/services/apiGateway';

function generateSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function KnowledgeAIChat({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionIdRef = useRef(generateSessionId());
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setSubView = useUIStore((s) => s.setSubView);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    scrollToBottom();

    // Placeholder for assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', sources: [] };
    setMessages((prev) => [...prev, assistantMsg]);

    // Abort any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await weKnoraApi.chat(sessionIdRef.current, query, {
        onChunk: (text) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + text };
            }
            return updated;
          });
          scrollToBottom();
        },
        onSources: (sources) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, sources };
            }
            return updated;
          });
        },
        onDone: () => setStreaming(false),
        onError: (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content || `请求失败: ${err.message}`,
              };
            }
            return updated;
          });
          setStreaming(false);
        },
        signal: controller.signal,
      });
    } catch {
      setStreaming(false);
    }
  }, [input, streaming, scrollToBottom]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <Icon name="smart_toy" size={20} className="text-primary" />
          <h3 className="text-sm font-semibold text-text-primary">AI 知识问答</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            sessionIdRef.current = generateSessionId();
          }}
          className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
        >
          <Icon name="refresh" size={14} />
          新对话
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
            <Icon name="psychology" size={48} className="text-primary/30" />
            <p className="text-sm">向 AI 提问关于知识库的任何问题</p>
            <div className="flex flex-wrap gap-2 max-w-md">
              {['Q4目标是什么？', '产品规划概述', '安全规范有哪些？'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setInput(q);
                  }}
                  className="px-3 py-1.5 text-xs bg-fill-tertiary rounded-full text-text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-fill-secondary text-text-primary rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">
                {msg.content || (streaming && i === messages.length - 1 ? '思考中...' : '')}
              </p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <p className="text-[10px] font-semibold text-text-muted mb-1">参考来源:</p>
                  {msg.sources.map((src, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setSubView('knowledge:doc-read')}
                      className="block text-[11px] text-primary hover:underline truncate"
                    >
                      {src.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            rows={1}
            className="flex-1 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-bg-white-var"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Icon name="stop" size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Icon name="send" size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
