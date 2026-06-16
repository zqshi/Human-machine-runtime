/**
 * RiskAnalysisPanel — 风险分析面板
 *
 * 展示 AI 识别的风险项及缓解建议。
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import type { RiskItem } from '../../../domain/agent/IOpenClawDataSource';

interface Props {
  risks: RiskItem[];
}

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  high: { bg: 'bg-red-400/10 border-red-400/20', text: 'text-red-400', label: '高', icon: 'error' },
  medium: {
    bg: 'bg-orange-400/10 border-orange-400/20',
    text: 'text-orange-400',
    label: '中',
    icon: 'warning',
  },
  low: {
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    text: 'text-yellow-400',
    label: '低',
    icon: 'info',
  },
};

export function RiskAnalysisPanel({ risks }: Props) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const toggleAcknowledge = (id: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (risks.length === 0) return null;

  const highCount = risks.filter((r) => r.level === 'high').length;
  const medCount = risks.filter((r) => r.level === 'medium').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="shield" size={14} className="text-orange-400" />
        <span className="text-[11px] font-medium text-slate-300">风险分析</span>
        {highCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">
            {highCount} 高风险
          </span>
        )}
        {medCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-400/10 text-orange-400 border border-orange-400/20">
            {medCount} 中风险
          </span>
        )}
      </div>

      <div className="space-y-2">
        {risks.map((risk) => {
          const style = LEVEL_STYLES[risk.level] ?? LEVEL_STYLES.low;
          const isAcknowledged = acknowledged.has(risk.id);

          return (
            <div
              key={risk.id}
              className={`rounded-lg border px-3 py-2.5 transition-opacity ${style.bg} ${isAcknowledged ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-2">
                <Icon name={style.icon} size={13} className={`${style.text} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[9px] font-medium ${style.text}`}>
                      {style.label}风险
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed mb-1.5">
                    {risk.description}
                  </p>
                  <div className="flex items-start gap-1.5">
                    <Icon
                      name="tips_and_updates"
                      size={10}
                      className="text-green-400/70 mt-0.5 shrink-0"
                    />
                    <p className="text-[10px] text-slate-400 leading-relaxed">{risk.mitigation}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAcknowledge(risk.id)}
                  className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                    isAcknowledged
                      ? 'bg-green-400/20 text-green-400'
                      : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                  }`}
                  title={isAcknowledged ? '已知悉' : '标记已知悉'}
                >
                  <Icon name={isAcknowledged ? 'check_circle' : 'check'} size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
