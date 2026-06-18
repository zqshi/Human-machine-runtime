/**
 * FieldRenderer —— 按 JobFieldSpec.type 动态渲染表单字段
 *
 * 值类型约定（已转换，Editor 直接存入 payload）：
 * - text/textarea/select: string
 * - number: number
 * - json: object（内部维护原始字符串，解析失败时 onInvalid 通知）
 * - checkbox-group/tag-input: string[]
 */

import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { JobFieldSpec } from './jobSpecs';
import { useUIStore } from '../../../../application/stores/uiStore';
import {
  wrapSelection,
  prefixLines,
  toggleListPrefix,
  insertBlock,
  continueListOnEnter,
} from './mdActions';
import { Icon } from '../../../components/ui/Icon';

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#007AFF]';

export function FieldRenderer({
  field,
  value,
  onChange,
  onInvalid,
}: {
  field: JobFieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  onInvalid?: (invalid: boolean) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <input
          className={inputCls}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className={inputCls}
          value={value == null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'textarea':
      return (
        <textarea
          rows={3}
          className={inputCls}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'markdown':
      return <MarkdownField field={field} value={value} onChange={onChange} />;
    case 'json':
      return <JsonField field={field} value={value} onChange={onChange} onInvalid={onInvalid} />;
    case 'select':
      return (
        <select
          className={inputCls}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'checkbox-group':
      return (
        <CheckboxGroup
          field={field}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      );
    case 'tag-input':
      return (
        <TagInput
          placeholder={field.placeholder}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      );
    case 'boolean':
      return (
        <label className="inline-flex items-center gap-2 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4"
          />
        </label>
      );
    default:
      return null;
  }
}

function JsonField({
  field,
  value,
  onChange,
  onInvalid,
}: {
  field: JobFieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  onInvalid?: (invalid: boolean) => void;
}) {
  const [raw, setRaw] = useState(() => (value == null ? '' : JSON.stringify(value, null, 2)));
  const [error, setError] = useState('');

  // 外部 value 变化（如切换 spec）时同步
  useEffect(() => {
    setRaw(value == null ? '' : JSON.stringify(value, null, 2));
    setError('');
    onInvalid?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行一次（依赖稳定，有意省略）
  }, [field.key]);

  const handle = (text: string) => {
    setRaw(text);
    if (!text.trim()) {
      onChange({});
      setError('');
      onInvalid?.(false);
      return;
    }
    try {
      onChange(JSON.parse(text));
      setError('');
      onInvalid?.(false);
    } catch {
      setError('JSON 格式错误');
      onInvalid?.(true);
    }
  };

  return (
    <div>
      <textarea
        rows={4}
        className={`${inputCls} font-mono text-xs ${error ? 'border-red-400' : ''}`}
        placeholder={field.placeholder ?? '{}'}
        value={raw}
        onChange={(e) => handle(e.target.value)}
      />
      {error && <div className="text-[11px] text-red-500 mt-1">{error}</div>}
    </div>
  );
}

function MarkdownField({
  field,
  value,
  onChange,
}: {
  field: JobFieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const appMode = useUIStore((s) => s.appMode);
  const md = String(value ?? '');
  const viewRef = useRef<EditorView | null>(null);

  // 编辑器扩展：列表回车续行 + 粗体/斜体快捷键（Cmd/Ctrl）
  const extensions = [
    markdown(),
    keymap.of([
      {
        key: 'Enter',
        run: (view) => continueListOnEnter(view),
      },
      {
        key: 'Mod-b',
        run: (view) => {
          wrapSelection(view, '**');
          return true;
        },
      },
      {
        key: 'Mod-i',
        run: (view) => {
          wrapSelection(view, '*');
          return true;
        },
      },
    ]),
  ];

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* 工具栏 */}
      {mode === 'edit' && (
        <div className="flex items-center flex-wrap gap-0.5 px-1.5 py-1 border-b border-gray-100 bg-gray-50/60">
          <ToolBtn
            title="粗体 (Cmd+B)"
            onClick={() => viewRef.current && wrapSelection(viewRef.current, '**')}
          >
            <span className="font-bold">B</span>
          </ToolBtn>
          <ToolBtn
            title="斜体 (Cmd+I)"
            onClick={() => viewRef.current && wrapSelection(viewRef.current, '*')}
          >
            <span className="italic">I</span>
          </ToolBtn>
          <ToolBtn
            title="删除线"
            onClick={() => viewRef.current && wrapSelection(viewRef.current, '~~')}
          >
            <span className="line-through">S</span>
          </ToolBtn>
          <ToolBtn
            title="行内代码"
            onClick={() => viewRef.current && wrapSelection(viewRef.current, '`', '`', 'code')}
          >
            <Icon name="code" size={13} />
          </ToolBtn>
          <Sep />
          <ToolBtn
            title="一级标题"
            onClick={() => viewRef.current && prefixLines(viewRef.current, '# ')}
          >
            H1
          </ToolBtn>
          <ToolBtn
            title="二级标题"
            onClick={() => viewRef.current && prefixLines(viewRef.current, '## ')}
          >
            H2
          </ToolBtn>
          <ToolBtn
            title="三级标题"
            onClick={() => viewRef.current && prefixLines(viewRef.current, '### ')}
          >
            H3
          </ToolBtn>
          <Sep />
          <ToolBtn
            title="无序列表"
            onClick={() => viewRef.current && toggleListPrefix(viewRef.current, '- ')}
          >
            <Icon name="format_list_bulleted" size={14} />
          </ToolBtn>
          <ToolBtn
            title="有序列表"
            onClick={() => viewRef.current && toggleListPrefix(viewRef.current, '1. ')}
          >
            <Icon name="format_list_numbered" size={14} />
          </ToolBtn>
          <ToolBtn
            title="任务列表"
            onClick={() => viewRef.current && toggleListPrefix(viewRef.current, '- [ ] ')}
          >
            <Icon name="check_box_outline_blank" size={14} />
          </ToolBtn>
          <Sep />
          <ToolBtn
            title="链接"
            onClick={() =>
              viewRef.current && wrapSelection(viewRef.current, '[', '](url)', '链接文字')
            }
          >
            <Icon name="link" size={13} />
          </ToolBtn>
          <ToolBtn
            title="引用"
            onClick={() => viewRef.current && prefixLines(viewRef.current, '> ')}
          >
            <Icon name="format_quote" size={14} />
          </ToolBtn>
          <ToolBtn
            title="代码块"
            onClick={() => viewRef.current && insertBlock(viewRef.current, '```\n\n```')}
          >
            <Icon name="data_object" size={14} />
          </ToolBtn>
          <ToolBtn
            title="分隔线"
            onClick={() => viewRef.current && insertBlock(viewRef.current, '\n---')}
          >
            <Icon name="horizontal_rule" size={14} />
          </ToolBtn>
          <span className="ml-auto text-[10px] text-gray-400">Markdown · 支持 {`{{占位符}}`}</span>
        </div>
      )}
      {/* 编辑 / 预览 切换 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 bg-white">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            mode === 'edit'
              ? 'bg-[#007AFF]/10 text-[#007AFF] font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            mode === 'preview'
              ? 'bg-[#007AFF]/10 text-[#007AFF] font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          预览
        </button>
      </div>
      {mode === 'edit' ? (
        <CodeMirror
          value={md}
          extensions={extensions}
          theme={appMode === 'openclaw' ? 'dark' : 'light'}
          placeholder={field.placeholder}
          onChange={(val) => onChange(val)}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
          className="text-sm"
          height="240px"
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
      ) : (
        <div className="h-[240px] overflow-auto p-3 hmr-scrollbar prose prose-sm max-w-none">
          {md.trim() ? (
            <Markdown remarkPlugins={[remarkGfm]}>{md}</Markdown>
          ) : (
            <span className="text-gray-400 text-sm not-prose">暂无内容，切到「编辑」填写模板</span>
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({
  field,
  value,
  onChange,
}: {
  field: JobFieldSpec;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const options = field.options ?? [];

  // 按 group 分组（保序）；无 group 的选项归入平铺模式
  const hasGroup = options.some((o) => o.group);
  const renderBtn = (o: { value: string; label: string }) => {
    const checked = value.includes(o.value);
    return (
      <button
        key={o.value}
        type="button"
        onClick={() => toggle(o.value)}
        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
          checked
            ? 'border-[#007AFF] text-[#007AFF] bg-[#007AFF]/5'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        {o.label}
      </button>
    );
  };

  if (!hasGroup) {
    return <div className="flex flex-wrap gap-2">{options.map(renderBtn)}</div>;
  }
  // 分组：按首次出现顺序归集 group
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const o of options) {
    const g = o.group ?? '其他';
    const arr = groups.get(g) ?? [];
    arr.push(o);
    groups.set(g, arr);
  }
  return (
    <div className="space-y-2">
      {Array.from(groups.entries()).map(([g, opts]) => (
        <div key={g}>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            {g}
          </div>
          <div className="flex flex-wrap gap-2">{opts.map(renderBtn)}</div>
        </div>
      ))}
    </div>
  );
}

function TagInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  return (
    <div className="flex flex-wrap gap-1.5 px-2 py-1.5 border border-gray-200 rounded-lg focus-within:border-[#007AFF]">
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#007AFF]/10 text-[#007AFF] text-xs"
        >
          {v}
          <button type="button" onClick={() => remove(v)} className="hover:text-red-500">
            ×
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        placeholder={placeholder ?? (value.length === 0 ? '输入后回车' : '')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

/** MarkdownField 工具栏按钮：onMouseDown preventDefault 保持编辑器选区不丢失 */
function ToolBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="px-1.5 py-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors text-xs leading-none"
    >
      {children}
    </button>
  );
}

/** 工具栏分组分隔符 */
function Sep() {
  return <span className="w-px h-4 bg-gray-200 mx-0.5" />;
}
