/**
 * DecisionDetailContent — Drawer 决策详情视图
 *
 * 完整展示决策请求的上下文、所有方案对比、AI 推荐理由。
 */
import { useState, useCallback } from 'react';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { Icon } from '../../components/ui/Icon';
import { CorrectionSummaryCard } from './CorrectionSummaryCard';
import { JudgmentRecordTimeline } from './JudgmentRecordTimeline';

const URGENCY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-yellow-400',
  low: 'text-slate-400',
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

function formatDeadline(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return '已过期';
  if (diff < 60_000) return `${Math.ceil(diff / 1000)} 秒后`;
  if (diff < 3_600_000) return `${Math.ceil(diff / 60_000)} 分钟后`;
  return `${Math.ceil(diff / 3_600_000)} 小时后`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  data: Record<string, unknown>;
}

export function DecisionDetailContent({ data }: Props) {
  const decisionRequests = useCockpitStore((s) => s.decisionRequests);
  const respondDecision = useCockpitStore((s) => s.respondDecision);
  const closeDrawer = useCockpitStore((s) => s.closeDrawer);
  const decisionId = data.decisionId as string;
  const decision = decisionRequests.find((d) => d.id === decisionId);
  const [feedback, setFeedback] = useState('');

  const handleDefer = useCallback(() => {
    respondDecision(decisionId, 'defer', { deferUntil: Date.now() + 3_600_000 });
    closeDrawer();
  }, [respondDecision, decisionId, closeDrawer]);

  if (!decision) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="help_outline" size={40} className="text-slate-600 mb-2" />
        <p className="text-xs">决策请求未找到</p>
      </div>
    );
  }

  const allOptions = [decision.recommendation, ...decision.alternatives];
  const isResolved = decision.responseStatus !== 'pending';

  const handleAccept = () => {
    respondDecision(decision.id, 'accept');
    closeDrawer();
  };

  const handleSelectOption = (optionId: string) => {
    respondDecision(decision.id, 'modify', {
      optionId,
      feedback: feedback || `选择方案: ${optionId}`,
    });
    closeDrawer();
  };

  const handleDecline = () => {
    respondDecision(decision.id, 'decline', { feedback: feedback || '用户拒绝' });
    closeDrawer();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${URGENCY_COLORS[decision.urgency]}`}>
              {decision.urgency === 'critical'
                ? '紧急'
                : decision.urgency === 'high'
                  ? '重要'
                  : '普通'}
            </span>
            <span className="text-[10px] text-slate-500">
              截止: {formatDeadline(decision.deadline)}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-100">{decision.title}</h3>
        </div>

        {/* Context */}
        <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            决策背景
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">{decision.context}</p>
        </div>

        {/* Options comparison */}
        <section className="space-y-2">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            方案对比
          </span>
          {allOptions.map((opt, idx) => (
            <div
              key={opt.id}
              className={`rounded-lg border p-3 space-y-2 transition-colors ${
                idx === 0
                  ? 'border-primary/30 bg-primary/[0.04]'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {idx === 0 && <Icon name="auto_awesome" size={14} className="text-primary" />}
                  <span className="text-xs font-medium text-slate-200">{opt.label}</span>
                </div>
                <span className={`text-[10px] ${RISK_COLORS[opt.riskLevel]}`}>
                  风险: {opt.riskLevel === 'low' ? '低' : opt.riskLevel === 'medium' ? '中' : '高'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{opt.description}</p>
              <p className="text-[11px] text-slate-500 italic">{opt.reasoning}</p>
              {opt.estimatedImpact && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Icon name="trending_up" size={12} />
                  {opt.estimatedImpact}
                </div>
              )}
              {idx > 0 && !isResolved && (
                <button
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  className="mt-1 w-full h-7 rounded-md border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1"
                >
                  <Icon name="check_circle_outline" size={12} />
                  选择此方案
                </button>
              )}
            </div>
          ))}
        </section>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>创建: {formatTime(decision.createdAt)}</span>
          {decision.responseAt && <span>处理: {formatTime(decision.responseAt)}</span>}
        </div>
      </div>

      {/* Actions footer */}
      {!isResolved && (
        <div className="border-t border-white/10 px-4 py-3 space-y-2">
          <textarea
            placeholder="补充说明（可选）..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleAccept}
              className="flex-1 h-8 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="check" size={14} />
              采纳推荐
            </button>
            <button
              onClick={handleDefer}
              className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="schedule" size={14} />
              延后 1 小时
            </button>
            <button
              onClick={handleDecline}
              className="w-8 h-8 rounded-lg border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
              title="拒绝"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      )}

      {isResolved && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3">
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
          {decision.userResponse && (
            <p className="mt-1.5 text-[11px] text-slate-500 italic">"{decision.userResponse}"</p>
          )}
          <CorrectionSummaryCard />
          <JudgmentRecordTimeline decisionId={decision.id} />
        </div>
      )}
    </div>
  );
}
