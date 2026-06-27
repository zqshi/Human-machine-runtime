import { useState, type KeyboardEvent } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { Icon } from '../../../components/ui/Icon';
import { useToastStore } from '../../../../application/stores/toastStore';
import { useUIStore } from '../../../../application/stores/uiStore';
import type { PanelProps } from '../panelRegistry';
import type { Extension } from '@codemirror/state';

const LANG_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript React',
  js: 'JavaScript',
  jsx: 'JavaScript React',
  css: 'CSS',
  html: 'HTML',
  json: 'JSON',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  sql: 'SQL',
  sh: 'Shell',
  md: 'Markdown',
};

function detectLangExtension(fileName?: string): Extension[] {
  if (!fileName) return [javascript()];
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return [javascript({ typescript: true, jsx: ext.includes('x') })];
    case 'js':
    case 'jsx':
      return [javascript({ jsx: ext.includes('x') })];
    case 'py':
      return [python()];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'json':
      return [json()];
    case 'md':
      return [markdown()];
    default:
      return [javascript()];
  }
}

function detectLanguageLabel(fileName?: string): string {
  if (!fileName) return '';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return LANG_LABELS[ext] ?? ext.toUpperCase();
}

function CodeAIAssistant() {
  const [query, setQuery] = useState('');

  const handleQuickAction = (action: string) => {
    useToastStore.getState().addToast(`AI: ${action} — 功能开发中`, 'info');
  };

  const handleSend = () => {
    if (!query.trim()) return;
    useToastStore.getState().addToast(`AI 问答: "${query.trim()}" — 功能开发中`, 'info');
    setQuery('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border p-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
          <Icon name="smart_toy" size={12} className="text-success" />
        </div>
        <span className="text-xs text-text-secondary font-medium">AI 助手</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => handleQuickAction('解释这段代码')}
          className="px-3 py-1.5 text-[11px] text-text-secondary bg-bg-light rounded-lg hover:bg-bg-hover border border-border transition-colors"
        >
          解释这段代码
        </button>
        <button
          type="button"
          onClick={() => handleQuickAction('优化建议')}
          className="px-3 py-1.5 text-[11px] text-text-secondary bg-bg-light rounded-lg hover:bg-bg-hover border border-border transition-colors"
        >
          优化建议
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="向 AI 提问关于代码的问题..."
          className="flex-1 px-3 py-2 text-xs bg-bg-light border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={handleSend}
          className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary/80 transition-colors shrink-0"
        >
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  );
}

export default function CodePanel({ data, onChange }: PanelProps) {
  const appMode = useUIStore((s) => s.appMode);
  const fileName = data.fileName as string | undefined;
  const code = (data.code as string) ?? '';
  const langLabel = (data.language as string) || detectLanguageLabel(fileName);
  const langExts = detectLangExtension(fileName);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      useToastStore.getState().addToast('代码已复制到剪贴板', 'success');
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* File header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-light border-b border-border text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="code" size={14} className="text-primary shrink-0" />
          {fileName ? (
            <span className="font-mono text-text-secondary truncate">{fileName}</span>
          ) : (
            <span className="text-text-muted">代码编辑器</span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {langLabel && (
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium text-[10px]">
              {langLabel}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-bg-hover text-text-muted"
            title="复制代码"
          >
            <Icon name="content_copy" size={14} />
          </button>
        </div>
      </div>

      {/* Code editor */}
      <div className="flex-1 overflow-auto hmr-scrollbar min-h-0">
        <CodeMirror
          value={code}
          extensions={langExts}
          theme={appMode === 'cockpit' ? 'dark' : 'light'}
          onChange={(val) => onChange?.({ ...data, code: val })}
          className="h-full text-sm"
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        />
      </div>

      {/* AI Assistant */}
      <CodeAIAssistant />
    </div>
  );
}
