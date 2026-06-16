/**
 * AIHTMLEditDiff — AI HTML 编辑视觉差异对比 (ai_ai_html_edit_diff 对齐)
 * 左栏: AI对话 (项目名+聊天消息)
 * 右栏: 视觉差异对比 (修改前 BEFORE vs 修改后 AFTER) + 底部应用确认栏
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

const MESSAGES: ChatMessage[] = [
  {
    role: 'ai',
    content:
      '我已经分析了当前的 CTA 按钮。它目前的点击率低于预期。建议将其颜色改为品牌紫色，增加圆角半径，并将文字改为更有行动感的"立即开始"。',
  },
  {
    role: 'user',
    content: '好的，请生成修改建议并展示对比。',
  },
  {
    role: 'ai',
    content: '修改已就绪。您可以在右侧的对比面板中查看视觉差异。',
  },
];

const CHANGE_ITEMS = [
  { icon: 'add_circle', color: '#34C759', text: '新增图标元素' },
  { icon: 'palette', color: '#FF9500', text: '圆角 4px → 12px' },
  { icon: 'text_fields', color: '#007AFF', text: '转化率优化用词' },
];

interface AIHTMLEditDiffProps {
  onClose?: () => void;
}

export function AIHTMLEditDiff({ onClose }: AIHTMLEditDiffProps) {
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('after');
  const [activeNav, setActiveNav] = useState('chat_bubble');
  const [chatInput, setChatInput] = useState('');

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left sidebar - nav icons */}
      <div className="w-14 bg-bg-white-var border-r border-border flex flex-col items-center py-4 gap-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="auto_awesome" size={20} className="text-primary" />
        </div>
        <div className="w-px h-4 bg-border" />
        {[
          { icon: 'chat_bubble', active: true },
          { icon: 'folder', active: false },
          { icon: 'bar_chart', active: false },
          { icon: 'settings', active: false },
        ].map((item) => (
          <button
            key={item.icon}
            type="button"
            onClick={() => setActiveNav(item.icon)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeNav === item.icon
                ? 'bg-primary/10 text-primary'
                : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
            }`}
          >
            <Icon name={item.icon} size={20} />
          </button>
        ))}
      </div>

      {/* Left chat panel */}
      <div className="w-[380px] border-r border-border flex flex-col">
        {/* Project header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Marketing Homepage Project</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-medium text-success border border-success/30 rounded-full">
              ACTIVE
            </span>
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('搜索功能开发中', 'info')}
              className="p-1 text-text-muted hover:text-text-secondary"
            >
              <Icon name="search" size={18} />
            </button>
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('更多操作开发中', 'info')}
              className="p-1 text-text-muted hover:text-text-secondary"
            >
              <Icon name="more_horiz" size={18} />
            </button>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {MESSAGES.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="smart_toy" size={16} className="text-primary" />
                </div>
              )}
              <div
                className={`max-w-[280px] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-2xl rounded-br-md'
                    : 'bg-fill-tertiary/30 text-text-secondary rounded-2xl rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-warning">U</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="smart_toy" size={14} className="text-primary" />
            </div>
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('附件上传功能开发中', 'info')}
              className="p-1 text-text-muted hover:text-text-secondary"
            >
              <Icon name="add_circle" size={20} />
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="输入指令..."
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
            />
          </div>
        </div>
      </div>

      {/* Right diff panel */}
      <div className="flex-1 flex flex-col">
        {/* Diff header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-text-primary">视觉差异对比</h3>
            <p className="text-xs text-text-muted">正在比较: .hero-cta-button</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('代码预览功能开发中', 'info')}
              className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5"
            >
              <Icon name="code" size={14} /> 查看代码
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-text-muted hover:text-text-secondary"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Before panel */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-fill-tertiary/20">
              <button
                type="button"
                onClick={() => setActiveTab('before')}
                className={`text-xs font-medium ${activeTab === 'before' ? 'text-primary' : 'text-text-muted'}`}
              >
                修改前 (BEFORE)
              </button>
              <span className="text-[10px] text-text-muted">v1.2.4</span>
            </div>
            <div className="flex-1 bg-surface-dark flex items-center justify-center p-8">
              {/* Before content placeholder */}
              <div className="w-full max-w-sm space-y-4">
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-full" />
                <div className="h-3 bg-white/10 rounded w-2/3" />
                <div className="h-3 bg-white/10 rounded w-5/6" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
                <div className="flex justify-center mt-8">
                  <div className="px-8 py-3 bg-[#333] text-white text-sm rounded border border-white/20">
                    Submit Request
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* After panel */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-fill-tertiary/20">
              <button
                type="button"
                onClick={() => setActiveTab('after')}
                className={`text-xs font-medium ${activeTab === 'after' ? 'text-primary' : 'text-text-muted'}`}
              >
                修改后 (AFTER)
              </button>
              <span className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                AI 优化
              </span>
            </div>
            <div className="flex-1 bg-surface-dark flex items-center justify-center p-8 relative">
              {/* After content placeholder */}
              <div className="w-full max-w-sm space-y-4">
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/15 rounded w-full" />
                <div className="h-3 bg-white/10 rounded w-2/3" />
                <div className="h-3 bg-white/15 rounded w-5/6" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
                <div className="flex justify-center mt-8">
                  {/* Highlighted changed button */}
                  <div className="relative">
                    <span className="absolute -top-6 right-0 px-2 py-0.5 text-[9px] text-white bg-primary rounded-full whitespace-nowrap">
                      radius: 12px; gradient applied
                    </span>
                    <div className="px-8 py-3 bg-gradient-to-r from-[#007AFF] to-[#0055D4] text-white text-sm rounded-xl font-medium flex items-center gap-2 ring-2 ring-[#007AFF]/50 ring-offset-2 ring-offset-[#1C1C1E]">
                      立即开始 <Icon name="arrow_forward" size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom confirmation bar */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border">
          {/* Change details */}
          <div className="flex items-center gap-4">
            {CHANGE_ITEMS.map((item, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-text-secondary">
                <Icon name={item.icon} size={14} style={{ color: item.color }} />
                {item.text}
              </span>
            ))}
          </div>

          {/* Apply confirmation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="auto_fix_high" size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-text-primary">应用此更改吗？</p>
                <p className="text-[10px] text-text-muted">此操作将更新所有相关页面</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover rounded-lg"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('AI 编辑已应用', 'success')}
              className="px-4 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
            >
              确认应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
