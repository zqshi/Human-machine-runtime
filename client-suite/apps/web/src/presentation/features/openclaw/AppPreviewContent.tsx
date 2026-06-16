/**
 * AppPreviewContent — D 栏应用实时预览面板
 * iframe sandbox 展示构建中/完成的应用
 */
import { useMemo, useState, useRef } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { Icon } from '../../components/ui/Icon';

interface ContentProps {
  data: Record<string, unknown>;
}

const STAGES = ['designing', 'building', 'preview', 'done'] as const;
const STAGE_LABELS: Record<string, string> = {
  designing: '设计中', building: '构建中', preview: '预览', done: '完成',
};

export function AppPreviewContent({ data }: ContentProps) {
  const appId = data.appId as string;
  const app = useOpenClawStore((s) => s.apps.find((a) => a.id === appId));
  const [showCode, setShowCode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const latestSnapshot = useMemo(() => {
    if (!app?.codeSnapshots.length) return null;
    return app.codeSnapshots[app.codeSnapshots.length - 1];
  }, [app?.codeSnapshots]);

  const [refreshBump, setRefreshBump] = useState(0);
  const iframeKey = (app?.codeSnapshots.length ?? 0) + refreshBump;

  const srcDoc = useMemo(() => {
    if (!latestSnapshot) return '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${latestSnapshot.css}</style></head><body>${latestSnapshot.html}<script>${latestSnapshot.js}</script></body></html>`;
  }, [latestSnapshot]);

  if (!app) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <Icon name="error_outline" size={20} className="mr-2" />应用未找到
      </div>
    );
  }

  const stageIndex = STAGES.indexOf(app.stage as typeof STAGES[number]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stage progress bar */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-200">{app.name}</span>
          <span className="text-[10px] text-slate-500">{app.description}</span>
        </div>
        <div className="flex items-center gap-1">
          {STAGES.map((s, i) => {
            const reached = stageIndex >= i;
            const isCurrent = stageIndex === i;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5 flex-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${isCurrent ? 'ring-2 ring-primary/30' : ''}`}
                    style={{
                      backgroundColor: reached ? '#007AFF' : 'rgba(255,255,255,0.06)',
                      color: reached ? '#fff' : '#64748b',
                    }}
                  >
                    {reached && i < stageIndex ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] ${reached ? 'text-slate-300' : 'text-slate-600'}`}>
                    {STAGE_LABELS[s]}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="w-full h-px mx-1" style={{ backgroundColor: stageIndex > i ? '#007AFF' : 'rgba(255,255,255,0.06)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {showCode ? (
          <div className="h-full overflow-auto dcf-scrollbar p-4">
            <div className="space-y-3">
              {latestSnapshot?.html && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1">HTML</div>
                  <pre className="text-[11px] text-slate-300 bg-white/[0.03] rounded-lg p-3 overflow-x-auto border border-white/[0.06]">
                    <code>{latestSnapshot.html}</code>
                  </pre>
                </div>
              )}
              {latestSnapshot?.css && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1">CSS</div>
                  <pre className="text-[11px] text-slate-300 bg-white/[0.03] rounded-lg p-3 overflow-x-auto border border-white/[0.06]">
                    <code>{latestSnapshot.css}</code>
                  </pre>
                </div>
              )}
              {latestSnapshot?.js && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1">JavaScript</div>
                  <pre className="text-[11px] text-slate-300 bg-white/[0.03] rounded-lg p-3 overflow-x-auto border border-white/[0.06]">
                    <code>{latestSnapshot.js}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="w-full h-full border-none bg-[#0a0a0f]"
            title={`${app.name} 预览`}
          />
        )}

        {/* Building overlay */}
        {(app.stage === 'designing' || app.stage === 'building') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/60 border border-white/10">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-300">
                {app.stage === 'designing' ? '分析需求并设计界面...' : '生成代码并构建组件...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer toolbar */}
      <div className="border-t border-white/[0.06] px-4 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRefreshBump((k) => k + 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] text-slate-400 hover:bg-white/[0.04] transition-colors"
        >
          <Icon name="refresh" size={12} />刷新
        </button>
        <button
          type="button"
          onClick={() => setShowCode(!showCode)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${
            showCode ? 'border-primary/30 text-primary bg-primary/5' : 'border-white/10 text-slate-400 hover:bg-white/[0.04]'
          }`}
        >
          <Icon name="code" size={12} />{showCode ? '预览' : '源码'}
        </button>
        <div className="flex-1" />
        <span className="text-[9px] text-slate-600">
          {latestSnapshot ? `最后更新 ${new Date(latestSnapshot.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </span>
      </div>
    </div>
  );
}
