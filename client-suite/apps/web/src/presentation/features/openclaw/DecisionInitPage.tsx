/**
 * DecisionInitPage — 决策讨论初始化界面（C 栏顶部锚点）
 *
 * 当 discussingDecisionId 非空时渲染在 C 栏对话流顶部，
 * 提供完整的决策背景、方案对比、快捷操作。
 * 用户在下方和 Agent 讨论后可直接做出决策。
 */
import { useMemo, useState } from 'react';
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

export function DecisionInitPage() {
  const discussingDecisionId = useOpenClawStore((s) => s.discussingDecisionId);
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const respondDecision = useOpenClawStore((s) => s.respondDecision);

  const decision = useMemo(
    () => decisionRequests.find((d) => d.id === discussingDecisionId),
    [decisionRequests, discussingDecisionId]
  );

  const [isResponding, setIsResponding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!decision) return null;

  const urgencyStyle = URGENCY_STYLES[decision.urgency] ?? URGENCY_STYLES.normal;
  const allOptions = [decision.recommendation, ...decision.alternatives];
  const isResolved = decision.responseStatus !== 'pending';

  const handleClose = () => {
    useOpenClawStore.getState().setDiscussingDecisionId(null);
  };

  const handleAccept = () => {
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
      respondDecision(decision.id, 'modify', { optionId, feedback: `选择方案: ${optionId}` });
      useToastStore.getState().addToast('已选择替代方案', 'success');
    } finally {
      setIsResponding(false);
    }
  };

  const handleDefer = () => {
    respondDecision(decision.id, 'defer', { deferUntil: Date.now() + 3_600_000 });
    useToastStore.getState().addToast('已延后 1 小时', 'info');
  };

  const handleDecline = () => {
    respondDecision(decision.id, 'decline', { feedback: '用户拒绝' });
    useToastStore.getState().addToast('已拒绝', 'info');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header — click title to toggle collapse */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgencyStyle.dotClass}`} />
          <Icon name="bolt" size={15} className="text-orange-400 shrink-0" />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-xs font-medium text-slate-200 truncate">
              决策讨论：{decision.title}
            </span>
            <Icon
              name={collapsed ? 'expand_more' : 'expand_less'}
              size={14}
              className="text-slate-500 shrink-0"
            />
          </button>
          <span className={`text-[9px] ${urgencyStyle.color}`}>{urgencyStyle.label}</span>
          <span className="text-[10px] text-slate-500 shrink-0">
            截止 {formatCountdown(decision.deadline)}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Collapsible body */}
        {!collapsed && (
          <div className="max-h-[40vh] overflow-y-auto dcf-scrollbar">
            <div className="px-4 py-3">
              <p className="text-xs text-slate-300 leading-relaxed">{decision.context}</p>
            </div>

            {/* Options comparison — compact horizontal layout for C column width */}
            <div className="border-t border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="compare_arrows" size={12} className="text-slate-500" />
                <span className="text-[10px] font-medium text-slate-400">方案对比</span>
                <span className="text-[10px] text-slate-600">({allOptions.length})</span>
              </div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(allOptions.length, 3)}, 1fr)` }}
              >
                {allOptions.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className={`rounded-lg border p-2.5 space-y-1 ${
                      idx === 0
                        ? 'border-primary/30 bg-primary/[0.04]'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {idx === 0 && <Icon name="auto_awesome" size={12} className="text-primary" />}
                      <span className="text-[11px] font-medium text-slate-200 truncate">
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                      {opt.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] ${RISK_COLORS[opt.riskLevel]}`}>
                        风险:{' '}
                        {opt.riskLevel === 'low' ? '低' : opt.riskLevel === 'medium' ? '中' : '高'}
                      </span>
                      {opt.estimatedImpact && (
                        <span className="text-[9px] text-slate-500 truncate max-w-[120px]">
                          {opt.estimatedImpact}
                        </span>
                      )}
                    </div>
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

            {/* Quick actions — only if pending */}
            {!isResolved && (
              <div className="border-t border-white/[0.06] px-4 py-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isResponding}
                  className="h-7 px-3 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Icon name="check" size={12} />
                  采纳推荐
                </button>
                <button
                  type="button"
                  onClick={handleDefer}
                  disabled={isResponding}
                  className="h-7 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Icon name="schedule" size={12} />
                  延后
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={isResponding}
                  className="h-7 px-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 flex items-center justify-center"
                  title="拒绝"
                >
                  <Icon name="close" size={12} />
                </button>
                <span className="flex-1" />
                <span className="text-[9px] text-slate-600 self-center">和 Agent 讨论后再决策</span>
              </div>
            )}

            {/* Resolved status */}
            {isResolved && (
              <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center gap-2 text-xs text-slate-400">
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
            )}
          </div>
        )}
      </div>

      {/* 纠偏传播摘要 — 决策完成后展示下游影响 */}
      {isResolved && <CorrectionSummaryCard />}
      {isResolved && <JudgmentRecordTimeline decisionId={decision.id} />}
    </div>
  );
}
