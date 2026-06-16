/**
 * AgentOrchestrationPage — Agent 编排配置三栏布局（暗色主题）
 *
 * 左栏: System Prompt 编辑器
 * 中栏: 配置面板（对话体验/能力/工具/技能/知识库）
 * 右栏: 预览对话 + 调试
 */
import { useState, useEffect, useCallback } from 'react';
import { useOrchestrationStore } from '../../../../application/stores/orchestrationStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { PromptEditor } from './PromptEditor';
import { ConfigPanel } from './ConfigPanel';
import { PreviewChat } from './PreviewChat';

interface Props {
  agentId: string;
}

export function AgentOrchestrationPage({ agentId }: Props) {
  const loadConfig = useOrchestrationStore((s) => s.loadConfig);
  const loading = useOrchestrationStore((s) => s.loading);
  const dirty = useOrchestrationStore((s) => s.dirty);
  const publishedVersion = useOrchestrationStore((s) => s.publishedVersion);
  const saveDraft = useOrchestrationStore((s) => s.saveDraft);
  const toast = useToastStore((s) => s.addToast);

  // Resizable columns
  const [leftWidth, setLeftWidth] = useState(380);
  const [midWidth, setMidWidth] = useState(260);

  const makeResizeHandler = (
    setter: (fn: (w: number) => number) => void,
    min: number,
    max: number
  ) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = (e.target as HTMLElement).previousElementSibling?.clientWidth ?? 300;
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        setter(() => Math.max(min, Math.min(max, startW + delta)));
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
  });

  const leftHandle = makeResizeHandler(setLeftWidth, 260, 560);
  const midHandle = makeResizeHandler(setMidWidth, 200, 380);

  useEffect(() => {
    loadConfig(agentId);
  }, [agentId, loadConfig]);

  const handleSave = useCallback(async () => {
    await saveDraft();
    toast('草稿已保存', 'success');
  }, [saveDraft, toast]);

  const handlePublish = useCallback(async () => {
    const next = publishedVersion
      ? `v${parseInt(publishedVersion.replace(/^v/, '').split('.')[0]) + 1}.0.0`
      : 'v1.0.0';
    await useOrchestrationStore.getState().publish(next);
    toast(`已发布 ${next}`, 'success');
  }, [publishedVersion, toast]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
        加载配置中...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-[48px] flex items-center justify-between px-4 border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-[12px] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[14px] font-semibold text-slate-100">编排配置</h2>
          {dirty && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              未保存
            </span>
          )}
          {publishedVersion && (
            <span className="text-[10px] text-slate-500">线上: {publishedVersion}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="h-7 px-3 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
          >
            保存草稿
          </button>
          <button
            onClick={handlePublish}
            className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
          >
            发布
          </button>
        </div>
      </header>

      {/* Three columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Prompt Editor */}
        <div
          className="shrink-0 overflow-y-auto border-r border-white/[0.06]"
          style={{ width: leftWidth }}
        >
          <PromptEditor />
        </div>

        {/* Resize handle */}
        <div
          {...leftHandle}
          className="w-1 cursor-col-resize hover:bg-primary/30 transition-colors shrink-0"
        />

        {/* Middle: Config Panel */}
        <div
          className="shrink-0 overflow-y-auto border-r border-white/[0.06]"
          style={{ width: midWidth }}
        >
          <ConfigPanel />
        </div>

        {/* Resize handle */}
        <div
          {...midHandle}
          className="w-1 cursor-col-resize hover:bg-primary/30 transition-colors shrink-0"
        />

        {/* Right: Preview + Debug */}
        <div className="flex-1 min-w-[300px] overflow-hidden">
          <PreviewChat />
        </div>
      </div>
    </div>
  );
}
