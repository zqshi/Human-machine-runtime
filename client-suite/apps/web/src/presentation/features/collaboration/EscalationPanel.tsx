import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';

interface EscalationEntry {
  id: string;
  chainId: string;
  reason: string;
  fromAgent: string;
  toTarget: string;
  urgency: 'critical' | 'high' | 'normal';
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: number;
}

// 去mock:移除 MOCK_ESCALATIONS 假数据(escalation 是 SSE 事件流 escalation:triggered/resolved,
// 非列表 API;真实待处理列表需接事件流聚合或后端列表端点,留后续)。当前空态。

const URGENCY_STYLES: Record<string, string> = {
  critical: 'border-red-500/30 bg-red-500/5',
  high: 'border-orange-500/30 bg-orange-500/5',
  normal: 'border-slate-600/30 bg-slate-600/5',
};

export function EscalationPanel() {
  const [escalations] = useState<EscalationEntry[]>([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="warning" size={18} className="text-orange-400" />
        <h3 className="text-sm font-medium text-slate-200">人工介入升维</h3>
        <span className="ml-auto text-xs text-slate-500">
          {escalations.filter((e) => e.status === 'open').length} 待处理
        </span>
      </div>

      {escalations.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">暂无人工介入记录</div>
      ) : (
        escalations.map((esc) => (
          <div
            key={esc.id}
            className={`rounded-lg border p-3 ${URGENCY_STYLES[esc.urgency] ?? ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{esc.reason}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {esc.fromAgent} → {esc.toTarget}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  esc.status === 'open'
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'bg-green-500/20 text-green-300'
                }`}
              >
                {esc.status === 'open' ? '待处理' : '已确认'}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
