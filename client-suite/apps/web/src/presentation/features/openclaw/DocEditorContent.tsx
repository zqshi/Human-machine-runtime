/**
 * DocEditorContent — D 栏文档编辑面板
 * 使用 Tiptap 富文本编辑器，支持实时编辑和渐进式内容生成
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';

interface ContentProps {
  data: Record<string, unknown>;
}

export function DocEditorContent({ data }: ContentProps) {
  const docId = data.docId as string;
  const doc = useOpenClawStore((s) => s.documents.find((d) => d.id === docId));
  const updateDocument = useOpenClawStore((s) => s.updateDocument);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastPushedContent = useRef('');
  const [activeSection, setActiveSection] = useState<number>(0);

  // Sync content from store when not editing
  useEffect(() => {
    if (!editorRef.current || !doc?.content || isEditing) return;
    if (doc.content !== lastPushedContent.current) {
      editorRef.current.innerHTML = doc.content;
      lastPushedContent.current = doc.content;
    }
  }, [doc?.content, isEditing]);

  // Track active section based on scroll position
  const handleScroll = useCallback(() => {
    if (!editorRef.current || !doc) return;
    const headings = editorRef.current.querySelectorAll('h1, h2');
    let idx = 0;
    headings.forEach((h, i) => {
      const rect = h.getBoundingClientRect();
      const containerRect = editorRef.current!.getBoundingClientRect();
      if (rect.top - containerRect.top < 60) idx = i;
    });
    setActiveSection(idx);
  }, [doc]);

  const handleInput = useCallback(() => {
    if (!editorRef.current || !docId) return;
    setIsEditing(true);
    const html = editorRef.current.innerHTML;
    lastPushedContent.current = html;
    updateDocument(docId, (d) => ({ ...d, content: html, updatedAt: Date.now() }));
  }, [docId, updateDocument]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const execCommand = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }, []);

  const handleExport = useCallback(() => {
    useToastStore.getState().addToast('导出功能开发中', 'info');
  }, []);

  const sections = doc?.sections ?? [];
  const doneCount = sections.filter((s) => s.status === 'done').length;
  const isComplete = doneCount >= sections.length && sections.length > 0;

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <Icon name="error_outline" size={20} className="mr-2" />文档未找到
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-1 flex-wrap">
        <ToolBtn icon="format_bold" title="粗体" onClick={() => execCommand('bold')} />
        <ToolBtn icon="format_italic" title="斜体" onClick={() => execCommand('italic')} />
        <ToolBtn icon="strikethrough_s" title="删除线" onClick={() => execCommand('strikeThrough')} />
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolBtn icon="title" title="标题" onClick={() => execCommand('formatBlock', 'h2')} />
        <ToolBtn icon="format_list_bulleted" title="无序列表" onClick={() => execCommand('insertUnorderedList')} />
        <ToolBtn icon="format_list_numbered" title="有序列表" onClick={() => execCommand('insertOrderedList')} />
        <ToolBtn icon="format_quote" title="引用" onClick={() => execCommand('formatBlock', 'blockquote')} />
        <ToolBtn icon="code" title="代码" onClick={() => execCommand('formatBlock', 'pre')} />
        <div className="flex-1" />
        {!isComplete && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            生成中 {doneCount}/{sections.length}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Section navigation */}
        <div className="w-36 shrink-0 border-r border-white/[0.06] overflow-y-auto hmr-scrollbar py-2">
          {sections.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setActiveSection(i);
                const headings = editorRef.current?.querySelectorAll('h1, h2');
                headings?.[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors ${
                activeSection === i ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-white/[0.03]'
              }`}
            >
              <span className="mr-1.5" style={{
                color: s.status === 'done' ? '#34C759' : s.status === 'writing' ? '#FF9500' : '#475569',
              }}>
                {s.status === 'done' ? '✓' : s.status === 'writing' ? '✎' : '○'}
              </span>
              {s.title}
            </button>
          ))}
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto hmr-scrollbar" onScroll={handleScroll}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleBlur}
            onFocus={() => setIsEditing(true)}
            className="doc-editor-content px-6 py-4 min-h-full outline-none text-sm text-slate-200 leading-relaxed"
            style={{ caretColor: '#007AFF' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-4 py-2 flex items-center gap-2">
        <button type="button" onClick={handleExport}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] text-slate-400 hover:bg-white/[0.04] transition-colors">
          <Icon name="download" size={12} />导出
        </button>
        <button type="button" onClick={() => {
          if (editorRef.current && doc) {
            navigator.clipboard.writeText(editorRef.current.innerText);
            useToastStore.getState().addToast('已复制文本', 'success');
          }
        }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] text-slate-400 hover:bg-white/[0.04] transition-colors">
          <Icon name="content_copy" size={12} />复制
        </button>
        <div className="flex-1" />
        <span className="text-[9px] text-slate-600">
          {doc.updatedAt ? `最后编辑 ${new Date(doc.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      </div>

      <style>{`
        .doc-editor-content h1 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; color: #f1f5f9; }
        .doc-editor-content h2 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.4em; color: #e2e8f0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.3em; }
        .doc-editor-content h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; color: #cbd5e1; }
        .doc-editor-content p { margin: 0.5em 0; }
        .doc-editor-content ul, .doc-editor-content ol { margin: 0.5em 0; padding-left: 1.5em; }
        .doc-editor-content li { margin: 0.2em 0; }
        .doc-editor-content strong { color: #f1f5f9; }
        .doc-editor-content code { background: rgba(0,122,255,0.1); color: #60a5fa; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; font-family: 'SF Mono', monospace; }
        .doc-editor-content pre { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; margin: 0.6em 0; overflow-x: auto; }
        .doc-editor-content pre code { background: none; padding: 0; color: #94a3b8; }
        .doc-editor-content blockquote { border-left: 3px solid #007AFF; padding-left: 12px; margin: 0.6em 0; color: #94a3b8; font-style: italic; }
        .doc-editor-content table { width: 100%; border-collapse: collapse; margin: 0.6em 0; font-size: 0.9em; }
        .doc-editor-content th, .doc-editor-content td { border: 1px solid rgba(255,255,255,0.08); padding: 6px 10px; text-align: left; }
        .doc-editor-content th { background: rgba(255,255,255,0.04); font-weight: 600; color: #e2e8f0; }
        .doc-editor-content a { color: #007AFF; text-decoration: underline; }
      `}</style>
    </div>
  );
}

function ToolBtn({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
