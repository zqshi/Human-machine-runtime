/**
 * AICreationPanel — 对话式创建（左侧对话 + 右侧实时预览）
 * 借鉴 Coze IDE 分栏模式，用户可通过自然语言持续迭代修改
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { inferDisplayMode, type DisplayMode } from '../../../domain/app/AppTypes';
import { PreviewIdle, PreviewLoading, MobileFrame, TemplatePreview } from './AICreationPreview';
import { EmptyChat, MessageBubble } from './AICreationChat';
import {
  type ChatMessage,
  type PreviewState,
  type ViewportMode,
  type AppTemplate,
  type WorkflowStep,
  APP_TEMPLATES,
  matchTemplate,
  buildInitialWorkflow,
  buildIterationWorkflow,
  nextMsgId,
} from './ai-creation-helpers';
export type { TemplateKey, AppTemplate } from './ai-creation-helpers';
export { APP_TEMPLATES } from './ai-creation-helpers';

/* ─── Main Component ─── */

interface AICreationPanelProps {
  mode: 'create' | 'view' | 'edit';
  onClose: () => void;
  initialAppName?: string | null;
  /** view → edit transition */
  onSwitchToEdit?: () => void;
  /** iOS-style card expand: origin rect from the trigger card */
  originRect?: DOMRect | null;
}

