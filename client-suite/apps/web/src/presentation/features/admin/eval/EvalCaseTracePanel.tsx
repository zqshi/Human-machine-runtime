/**
 * 评测用例 Trace 面板 — 将用例执行过程以 trace 风格可视化展示
 *
 * 包含：工具调用瀑布图、LLM Judge 评判依据、维度细分得分
 */

import { useState } from 'react';
import type { ToolCallEntry } from '../../../../application/services/adminApi';
import { SpanWaterfall, SpanDetailPanel, type SpanItem } from '../../../components/trace/SpanWaterfall';
import { Icon } from '../../../components/ui/Icon';

const DIM_LABELS: Record<string, string> = {
  correctness: '正确性', efficiency: '效率', safety: '安全性', interaction: '交互体验',
  accuracy: '准确性', completeness: '完整性', relevance: '相关性', conciseness: '简洁性',
};

/* ──── 工具调用瀑布图 ──── */

function ToolCallWaterfall({ toolCalls }: { toolCalls?: ToolCallEntry[] | null }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  if (!toolCalls || toolCalls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 flex items-center gap-2">
        <Icon name="timeline" size={14} className="text-gray-300" />
        <span>执行轨迹将在接入真实 Agent 执行后显示（当前为模拟数据）</span>
      </div>
    );
  }

  // ToolCallEntry → SpanItem 直接映射（字段完全对应）
  const spanItems: SpanItem[] = toolCalls.map((tc) => ({
    spanId: tc.spanId,
    parentId: tc.parentId ?? null,
    operationName: tc.operationName,
    startTime: tc.startTime ?? null,
    durationMs: tc.durationMs,
    status: tc.status,
    depth: tc.depth,
    tags: tc.tags ?? null,
    model: tc.model ?? null,
    inputPayload: tc.inputPayload,
    outputPayload: tc.outputPayload,
  }));

  const selectedSpan = selectedSpanId ? spanItems.find((s) => s.spanId === selectedSpanId) : null;

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 rounded-xl bg-white p-4 overflow-x-auto">
        <SpanWaterfall
          spans={spanItems}
          selectedSpanId={selectedSpanId}
          onSelectSpan={setSelectedSpanId}
          emptyHint="暂无工具调用记录"
        />
      </div>
      {selectedSpan && <SpanDetailPanel span={selectedSpan} />}
    </div>
  );
}

/* ──── LLM Judge 评判依据 ──── */

function JudgeResponsePanel({ judgeResponse }: { judgeResponse?: Record<string, unknown> | null }) {
  if (!judgeResponse) return null;

  const comment = typeof judgeResponse.comment === 'string' ? judgeResponse.comment : null;
  const topIssue = typeof judgeResponse.top_issue === 'string' ? judgeResponse.top_issue : null;
  const total = typeof judgeResponse.total === 'number' ? judgeResponse.total : null;

  const scoreDimensions = [
    { key: 'task_understanding', label: '任务理解' },
    { key: 'execution_quality', label: '执行质量' },
    { key: 'delivery_quality', label: '交付质量' },
  ].filter((d) => typeof judgeResponse[d.key] === 'number');

  if (!comment && !topIssue && scoreDimensions.length === 0 && total == null) return null;

  return (
    <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="psychology" size={14} className="text-purple-500" />
        <span className="text-sm font-semibold text-gray-700">评判依据</span>
        {total != null && (
          <span className="ml-auto text-sm font-semibold text-gray-800">{Math.round(total * 100)}%</span>
        )}
      </div>

      {scoreDimensions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {scoreDimensions.map((d) => {
            const val = judgeResponse[d.key] as number;
            const pct = Math.round(val * 100);
            return (
              <div key={d.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{d.label}</span>
                  <span className="font-semibold text-gray-700">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-400" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {comment && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
          <span className="font-medium text-gray-500">评判意见：</span>{comment}
        </div>
      )}

      {topIssue && (
        <div className="text-xs text-orange-600 bg-orange-50 rounded-lg p-3 flex items-center gap-1.5">
          <Icon name="warning" size={12} />
          <span className="font-medium">首要问题：</span>{topIssue}
        </div>
      )}
    </div>
  );
}

/* ──── 维度细分得分 ──── */

function DimensionScoreBreakdown({ dimensionScores }: { dimensionScores?: Record<string, number> | null }) {
  if (!dimensionScores || Object.keys(dimensionScores).length === 0) return null;

  const entries = Object.entries(dimensionScores).filter(([, v]) => typeof v === 'number');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {entries.map(([key, val]) => {
        const pct = Math.round(val * 100);
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{DIM_LABELS[key] ?? key}</span>
              <span className="font-semibold text-gray-700">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──── 导出：用例 Trace 面板 ──── */

export function CaseTracePanel({
  toolCallsLog,
  judgeResponse,
  dimensionScores,
  score,
  failure,
  actualOutput,
  failureReason,
}: {
  toolCallsLog?: ToolCallEntry[] | null;
  judgeResponse?: Record<string, unknown> | null;
  dimensionScores?: Record<string, number> | null;
  score?: number | null;
  failure?: { expected: string; actual: string } | null;
  actualOutput?: string | null;
  failureReason?: string | null;
}) {
  const [showComparison, setShowComparison] = useState(false);

  const hasComparison = failure || actualOutput;

  return (
    <div className="space-y-4">
      {/* 综合得分 + 维度细分 */}
      {score != null && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">综合得分</span>
            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden max-w-[300px]">
              <div
                className={`h-full rounded-full ${score >= 0.8 ? 'bg-green-500' : score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.round(score * 100)}%` }}
              />
            </div>
            <span className={`text-sm font-semibold ${score >= 0.8 ? 'text-green-600' : score >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(score * 100)}%
            </span>
          </div>
          <DimensionScoreBreakdown dimensionScores={dimensionScores} />
        </div>
      )}

      {/* 执行过程 — 工具调用瀑布图 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Icon name="timeline" size={14} className="text-[#007AFF]" /> 执行过程
        </h4>
        <ToolCallWaterfall toolCalls={toolCallsLog} />
      </div>

      {/* 评判依据 */}
      <JudgeResponsePanel judgeResponse={judgeResponse} />

      {/* 期望 vs 实际（可折叠） */}
      {hasComparison && (
        <div>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs text-[#007AFF] hover:underline flex items-center gap-1"
          >
            <Icon name={showComparison ? 'expand_less' : 'expand_more'} size={14} />
            {showComparison ? '收起期望/实际对比' : '展开期望/实际对比'}
          </button>

          {showComparison && (
            <div className="mt-2 space-y-3">
              {failure && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-[10px] text-gray-400 mb-1 font-medium">期望输出</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">{failure.expected}</pre>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-[10px] text-gray-400 mb-1 font-medium">实际输出</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">{failure.actual}</pre>
                  </div>
                </div>
              )}
              {!failure && actualOutput && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-[10px] text-gray-400 mb-1 font-medium">完整实际输出</div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-[200px] overflow-y-auto">{actualOutput}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 失败原因 */}
      {failureReason && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100">
          <div className="text-[10px] text-red-500 mb-1 font-medium">失败原因</div>
          <pre className="text-xs text-red-600 whitespace-pre-wrap">{failureReason}</pre>
        </div>
      )}
    </div>
  );
}
