/**
 * 共享 Trace 组件 — SpanWaterfall 瀑布图与 SpanDetailPanel
 *
 * 从 AIGatewayTracesTab.tsx 抽取，供调用追踪和评测用例详情复用。
 */

import { useState } from 'react';
import { fmtDuration, fmtTime, stageColor } from './format';

/* ──── 类型 ──── */

export interface SpanItem {
  spanId: string;
  parentId: string | null;
  operationName: string;
  startTime: string | null;
  durationMs: number;
  status: string;
  depth: number;
  tags: Record<string, unknown> | null;
  nodeId?: string;
  kind?: string;
  model?: string | null;
  summary?: string | null;
  inputPayload?: unknown;
  outputPayload?: unknown;
}

/* ──── 常量 ──── */

const SPAN_BAR_COLORS: Record<string, string> = {
  success: 'bg-emerald-400 hover:bg-emerald-500',
  completed: 'bg-emerald-400 hover:bg-emerald-500',
  failed: 'bg-red-400 hover:bg-red-500',
  error: 'bg-red-400 hover:bg-red-500',
  blocked: 'bg-amber-400 hover:bg-amber-500',
  skipped: 'bg-gray-300 hover:bg-gray-400',
  unknown: 'bg-gray-400 hover:bg-gray-500',
};

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-green-50 text-green-700 border-green-100',
  completed: 'bg-green-50 text-green-700 border-green-100',
  blocked: 'bg-red-50 text-red-600 border-red-100',
  failed: 'bg-orange-50 text-orange-600 border-orange-100',
  error: 'bg-red-50 text-red-600 border-red-100',
};

/* ──── 辅助函数 ──── */

function spanBarColor(status: string): string {
  return SPAN_BAR_COLORS[status] || SPAN_BAR_COLORS.unknown;
}

function statusBadge(status: unknown): string {
  return STATUS_BADGE[String(status)] || 'bg-gray-100 text-gray-500 border-gray-200';
}

function timeAxisTicks(totalMs: number): number[] {
  const step = niceStep(totalMs);
  const ticks: number[] = [];
  for (let t = 0; t <= totalMs; t += step) ticks.push(t);
  return ticks;
}

