/**
 * OrchestrationDashboard — Agent 编排仪表盘
 *
 * Agent 拓扑图 + 路由权重可视化 + 能力画像列表。
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { AgentProfileCard } from './AgentProfileCard';
import { EscalationTimeline } from './EscalationTimeline';
import { useCollaborationStore } from '../../../application/stores/collaborationStore';

interface AgentNode {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'overloaded' | 'offline';
  taskCount: number;
  successRate: number;
  domains: string[];
}

interface Connection {
  from: string;
  to: string;
  intentType: string;
  weight: number;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-400',
  idle: 'bg-slate-400',
  overloaded: 'bg-orange-400',
  offline: 'bg-red-400',
};

function AgentNodeCard({
  agent,
  isSelected,
  onClick,
}: {
  agent: AgentNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 min-w-[140px] transition-all ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.08] scale-105'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[agent.status]}`} />
        <span className="text-xs font-semibold text-slate-200">{agent.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">{agent.taskCount} 任务</span>
        <span className="text-[10px] text-green-400">{Math.round(agent.successRate * 100)}%</span>
      </div>
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {agent.domains.map((d) => (
          <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
            {d}
          </span>
        ))}
      </div>
    </button>
  );
}

export function OrchestrationDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { agentProfiles, intents, fetchProfiles, fetchIntents, subscribeSSE } =
    useCollaborationStore();

  useEffect(() => {
    fetchProfiles();
    fetchIntents();
    subscribeSSE();
  }, [fetchProfiles, fetchIntents, subscribeSSE]);

  const agents: AgentNode[] = agentProfiles.map((p) => ({
    id: p.agentId,
    name: p.agentName,
    status: p.totalCompleted > 0 ? 'active' : 'idle',
    taskCount: p.totalCompleted,
    successRate: p.successRate,
    domains: p.domains,
  }));

  const connections: Connection[] = intents
    .filter((i) => i.agentId)
    .map((i) => ({ from: i.agentId!, to: i.agentId!, intentType: i.type, weight: 0.7 }));

  const selected = agents.find((a) => a.id === selectedAgent);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="hub" size={18} className="text-primary/80" />
        <span className="text-sm font-semibold text-slate-200">编排仪表盘</span>
        <span className="text-[10px] text-slate-500">{agents.length} Agents</span>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-4 space-y-4">
        {/* Topology */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="device_hub" size={14} className="text-primary/70" />
            <span className="text-xs font-medium text-slate-200">Agent 拓扑</span>
            <span className="text-[10px] text-slate-500">{connections.length} 连接</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {agents.map((agent) => (
              <AgentNodeCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent === agent.id}
                onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
              />
            ))}
          </div>
          {/* Connection lines (simplified text representation) */}
          <div className="mt-3 space-y-1">
            {connections.map((conn) => (
              <div
                key={`${conn.from}-${conn.to}`}
                className="flex items-center gap-2 text-[10px] text-slate-500"
              >
                <span className="text-slate-300">
                  {agents.find((a) => a.id === conn.from)?.name}
                </span>
                <Icon name="arrow_forward" size={10} />
                <span className="text-slate-300">{agents.find((a) => a.id === conn.to)?.name}</span>
                <span className="text-slate-600">({conn.intentType})</span>
                <div className="flex-1 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/40"
                    style={{ width: `${conn.weight * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected agent profile */}
        {selected && (
          <AgentProfileCard
            agentId={selected.id}
            name={selected.name}
            status={selected.status}
            successRate={selected.successRate}
            taskCount={selected.taskCount}
            domains={selected.domains}
          />
        )}

        {/* Escalation timeline */}
        <EscalationTimeline />
      </div>
    </div>
  );
}
