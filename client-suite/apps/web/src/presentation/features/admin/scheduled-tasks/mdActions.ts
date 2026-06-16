/**
 * MarkdownField 的编辑操作工具栏实现。
 *
 * 基于 CodeMirror EditorView 的选区变换，封装两类常用操作：
 * - 包裹型（inline）：用前缀/后缀包裹选区，如 **粗体**、`代码`
 * - 行首型（block）：在所选行行首插入前缀，如 # 标题、- 列表、> 引用
 *
 * 光标无选区时，插入占位符并选中占位符，方便直接键入内容。
 * 列表续行：Enter 时若当前行是列表项，新行自动续前缀（- / * / 1. / - [ ]）。
 */

import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

type View = EditorView;

/** 用前后缀包裹当前选区；无选区时插入占位并选中 */
export function wrapSelection(view: View, prefix: string, suffix: string = prefix, placeholder = '内容'): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selected = state.doc.sliceString(range.from, range.to);
    if (selected) {
      return {
        changes: [
          { from: range.from, insert: prefix },
          { from: range.to, insert: suffix },
        ],
        range: range,
      };
    }
    // 无选区：插入 prefix+placeholder+suffix，选中 placeholder
    const insertText = `${prefix}${placeholder}${suffix}`;
    return {
      changes: [{ from: range.from, insert: insertText }],
      range: EditorSelection.range(range.from + prefix.length, range.from + prefix.length + placeholder.length),
    };
  });
  view.dispatch(changes);
  view.focus();
}

/** 在所选每一行的行首插入前缀（block 型：标题/列表/引用） */
export function prefixLines(view: View, prefix: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const lineFrom = state.doc.lineAt(range.from);
    const lineTo = state.doc.lineAt(range.to);
    const newChanges: { from: number; insert: string }[] = [];
    for (let num = lineFrom.number; num <= lineTo.number; num++) {
      const line = state.doc.line(num);
      newChanges.push({ from: line.from, insert: prefix });
    }
    return { changes: newChanges, range };
  });
  view.dispatch(changes);
  view.focus();
}

/** 切换列表项标记：已是列表项则取消，否则加上 */
export function toggleListPrefix(view: View, marker: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const text = line.text;
    const existing = text.match(/^(\s*)([-*+]\s+\[(?: |x)\]\s+|[-*+]\s+|\d+\.\s+)/);
    const newPrefix = existing ? text.slice(existing[0].length) : `${marker}${text}`;
    const insert = existing ? newPrefix : `${marker}${text}`;
    return {
      changes: [{ from: line.from, to: line.to, insert }],
      range,
    };
  });
  view.dispatch(changes);
  view.focus();
}

/** 插入分块（代码块/分隔线）到当前行下方 */
export function insertBlock(view: View, block: string): void {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.from);
  const atLineEnd = line.to;
  const insert = `\n${block}`;
  view.dispatch({
    changes: { from: atLineEnd, insert },
    selection: { anchor: atLineEnd + insert.length },
  });
  view.focus();
}

/** 列表续行：Enter 时若当前行是列表项，新行自动续前缀；空列表项则清空（退出列表） */
export function continueListOnEnter(view: View): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (range.from !== range.to) return false;
  const line = state.doc.lineAt(range.from);
  const text = line.text;
  const mTask = text.match(/^(\s*)([-*+]\s+\[(?: |x)\]\s+)/);
  const mBullet = text.match(/^(\s*)([-*+]\s+)/);
  const mOrdered = text.match(/^(\s*)(\d+)\.\s+/);

  const indent = (mTask ?? mBullet ?? mOrdered)?.[1] ?? '';
  // 当前为空列表项 → 清空标记，退出列表
  const onlyMarker =
    (mTask && text.slice(mTask[0].length).trim() === '') ||
    (mBullet && text.slice(mBullet[0].length).trim() === '') ||
    (mOrdered && text.slice(mOrdered[0].length).trim() === '');
  if (onlyMarker) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    });
    return true;
  }
  let nextPrefix: string | null = null;
  if (mTask) nextPrefix = `${indent}- [ ] `;
  else if (mBullet) nextPrefix = `${indent}${mBullet[2]}`;
  else if (mOrdered) nextPrefix = `${indent}${Number(mOrdered[2]) + 1}. `;
  if (!nextPrefix) return false;

  const insert = `\n${nextPrefix}`;
  view.dispatch({
    changes: { from: range.from, insert },
    selection: { anchor: range.from + insert.length },
  });
  return true;
}
