/**
 * OpenClawComposer — 多模态输入组件 (OpenClaw 暗色主题)
 *
 * 支持：文本输入 + 文件附件 + 图片上传 + 语音转文字
 */
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Icon } from '../../components/ui/Icon';
import { InstanceConversationSelector } from './InstanceConversationSelector';
import type { Attachment } from '../../../domain/agent/CoTMessage';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import type { OpenClawDrawerContent } from '../../../domain/agent/DrawerContent';

interface OpenClawComposerProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onOpenDrawer?: (content: OpenClawDrawerContent) => void;
}

/** Format bytes to human-readable string */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Get icon name for file type */
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio_file';
  if (mimeType.startsWith('video/')) return 'video_file';
  if (mimeType.includes('pdf')) return 'picture_as_pdf';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return 'table_chart';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'description';
  return 'attach_file';
}

export function OpenClawComposer({
  onSend,
  disabled = false,
  autoFocus = false,
  placeholder = '输入指令或提问...',
  onOpenDrawer,
}: OpenClawComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API has no stable TS typings
  const recognitionRef = useRef<any>(null);
  const composerPrefill = useOpenClawStore((s) => s.composerPrefill);
  const activeGoalId = useOpenClawStore((s) => s.activeGoalId);
  const goals = useOpenClawStore((s) => s.goals);
  const isDiscussing = useOpenClawStore(
    (s) =>
      !!(
        s.discussingNotificationId ||
        s.discussingDecisionId ||
        s.discussingTaskId ||
        s.discussingGoalId
      )
  );
  const [goalBarCollapsed, setGoalBarCollapsed] = useState(false);

  const activeGoal = activeGoalId ? goals.find((g) => g.id === activeGoalId) : null;
  // 讨论模式下隐藏目标条——用户焦点在具体事件，目标条无关且占空间
  const showGoalBar = activeGoal && !isDiscussing;

  // Sync prefill from store (e.g. notification delegate-to-agent) — render-phase
  const [prevPrefill, setPrevPrefill] = useState<string | null>(null);
  if (composerPrefill && composerPrefill !== prevPrefill) {
    setPrevPrefill(composerPrefill);
    setText(composerPrefill);
    useOpenClawStore.getState().setComposerPrefill(null);
  } else if (!composerPrefill && prevPrefill) {
    setPrevPrefill(null);
  }

  useEffect(() => {
    if (composerPrefill) {
      textareaRef.current?.focus();
      // Trigger auto-resize after state update
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
        }
      });
    }
  }, [composerPrefill]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; // max ~5 lines
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, attachments, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    resizeTextarea();
  };

  // File selection handler
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const att: Attachment = {
        id: `att-${Date.now()}-${i}`,
        type: file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'file',
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        url: URL.createObjectURL(file),
      };
      newAttachments.push(att);
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att) URL.revokeObjectURL(att.url);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行一次（依赖稳定，有意省略）
  }, []);

  // Voice recognition
  const toggleVoice = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Web Speech API — vendor-prefixed in some browsers, no stable TS typings
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (win.webkitSpeechRecognition ?? win.SpeechRecognition) as  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API
      | (new () => any)
      | undefined;
    if (!SpeechRecognitionCtor) {
      setText((prev) => prev + '[语音输入需要 Chrome 浏览器支持]');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = '';

    recognition.onresult = (event: {
      resultIndex: number;
      results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
    }) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      setText((prev) => {
        // Replace any interim text with final + new interim
        const base = prev.replace(/\[识别中...\].*$/, '');
        return base + finalTranscript + (interim ? `[识别中...]${interim}` : '');
      });
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Clean up interim markers
      setText((prev) => prev.replace(/\[识别中\.\.\.\]/g, ''));
      resizeTextarea();
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  }, [isRecording, resizeTextarea]);

  const hasContent = text.trim().length > 0 || attachments.length > 0;

  return (
    <div>
      {/* Active Goal status bar — hidden during discussion mode */}
      {showGoalBar && !goalBarCollapsed && (
        <div className="px-6 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/5">
            <span className="material-symbols-outlined text-green-400" style={{ fontSize: 14 }}>
              flag
            </span>
            <span className="text-xs font-medium text-slate-200 truncate flex-1">
              {activeGoal.title}
            </span>
            <span className="text-[10px] text-slate-500">{activeGoal.overallProgress}%</span>
            {activeGoal.activeMilestone && (
              <span className="text-[10px] text-primary hidden sm:inline">
                {activeGoal.activeMilestone.name}
              </span>
            )}
            <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-400"
                style={{ width: `${activeGoal.overallProgress}%` }}
              />
            </div>
            {onOpenDrawer && (
              <button
                type="button"
                onClick={() => onOpenDrawer({ type: 'goal-tracker', title: '目标追踪', data: {} })}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Icon name="open_in_new" size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setGoalBarCollapsed(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Collapsed goal indicator */}
      {showGoalBar && goalBarCollapsed && (
        <div className="px-6 pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setGoalBarCollapsed(false)}
            className="flex items-center gap-1 text-[10px] text-green-400/60 hover:text-green-400 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              flag
            </span>
            {activeGoal.title} {activeGoal.overallProgress}%
          </button>
        </div>
      )}

      <div className="border-t border-white/10 px-6 py-3">
        <div className="flex items-center gap-2 mb-2">
          <InstanceConversationSelector />
          <span className="text-[10px] text-slate-500">
            选择数字员工 · 决定其可调用的模型范围（受模型授权白名单约束）
          </span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {attachments.map((att) => (
                <div key={att.id} className="relative group">
                  {att.type === 'image' ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04]">
                      <Icon name={getFileIcon(att.mimeType)} size={16} className="text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-200 truncate max-w-[120px]">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-slate-500">{formatSize(att.size)}</p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            rows={1}
            className="w-full min-h-[42px] px-3 py-2.5 text-sm bg-transparent resize-none outline-none text-slate-200 placeholder:text-slate-500"
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex gap-0.5">
              {/* File attachment */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                title="上传附件"
              >
                <Icon name="attach_file" size={18} />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Image */}
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                title="上传图片"
              >
                <Icon name="image" size={18} />
              </button>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Voice */}
              <button
                type="button"
                onClick={toggleVoice}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isRecording
                    ? 'text-red-400 bg-red-400/10 animate-pulse'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                }`}
                title={isRecording ? '停止录音' : '语音输入'}
              >
                <Icon name="mic" size={18} />
              </button>
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!hasContent || disabled}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
