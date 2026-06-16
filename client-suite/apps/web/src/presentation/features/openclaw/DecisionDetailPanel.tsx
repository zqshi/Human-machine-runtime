/**
 * DecisionDetailPanel — B 栏决策详情面板
 *
 * 从 DecisionDetailContent（drawer 版）提取核心渲染逻辑，
 * 适配 B 栏 320px 宽度，提供完整的决策上下文和操作能力。
 */
import { useState, useCallback } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';
import { CorrectionSummaryCard } from './CorrectionSummaryCard';
import { JudgmentRecordTimeline } from './JudgmentRecordTimeline';

const URGENCY_STYLES: Record<string, { label: string; color: string; dotClass: string }> = {
  critical: { label: '紧急', color: 'text-red-400', dotClass: 'bg-red-400' },
  high: { label: '重要', color: 'text-orange-400', dotClass: 'bg-orange-400' },
  normal: { label: '普通', color: 'text-yellow-400', dotClass: 'bg-yellow-400' },
  low: { label: '低', color: 'text-slate-400', dotClass: 'bg-slate-400' },
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

function formatCountdown(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return '已过期';
  if (diff < 60_000) return `${Math.ceil(diff / 1000)} 秒`;
  if (diff < 3_600_000) return `${Math.ceil(diff / 60_000)} 分钟`;
  return `${Math.ceil(diff / 3_600_000)} 小时`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DecisionDetailPanel() {
  const bColumnDecisionId = useOpenClawStore((s) => s.bColumnDecisionId);
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const respondDecision = useOpenClawStore((s) => s.respondDecision);
  const selectBColumnDecision = useOpenClawStore((s) => s.selectBColumnDecision);

  const decision = decisionRequests.find((d) => d.id === bColumnDecisionId);
  const [feedback, setFeedback] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const handleDefer = useCallback(() => {
    if (!bColumnDecisionId) return;
    respondDecision(bColumnDecisionId, 'defer', { deferUntil: Date.now() + 3_600_000 });
    useToastStore.getState().addToast('已延后 1 小时', 'info');
  }, [respondDecision, bColumnDecisionId]);

  if (!decision) return null;

  const urgencyStyle = URGENCY_STYLES[decision.urgency] ?? URGENCY_STYLES.normal;
  const allOptions = [decision.recommendation, ...decision.alternatives];
  const isResolved = decision.responseStatus !== 'pending';
  const close = () => selectBColumnDecision(null);

  const handleAccept = async () => {
    setIsResponding(true);
    try {
      respondDecision(decision.id, 'accept');
      useToastStore.getState().addToast('已采纳推荐方案', 'success');
    } finally {
      setIsResponding(false);
    }
  };

  const handleSelectOption = (optionId: string) => {
    setIsResponding(true);
    try {
      respondDecision(decision.id, 'modify', {
        optionId,
        feedback: feedback || `选择方案: ${optionId}`,
      });
      useToastStore.getState().addToast('已选择替代方案', 'success');
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = () => {
    respondDecision(decision.id, 'decline', { feedback: feedback || '用户拒绝' });
    useToastStore.getState().addToast('已拒绝', 'info');
  };

  return (
    <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden animate-[slideInLeft_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgencyStyle.dotClass}`} />
        <span className="text-xs font-semibold text-slate-200 truncate flex-1">
          {decision.title}
        </span>
        <span className={`text-[9px] ${urgencyStyle.color}`}>{urgencyStyle.label}</span>
        <button
          type="button"
          onClick={close}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-3">
        {/* Deadline */}
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-slate-500">截止: {formatCountdown(decision.deadline)}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">创建: {formatTime(decision.createdAt)}</span>
        </div>

        {/* Context */}
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
          <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
            决策背景
          </span>
          <p className="text-xs text-slate-300 leading-relaxed mt-1">{decision.context}</p>
        </div>

        {/* Options comparison */}
        <div className="space-y-2">
          <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
            方案对比
          </span>
          {allOptions.map((opt, idx) => (
            <div
              key={opt.id}
              className={`rounded-lg border p-2.5 space-y-1.5 transition-colors ${
                idx === 0
                  ? 'border-primary/30 bg-primary/[0.04]'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {idx === 0 && <Icon name="auto_awesome" size={12} className="text-primary" />}
                  <span className="text-[11px] font-medium text-slate-200">{opt.label}</span>
                </div>
                <span className={`text-[9px] ${RISK_COLORS[opt.riskLevel]}`}>
                  风险: {opt.riskLevel === 'low' ? '低' : opt.riskLevel === 'medium' ? '中' : '高'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{opt.description}</p>
              <p className="text-[10px] text-slate-500 italic">{opt.reasoning}</p>
              {opt.estimatedImpact && (
                <div className="flex items-center gap-1 text-[9px] text-slate-500">
                  <Icon name="trending_up" size={11} />
                  {opt.estimatedImpact}
                </div>
              )}
              {idx > 0 && !isResolved && (
                <button
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={isResponding}
                  className="mt-1 w-full h-6 rounded-md border border-white/10 text-[9px] text-slate-300 hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <Icon name="check_circle_outline" size={11} />
                  选择此方案
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom: actions */}
      <div className="border-t border-white/10 shrink-0 px-4 py-2.5 space-y-2">
        {!isResolved && (
          <>
            <textarea
              placeholder="补充说明（可选）..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleAccept}
                disabled={isResponding}
                className="flex-1 h-7 rounded-md bg-primary text-[10px] text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <Icon name="check" size={12} />
                采纳推荐
              </button>
              <button
                type="button"
                onClick={handleDefer}
                disabled={isResponding}
                className="flex-1 h-7 rounded-md border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <Icon name="schedule" size={12} />
                延后
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={isResponding}
                className="h-7 w-7 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 flex items-center justify-center shrink-0"
                title="拒绝"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          </>
        )}

        {isResolved && (
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Icon name="check_circle" size={16} className="text-green-400" />
              <span>
                {decision.responseStatus === 'accepted'
                  ? '已采纳推荐方案'
                  : decision.responseStatus === 'modified'
                    ? '已选择替代方案'
                    : decision.responseStatus === 'deferred'
                      ? '已延后处理'
                      : decision.responseStatus === 'expired'
                        ? '已过期'
                        : '已拒绝'}
              </span>
            </div>
            <CorrectionSummaryCard />
            <JudgmentRecordTimeline decisionId={decision.id} />
          </div>
        )}
      </div>
    </div>
  );
}
