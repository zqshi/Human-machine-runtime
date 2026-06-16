import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';

interface AgentDetailProps {
  agent: {
    id: string;
    name: string;
    role?: string;
    department?: string;
    status: string;
    capabilities?: string[];
    lastActive?: string;
    taskCount?: number;
    successRate?: number;
  };
  onClose: () => void;
}

export function AgentDetailPanel({ agent, onClose }: AgentDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'logs'>('overview');

  const tabs = [
    { key: 'overview', label: '概览', icon: 'info' },
    { key: 'tasks', label: '任务历史', icon: 'task_alt' },
    { key: 'logs', label: '执行日志', icon: 'terminal' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] border-l border-white/10">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <Icon name="close" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-slate-100 truncate">{agent.name}</h3>
          <p className="text-xs text-slate-500">{agent.role ?? 'Agent'}</p>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${
            agent.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
          }`}
        />
      </div>

      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-xs flex items-center justify-center gap-1 ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto dcf-scrollbar p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="任务总数" value={String(agent.taskCount ?? 0)} />
              <MetricCard label="成功率" value={`${agent.successRate ?? 0}%`} />
            </div>
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div>
                <h4 className="text-xs text-slate-500 mb-2">能力标签</h4>
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary/80"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {agent.department && (
              <div>
                <h4 className="text-xs text-slate-500 mb-1">所属部门</h4>
                <p className="text-sm text-slate-300">{agent.department}</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'tasks' && (
          <p className="text-xs text-slate-500 text-center mt-8">暂无任务记录</p>
        )}
        {activeTab === 'logs' && (
          <p className="text-xs text-slate-500 text-center mt-8">暂无执行日志</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-100 mt-1">{value}</p>
    </div>
  );
}
