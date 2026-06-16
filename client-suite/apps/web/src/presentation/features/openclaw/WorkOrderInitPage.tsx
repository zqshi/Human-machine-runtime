/**
 * WorkOrderInitPage — 工单讨论初始化界面（C 栏顶部锚点）
 *
 * 当 discussingWorkOrderId 非空时渲染在 C 栏对话流顶部，
 * 展示工单背景（来源、AI 建议、置信度）+ 快速回复。
 */
import { useMemo, useState } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { Icon } from '../../components/ui/Icon';

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  approval: { label: '审批', icon: 'approval', color: 'text-orange-400' },
  review: { label: '评审', icon: 'rate_review', color: 'text-blue-400' },
  input: { label: '信息采集', icon: 'input', color: 'text-green-400' },
  decision: { label: '决策', icon: 'bolt', color: 'text-red-400' },
};

function formatDeadline(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return '已过期';
  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 24) return `${hours} 小时内`;
  return `${Math.ceil(hours / 24)} 天内`;
}

export function WorkOrderInitPage() {
  const discussingWorkOrderId = useOpenClawStore((s) => s.discussingWorkOrderId);
  const workOrders = useOpenClawStore((s) => s.workOrders);
  const respondWorkOrder = useOpenClawStore((s) => s.respondWorkOrder);

  const workOrder = useMemo(
    () => workOrders.find((wo) => wo.id === discussingWorkOrderId),
    [workOrders, discussingWorkOrderId]
  );

  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!workOrder) return null;

  const typeStyle = TYPE_LABELS[workOrder.type] ?? TYPE_LABELS.input;
  const isResolved = workOrder.status !== 'pending';
  const confidencePercent = Math.round(workOrder.confidence * 100);

  const handleClose = () => {
    useOpenClawStore.getState().setDiscussingWorkOrderId(null);
  };

  const handleSubmit = async () => {
    if (!response.trim() || submitting) return;
    setSubmitting(true);
    try {
      await respondWorkOrder(workOrder.id, response.trim());
      setResponse('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAI = async () => {
    if (!workOrder.aiSuggestion || submitting) return;
    setSubmitting(true);
    try {
      await respondWorkOrder(workOrder.id, workOrder.aiSuggestion);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <Icon name="assignment" size={15} className="text-purple-400 shrink-0" />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-xs font-medium text-slate-200 truncate">{workOrder.title}</span>
            <Icon
              name={collapsed ? 'expand_more' : 'expand_less'}
              size={14}
              className="text-slate-500 shrink-0"
            />
          </button>
          <span className={`text-[9px] ${typeStyle.color}`}>{typeStyle.label}</span>
          {workOrder.isPending && (
            <span className="text-[10px] text-slate-500 shrink-0">
              {formatDeadline(workOrder.deadline)}
            </span>
          )}
          {isResolved && <span className="text-[9px] text-green-400">已完成</span>}
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Body */}
        {!collapsed && (
          <div className="max-h-[40vh] overflow-y-auto hmr-scrollbar">
            {/* Context */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">{workOrder.context}</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>来自: {workOrder.fromUserId}</span>
                <span>目标: {workOrder.goalId}</span>
              </div>
            </div>

            {/* AI Suggestion */}
            {workOrder.aiSuggestion && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="smart_toy" size={12} className="text-primary" />
                  <span className="text-[10px] font-medium text-slate-400">AI 建议</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      confidencePercent >= 90
                        ? 'bg-green-400/10 text-green-300'
                        : 'bg-yellow-400/10 text-yellow-300'
                    }`}
                  >
                    置信度 {confidencePercent}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {workOrder.aiSuggestion}
                </p>
                {workOrder.isPending && confidencePercent >= 90 && (
                  <button
                    type="button"
                    onClick={handleAcceptAI}
                    disabled={submitting}
                    className="mt-2 h-7 px-3 rounded-lg bg-green-400/20 text-[10px] text-green-300 hover:bg-green-400/30 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Icon name="check" size={12} />
                    采纳 AI 建议
                  </button>
                )}
              </div>
            )}

            {/* Response / resolved info */}
            {isResolved && workOrder.response && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name="check_circle" size={12} className="text-green-400" />
                  <span className="text-[10px] font-medium text-slate-400">回复内容</span>
                </div>
                <p className="text-[11px] text-slate-300">{workOrder.response}</p>
              </div>
            )}

            {/* Reply form */}
            {workOrder.isPending && (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="输入回复内容..."
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-primary/50"
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!response.trim() || submitting}
                    className="h-7 px-4 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? '提交中...' : '提交回复'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
