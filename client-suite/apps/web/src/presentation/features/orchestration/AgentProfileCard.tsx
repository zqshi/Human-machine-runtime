/**
 * AgentProfileCard — Agent 能力画像卡
 */
import { Icon } from '../../components/ui/Icon';

interface AgentProfileCardProps {
  agentId: string;
  name: string;
  status: string;
  successRate: number;
  taskCount: number;
  domains: string[];
}

export function AgentProfileCard({
  name,
  status,
  successRate,
  taskCount,
  domains,
}: AgentProfileCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="smart_toy" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">{name}</span>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded ${
            status === 'active'
              ? 'bg-green-400/10 text-green-400'
              : status === 'overloaded'
                ? 'bg-orange-400/10 text-orange-400'
                : 'bg-slate-400/10 text-slate-400'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 text-center">
          <div className="text-lg font-semibold text-slate-200">
            {Math.round(successRate * 100)}%
          </div>
          <div className="text-[9px] text-slate-500">成功率</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 text-center">
          <div className="text-lg font-semibold text-slate-200">{taskCount}</div>
          <div className="text-[9px] text-slate-500">活跃任务</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 text-center">
          <div className="text-lg font-semibold text-slate-200">{domains.length}</div>
          <div className="text-[9px] text-slate-500">能力域</div>
        </div>
      </div>

      <div className="mt-3">
        <span className="text-[10px] text-slate-500 block mb-1">能力域</span>
        <div className="flex gap-1.5 flex-wrap">
          {domains.map((d) => (
            <span
              key={d}
              className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary/80 border border-primary/20"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
