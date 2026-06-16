/**
 * AIAssistantPanel — AI 代码助手侧面板
 * 提供快捷操作按钮、聊天式消息区、自定义问题输入
 */
import { useState, useCallback, type KeyboardEvent } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  { label: '解释代码', icon: 'menu_book' },
  { label: '优化建议', icon: 'lightbulb' },
  { label: '生成测试', icon: 'science' },
  { label: '添加注释', icon: 'comment' },
] as const;

export function AIAssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const addMessage = useCallback((content: string, role: 'user' | 'assistant' = 'user') => {
    const msg: Message = { id: `${Date.now()}-${Math.random()}`, role, content };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const handleQuickAction = (label: string) => {
    addMessage(label);
    // Simulate AI response
    setTimeout(() => {
      addMessage(`正在处理「${label}」请求，请稍候...`, 'assistant');
    }, 500);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMessage(text);
    setTimeout(() => {
      addMessage('收到你的问题，正在分析代码...', 'assistant');
    }, 500);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-white-var border-l border-border" style={{ width: 320 }}>
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
        <Icon name="smart_toy" size={18} className="text-primary" />
        <span className="text-sm font-semibold text-text-primary">AI 助手</span>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border shrink-0">
        {QUICK_ACTIONS.map((action) => (
          <Button key={action.label} variant="secondary" size="sm" onClick={() => handleQuickAction(action.label)}>
            <Icon name={action.icon} size={14} className="mr-1" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto p-4 space-y-3 hmr-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-text-muted text-xs pt-8">
            <Icon name="chat_bubble_outline" size={32} className="mx-auto mb-2 opacity-40" />
            <p>选择快捷操作或输入问题开始对话</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'ml-auto bg-primary text-white rounded-br-sm'
                : 'mr-auto bg-bg-light text-text-primary rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            className="flex-1 h-8 px-3 rounded-lg border border-border bg-bg-light text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button onClick={handleSend} disabled={!input.trim()} className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-white disabled:opacity-40">
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