function niceStep(totalMs: number): number {
  const raw = totalMs / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const norm = raw / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

/* ──── 辅助组件 ──── */

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-gray-400">{label}</span>{' '}
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: unknown }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(status)}`}>{String(status || '—')}</span>;
}

/* ──── SpanWaterfall 瀑布图 ──── */

export function SpanWaterfall({
  spans,
  selectedSpanId,
  onSelectSpan,
  emptyHint,
}: {
  spans: SpanItem[];
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string) => void;
  /** 空数据时的提示文字，默认调用追踪专用提示 */
  emptyHint?: string;
}) {
  if (spans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        {emptyHint ?? '未读取到 Span 数据。需要上游写入 ai_flow_nodes（含 span_id、parent_span_id、start_time）后，才能展示瀑布图。'}
      </div>
    );
  }

  const traceStartMs = spans.reduce((min, s) => {
    if (!s.startTime) return min;
    const t = new Date(s.startTime).getTime();
    return t < min ? t : min;
  }, Infinity);
  const traceEndMs = spans.reduce((max, s) => {
    if (!s.startTime) return max;
    const t = new Date(s.startTime).getTime() + s.durationMs;
    return t > max ? t : max;
  }, 0);
  const totalMs = Math.max(traceEndMs - traceStartMs, 1);
  const ticks = timeAxisTicks(totalMs);

  const offsetMs = (span: SpanItem): number => {
    if (!span.startTime) return 0;
    return new Date(span.startTime).getTime() - traceStartMs;
  };

  return (
    <div className="space-y-0">
      {/* 时间轴标尺 */}
      <div className="flex items-center ml-[240px] h-6 border-b border-gray-100 text-[10px] text-gray-400 font-mono relative">
        {ticks.map((t) => {
          const pct = (t / totalMs) * 100;
          return (
            <span key={t} className="absolute" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
              {fmtDuration(t)}
            </span>
          );
        })}
      </div>

      {/* Span 行 */}
      <div className="space-y-px">
        {spans.map((span) => {
          const leftPct = (offsetMs(span) / totalMs) * 100;
          const widthPct = Math.max((span.durationMs / totalMs) * 100, 0.3);
          const isSelected = selectedSpanId === span.spanId;

          return (
            <div
              key={span.spanId}
              className={`flex items-center h-7 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              onClick={() => onSelectSpan(span.spanId)}
            >
              {/* 左侧：operationName（带 depth 缩进） */}
              <div className="w-[240px] shrink-0 flex items-center" style={{ paddingLeft: `${span.depth * 16 + 4}px` }}>
                {span.depth > 0 && (
                  <span className="text-gray-300 mr-1 text-[10px]">└</span>
                )}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageColor(span.status)}`} />
                <span className={`ml-1.5 text-xs truncate ${isSelected ? 'font-medium text-[#007AFF]' : 'text-gray-700'}`}>
                  {span.operationName}
                </span>
              </div>

              {/* 右侧：时间条 */}
              <div className="flex-1 relative h-5">
                <div
                  className={`absolute top-0.5 h-4 rounded-sm transition-all ${spanBarColor(span.status)} ${isSelected ? 'ring-1 ring-blue-400' : ''}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: widthPct < 1 ? '3px' : undefined }}
                  title={`${span.operationName}: ${fmtDuration(span.durationMs)} (${span.status})`}
                />
              </div>

              {/* 最右：durationMs */}
              <div className="w-[60px] shrink-0 text-right text-[11px] font-mono text-gray-500 pr-2">
                {fmtDuration(span.durationMs)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──── SpanDetailPanel ──── */

export function SpanDetailPanel({ span }: { span: SpanItem }) {
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const tags = span.tags ?? {};
  const tagEntries = Object.entries(tags);

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-gray-400">Span 详情</div>
        <StatusPill status={span.status} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
        <Info label="Span ID" value={span.spanId} mono />
        <Info label="Operation" value={span.operationName} />
        <Info label="Duration" value={fmtDuration(span.durationMs)} mono />
        <Info label="Start" value={span.startTime ? fmtTime(span.startTime) : '—'} />
      </div>

      {span.model && (
        <div className="text-xs text-gray-600">
          <span className="text-gray-400">模型: </span>
          <span className="font-medium">{span.model}</span>
        </div>
      )}

      {tagEntries.length > 0 && (
        <div className="bg-gray-50 rounded p-2 text-xs">
          <div className="text-[10px] text-gray-400 mb-1">Tags</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {tagEntries.map(([k, v]) => (
              <div key={k} className="flex gap-1 min-w-0">
                <span className="text-gray-400 shrink-0">{k}:</span>
                <span className="text-gray-700 truncate font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {span.inputPayload != null && (
        <div>
          <button onClick={() => setShowInput(!showInput)} className="text-xs text-[#007AFF] hover:underline">
            {showInput ? '▾ 收起 Input' : '▸ 展开 Input'}
          </button>
          {showInput && (
            <pre className="mt-1 max-h-40 overflow-auto text-xs text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">
              {typeof span.inputPayload === 'string' ? span.inputPayload : JSON.stringify(span.inputPayload, null, 2)}
            </pre>
          )}
        </div>
      )}

      {span.outputPayload != null && (
        <div>
          <button onClick={() => setShowOutput(!showOutput)} className="text-xs text-[#007AFF] hover:underline">
            {showOutput ? '▾ 收起 Output' : '▸ 展开 Output'}
          </button>
          {showOutput && (
            <pre className="mt-1 max-h-40 overflow-auto text-xs text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">
              {typeof span.outputPayload === 'string' ? span.outputPayload : JSON.stringify(span.outputPayload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
