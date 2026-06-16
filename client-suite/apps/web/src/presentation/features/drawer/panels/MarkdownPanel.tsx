import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../../../components/ui/Icon';
import { useUIStore } from '../../../../application/stores/uiStore';
import type { PanelProps } from '../panelRegistry';

type ViewMode = 'edit' | 'preview' | 'split';

const VIEW_OPTIONS: { mode: ViewMode; icon: string; title: string }[] = [
  { mode: 'edit', icon: 'edit', title: '编辑' },
  { mode: 'split', icon: 'vertical_split', title: '分屏' },
  { mode: 'preview', icon: 'visibility', title: '预览' },
];

export default function MarkdownPanel({ data, onChange }: PanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const appMode = useUIStore((s) => s.appMode);
  const md = (data.markdown as string) ?? '';

  const editorPart = (
    <CodeMirror
      value={md}
      extensions={[markdown()]}
      theme={appMode === 'openclaw' ? 'dark' : 'light'}
      onChange={(val) => onChange?.({ ...data, markdown: val })}
      className="h-full text-sm"
      basicSetup={{ lineNumbers: true, foldGutter: false }}
    />
  );

  const previewPart = (
    <div className="h-full overflow-auto p-4 dcf-scrollbar prose prose-sm max-w-none text-text-primary">
      <Markdown remarkPlugins={[remarkGfm]}>{md}</Markdown>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Mode switcher */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setViewMode(opt.mode)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
              viewMode === opt.mode ? 'text-primary bg-primary/10 font-medium' : 'text-text-secondary hover:bg-bg-hover'
            }`}
            title={opt.title}
          >
            <Icon name={opt.icon} size={14} />
            {opt.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {viewMode === 'edit' && <div className="flex-1 overflow-auto">{editorPart}</div>}
        {viewMode === 'preview' && <div className="flex-1">{previewPart}</div>}
        {viewMode === 'split' && (
          <>
            <div className="flex-1 overflow-auto border-r border-border">{editorPart}</div>
            <div className="flex-1">{previewPart}</div>
          </>
        )}
      </div>
    </div>
  );
}
