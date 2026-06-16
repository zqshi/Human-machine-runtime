/**
 * HTMLPreviewPanel — HTML 渲染预览 + AI 优化建议 (stitch_7 对齐)
 * 浏览器框预览区 + 元素选取按钮 + 代码查看 + AI 优化建议浮层
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface HTMLPreviewPanelProps {
  onClose?: () => void;
}

export function HTMLPreviewPanel({ onClose: _onClose }: HTMLPreviewPanelProps) {
  const [showAISuggestion, setShowAISuggestion] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Browser chrome header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-fill-tertiary/30 border-b border-border">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-error" />
          <span className="w-3 h-3 rounded-full bg-warning" />
          <span className="w-3 h-3 rounded-full bg-success" />
        </div>
        {/* Nav arrows */}
        <button type="button" onClick={() => useToastStore.getState().addToast('导航功能开发中', 'info')} className="p-0.5 text-text-muted">
          <Icon name="chevron_left" size={16} />
        </button>
        <button type="button" onClick={() => useToastStore.getState().addToast('导航功能开发中', 'info')} className="p-0.5 text-text-muted">
          <Icon name="chevron_right" size={16} />
        </button>
        {/* URL bar */}
        <div className="flex-1 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-bg-white-var border border-border text-xs text-text-muted">
          <Icon name="lock" size={12} />
          <span>internal.portal/reports/annual-2024</span>
        </div>
        {/* Element select */}
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('元素选取功能开发中', 'info')}
          className="px-3 py-1.5 text-[11px] font-medium text-white bg-primary rounded-full flex items-center gap-1"
        >
          <Icon name="ads_click" size={14} />
          元素选取
        </button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto p-8 relative">
        <div className="max-w-3xl mx-auto">
          {/* Report header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">年度数据报告 FY2024</h1>
              <p className="text-xs text-text-muted mt-1">生成日期：2024年3月24日 · 内部保密</p>
            </div>
            <div className="w-16 h-10 rounded-lg border border-border flex items-center justify-center text-xs text-text-muted">
              LOGO
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs text-text-muted mb-1">活跃用户数</p>
              <p className="text-3xl font-bold text-text-primary">12,500</p>
              <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                <Icon name="trending_up" size={12} /> 14.5% 同比增长
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs text-text-muted mb-1">协作转化率</p>
              <p className="text-3xl font-bold text-text-primary">+45%</p>
              <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                <Icon name="trending_up" size={12} /> 8.2% 较上季度
              </p>
            </div>
          </div>

          {/* Body text */}
          <p className="text-sm text-text-secondary leading-relaxed mb-8">
            在过去的一个财年中，我们的企业协作门户通过集成的 HTML 渲染技术和实时 AI 编辑功能，彻底改变了团队处理文档的方式。
          </p>

          {/* Download button */}
          <div className="flex justify-center mb-8">
            <button type="button" onClick={() => useToastStore.getState().addToast('报告下载功能开发中', 'info')} className="px-8 py-3 rounded-xl border-2 border-surface-dark text-sm font-semibold text-surface-dark hover:bg-surface-dark hover:text-white transition-colors">
              下载完整年度报告 (PDF)
            </button>
          </div>
        </div>

        {/* Side buttons */}
        <div className="absolute right-4 bottom-24 flex flex-col gap-2">
          <button type="button" onClick={() => useToastStore.getState().addToast('已收藏', 'success')} className="w-10 h-10 rounded-xl bg-bg-white-var border border-border shadow-md flex items-center justify-center text-text-secondary hover:text-primary">
            <Icon name="bookmark_border" size={18} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('源码查看功能开发中', 'info')} className="w-10 h-10 rounded-xl bg-bg-white-var border border-border shadow-md flex items-center justify-center text-text-secondary hover:text-primary">
            <Icon name="code" size={18} />
          </button>
        </div>

        {/* AI Suggestion floating panel */}
        {showAISuggestion && (
          <div className="absolute bottom-4 right-4 w-80 bg-bg-white-var rounded-2xl shadow-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Icon name="auto_awesome" size={14} className="text-primary" />
                <span className="text-xs font-semibold text-text-primary">AI 优化建议</span>
              </div>
              <button type="button" onClick={() => setShowAISuggestion(false)} className="p-0.5 text-text-muted hover:text-text-secondary">
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="将按钮改为深色极简风格"
                className="flex-1 px-3 py-2 text-xs border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button type="button" onClick={() => useToastStore.getState().addToast('AI 优化功能开发中', 'info')} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary/90">
                <Icon name="auto_awesome" size={16} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {['极简', '玻璃拟态', '加宽'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => useToastStore.getState().addToast(`已选择样式: ${tag}`, 'info')}
                  className="px-2.5 py-1 text-[10px] rounded-md border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
