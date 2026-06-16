import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAdminAssistantStore } from '../../../application/stores/adminAssistantStore';
import { Icon } from '../../components/ui/Icon';

function AssistantPanel() {
  const messages = useAdminAssistantStore((s) => s.messages);
  const loading = useAdminAssistantStore((s) => s.loading);
  const toggle = useAdminAssistantStore((s) => s.toggle);
  const send = useAdminAssistantStore((s) => s.send);
  const clearHistory = useAdminAssistantStore((s) => s.clearHistory);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    send(text);
  }, [input, loading, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return createPortal(
    <div className="fixed right-6 bottom-24 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-[9998] animate-[panel-in_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <img src="/mascot-avatar.svg" alt="" className="w-7 h-7 rounded-full object-cover" />
          <span className="text-sm font-semibold text-gray-800">AI 助手</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="清空对话"
          >
            <Icon name="delete_sweep" size={16} />
          </button>
          <button
            onClick={toggle}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <img
              src="/mascot-avatar.svg"
              alt=""
              className="w-16 h-16 rounded-full mb-3 opacity-80"
            />
            <p className="text-sm text-gray-500">你好！我是 AI Assistant</p>
            <p className="text-xs text-gray-400 mt-1">可以帮你查看平台数据、分析运行状态</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#007AFF] text-white rounded-br-sm whitespace-pre-wrap'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm assistant-markdown'
              }`}
            >
              {msg.role === 'assistant' ? (
                <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl rounded-bl-sm text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors max-h-20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 flex items-center justify-center bg-[#007AFF] text-white rounded-lg disabled:opacity-40 hover:bg-[#0066DD] transition-colors"
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .assistant-markdown h2 { font-size: 0.8125rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .assistant-markdown h3 { font-size: 0.75rem; font-weight: 600; margin: 0.375rem 0 0.25rem; }
        .assistant-markdown p { margin: 0.25rem 0; }
        .assistant-markdown ul, .assistant-markdown ol { margin: 0.25rem 0; padding-left: 1.25rem; }
        .assistant-markdown li { margin: 0.125rem 0; }
        .assistant-markdown code { font-size: 0.75rem; background: rgba(0,0,0,0.06); padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
        .assistant-markdown pre { background: rgba(0,0,0,0.06); padding: 0.5rem; border-radius: 0.375rem; overflow-x: auto; margin: 0.25rem 0; }
        .assistant-markdown pre code { background: none; padding: 0; }
        .assistant-markdown table { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 0.25rem 0; }
        .assistant-markdown th, .assistant-markdown td { border: 1px solid #e5e7eb; padding: 0.25rem 0.5rem; text-align: left; }
        .assistant-markdown th { background: rgba(0,0,0,0.03); font-weight: 600; }
        .assistant-markdown strong { font-weight: 600; }
        .assistant-markdown > *:first-child { margin-top: 0; }
        .assistant-markdown > *:last-child { margin-bottom: 0; }
      `}</style>
    </div>,
    document.body
  );
}

export function AdminAssistant() {
  const open = useAdminAssistantStore((s) => s.open);
  const toggle = useAdminAssistantStore((s) => s.toggle);

  return (
    <>
      {/* Floating Avatar Button */}
      <button
        onClick={toggle}
        className="fixed right-6 bottom-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 z-[9997] overflow-hidden border-2 border-white"
        title="AI 助手"
      >
        <img src="/mascot-avatar.svg" alt="AI 助手" className="w-full h-full object-cover" />
      </button>

      {/* Chat Panel */}
      {open && <AssistantPanel />}
    </>
  );
}
