/**
 * AgentStatusGrid — Agent 状态网格
 *
 * 从 TaskMonitorContent 抽离，展示每个 Agent 的状态和待处理决策数。
 */
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useAgentStore } from '../../../application/stores/agentStore';
import { Icon } from '../../components/ui/Icon';

const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  working: { icon: 'directions_run', color: 'text-green-400' },
  idle: { icon: 'nightlight', color: 'text-slate-400' },
  offline: { icon: 'power_off', color: 'text-slate-600' },
  monitoring: { icon: 'monitor_heart', color: 'text-blue-400' },
  'awaiting-decision': { icon: 'help', color: 'text-orange-400' },
  error: { icon: 'error', color: 'text-red-400' },
};

export function AgentStatusGrid() {
  const runtimes = useOpenClawStore((s) => s.runtimes);
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const templates = useAgentStore((s) => s.capabilityRegistry.getAvailableTemplates());

  if (runtimes.length === 0) return null;

  return (
    <section>
      <span className="text-xs font-medium text-slate-300 block mb-2">Agent 状态</span>
      <div className="space-y-1">
        {runtimes.map((rt) => {
          const template = templates.find((t) => t.id === rt.agentId);
          const statusStyle = STATUS_ICON[rt.runtimeStatus] ?? STATUS_ICON.idle;
          const pendingCount = decisionRequests.filter(
            (d) => d.agentId === rt.agentId && d.isPending,
          ).length;

          return (
            <div
              key={rt.agentId}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <Icon name={statusStyle.icon} size={14} className={statusStyle.color} />
              <span className="text-[11px] text-slate-300 flex-1 truncate">
                {template?.name ?? rt.agentId}
              </span>
              {pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {pendingCount} 决策
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