export function AICreationPanel({
  mode,
  onClose,
  initialAppName,
  onSwitchToEdit,
}: AICreationPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (mode === 'edit' && initialAppName) {
      return [
        {
          id: nextMsgId(),
          type: 'ai-text',
          content: `正在编辑应用「${initialAppName}」。\n\n你可以通过自然语言告诉我需要修改的地方，例如：\n- 「把配色改成深色主题」\n- 「增加一个导出按钮」\n- 「标题改成英文」`,
        },
      ];
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>(
    mode === 'create' ? 'idle' : 'ready'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [activeTemplate, setActiveTemplate] = useState<AppTemplate | null>(() => {
    if (mode === 'edit' && initialAppName) {
      const matched = APP_TEMPLATES.find((t) =>
        t.keywords.some((kw) => initialAppName.toLowerCase().includes(kw))
      );
      return matched ?? APP_TEMPLATES[0];
    }
    return mode === 'create' ? null : APP_TEMPLATES[0];
  });

  const [deployStep, setDeployStep] = useState<'mode' | 'confirm'>('mode');
  const [selectedMode, setSelectedMode] = useState<DisplayMode>('tool');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll chat */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Cleanup timers */
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  /* Escape key to close */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* Auto-grow textarea */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  /* Run a workflow: push messages sequentially with delays */
  const runWorkflow = useCallback((steps: WorkflowStep[], onDone?: () => void) => {
    setIsProcessing(true);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setMessages((prev) => {
          // Replace last streaming message if it was thinking
          const last = prev[prev.length - 1];
          if (last?.streaming && step.msg.type !== 'ai-thinking') {
            return [
              ...prev.slice(0, -1),
              { ...last, streaming: false },
              { id: nextMsgId(), ...step.msg },
            ];
          }
          if (last?.streaming && step.msg.type === 'ai-thinking') {
            return [...prev.slice(0, -1), { id: nextMsgId(), ...step.msg }];
          }
          return [...prev, { id: nextMsgId(), ...step.msg }];
        });

        if (i === steps.length - 1) {
          setIsProcessing(false);
          onDone?.();
        }
      }, step.delay);
      timersRef.current.push(t);
    });
  }, []);

  /* First message: user sends initial prompt */
  const handleSend = useCallback(
    (directText?: string) => {
      const text = (directText ?? input).trim();
      if (!text || isProcessing) return;

      const userMsg: ChatMessage = { id: nextMsgId(), type: 'user', content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      // Reset textarea height
      if (inputRef.current) inputRef.current.style.height = 'auto';

      const isFirst = messages.filter((m) => m.type === 'user').length === 0;

      if (isFirst) {
        const tpl = matchTemplate(text);
        setActiveTemplate(tpl);
        setPreviewState('loading');
        const workflow = buildInitialWorkflow(text, tpl);
        runWorkflow(workflow, () => setPreviewState('ready'));
      } else {
        setPreviewState('loading');
        const workflow = buildIterationWorkflow(text);
        runWorkflow(workflow, () => setPreviewState('ready'));
      }
    },
    [input, isProcessing, messages, runWorkflow]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePublish = () => {
    const firstPrompt = messages.find((m) => m.type === 'user')?.content ?? '';
    setSelectedMode(inferDisplayMode(firstPrompt));
    setDeployStep('mode');
    setShowDeployConfirm(true);
  };

  const confirmPublish = () => {
    setShowDeployConfirm(false);
    useToastStore.getState().addToast('应用已发布！', 'success');
    onClose();
  };

  const showChat = mode === 'create' || mode === 'edit';

  const topTitle =
    mode === 'view'
      ? (initialAppName ?? '应用预览')
      : mode === 'edit'
        ? `编辑 · ${initialAppName}`
        : '创建新应用';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-white-var card-expand-in">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-text-secondary transition-colors"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon
                name={mode === 'view' ? 'visibility' : 'auto_awesome'}
                size={14}
                className="text-primary"
              />
            </span>
            <span className="text-sm font-semibold text-text-primary">{topTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Viewport toggle — always visible when preview is ready */}
          {previewState === 'ready' && (
            <div className="flex items-center gap-1 bg-fill-tertiary rounded-lg p-0.5 mr-2">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewportMode === 'desktop'
                    ? 'bg-bg-white-var text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="computer" size={14} />
                桌面端
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewportMode === 'mobile'
                    ? 'bg-bg-white-var text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="smartphone" size={14} />
                移动端
              </button>
            </div>
          )}
          {mode === 'view' && onSwitchToEdit && (
            <button
              type="button"
              onClick={onSwitchToEdit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Icon name="edit" size={14} />
              编辑
            </button>
          )}
          {previewState === 'ready' && (
            <button
              type="button"
              onClick={handlePublish}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="rocket_launch" size={14} />
              部署
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat panel (only in create/edit mode) */}
        {showChat && (
          <div className="w-[380px] shrink-0 border-r border-border flex flex-col min-h-0 bg-bg-white-var">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 hmr-scrollbar">
              {messages.length === 0 && (
                <EmptyChat onSelect={(text) => handleSend(text)} onHover={setActiveTemplate} />
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === 'edit'
                      ? '输入修改需求…'
                      : messages.length === 0
                        ? '描述你想创建的应用…'
                        : '输入修改需求…'
                  }
                  rows={1}
                  className="flex-1 px-3 py-2.5 text-sm border border-border rounded-xl bg-fill-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-text-muted/60 leading-relaxed overflow-hidden text-text-primary"
                  style={{ minHeight: '2.5rem', maxHeight: '8rem' }}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name={isProcessing ? 'hourglass_top' : 'arrow_upward'} size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right: Preview (full width in view mode) */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-bg-light">
          {/* Preview content */}
          <div className="flex-1 overflow-auto hmr-scrollbar p-6 flex justify-center">
            {previewState === 'idle' && (
              <PreviewIdle
                hoveredTemplate={activeTemplate}
                onSelect={(tpl) => {
                  setActiveTemplate(tpl);
                  handleSend(tpl.prompt);
                }}
              />
            )}
            {previewState === 'loading' && <PreviewLoading />}
            {previewState === 'ready' &&
              activeTemplate &&
              (viewportMode === 'mobile' ? (
                <MobileFrame>
                  <TemplatePreview template={activeTemplate} isMobile />
                </MobileFrame>
              ) : (
                <div className="w-full max-w-4xl">
                  <TemplatePreview template={activeTemplate} isMobile={false} />
                </div>
              ))}
          </div>

          {/* Bottom bar */}
          {previewState === 'ready' && (
            <div className="shrink-0 border-t border-border bg-bg-white-var px-4 py-2 flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <Icon name="link" size={12} className="text-primary" />
                {mode === 'view' ? '点击编辑按钮可修改应用' : '点击部署按钮，可发布为独立应用地址'}
              </span>
              <span>{viewportMode === 'desktop' ? '1440 × 900' : '375 × 812'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Deploy dialog — two-step: mode selection → confirm */}
      {showDeployConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowDeployConfirm(false)}
        >
          <div
            className="bg-bg-white-var rounded-2xl shadow-xl border border-border p-6 w-[340px] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {deployStep === 'mode' ? (
              <>
                <p className="text-sm font-semibold text-text-primary">选择展示方式</p>
                <div className="space-y-2">
                  {[
                    {
                      mode: 'live' as DisplayMode,
                      icon: 'cell_tower',
                      label: '实时内容',
                      desc: '常驻主面板，展示最新内容',
                    },
                    {
                      mode: 'report' as DisplayMode,
                      icon: 'bar_chart',
                      label: '周期报告',
                      desc: '有新数据时突出提醒',
                    },
                    {
                      mode: 'tool' as DisplayMode,
                      icon: 'build',
                      label: '快捷工具',
                      desc: '工具栏快捷入口，需要时打开',
                    },
                  ].map((opt) => {
                    const recommended =
                      opt.mode ===
                      inferDisplayMode(messages.find((m) => m.type === 'user')?.content ?? '');
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => setSelectedMode(opt.mode)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                          selectedMode === opt.mode
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-bg-hover'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                            selectedMode === opt.mode ? 'border-primary' : 'border-text-muted/30'
                          }`}
                        >
                          {selectedMode === opt.mode && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Icon name={opt.icon} size={16} className="text-text-secondary" />
                            <span className="text-sm font-semibold text-text-primary">
                              {opt.label}
                            </span>
                            {recommended && (
                              <span className="text-[10px] text-primary font-medium">(推荐)</span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeployStep('confirm')}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    下一步
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeployConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon name="rocket_launch" size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">确认发布应用？</p>
                    <p className="text-xs text-text-muted mt-0.5">发布后其他成员可在应用中心使用</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fill-tertiary border border-border text-xs text-text-secondary">
                  <Icon
                    name={
                      selectedMode === 'live'
                        ? 'cell_tower'
                        : selectedMode === 'report'
                          ? 'bar_chart'
                          : 'build'
                    }
                    size={14}
                    className="text-primary"
                  />
                  展示方式：
                  {selectedMode === 'live'
                    ? '实时内容'
                    : selectedMode === 'report'
                      ? '周期报告'
                      : '快捷工具'}
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={confirmPublish}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    确认发布
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeployStep('mode')}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    上一步
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
