/**
 * OrchestrationPage — 编排层聚合页面
 */
import { useEffect } from 'react';
import { OrchestrationDashboard } from './OrchestrationDashboard';
import { AgentProfileCard } from './AgentProfileCard';
import { EscalationTimeline } from './EscalationTimeline';
import { CollaborationTopology } from '../collaboration/CollaborationTopology';
import { Icon } from '../../components/ui/Icon';
import { useCollaborationStore } from '../../../application/stores/collaborationStore';

export function OrchestrationPage() {
  const { agentProfiles, escalationEvents, fetchProfiles } = useCollaborationStore();

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="hub" size={20} className="text-primary" />
        <h1 className="text-base font-semibold text-slate-100">智能体编排</h1>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1400px] mx-auto">
          <div className="xl:col-span-2">
            <OrchestrationDashboard />
          </div>
          <CollaborationTopology />
          <div className="space-y-4">
            {agentProfiles.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-[11px] text-slate-500">
                暂无 Agent 画像数据
              </div>
            ) : (
              agentProfiles.map((p) => (
                <AgentProfileCard
                  key={p.agentId}
                  agentId={p.agentId}
                  name={p.agentName}
                  status={p.totalFailed > p.totalCompleted * 0.3 ? 'overloaded' : 'active'}
                  successRate={p.successRate}
                  taskCount={p.totalCompleted + p.totalFailed}
                  domains={p.domains}
                />
              ))
            )}
          </div>
          <div className="xl:col-span-2">
            <EscalationTimeline events={escalationEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}
