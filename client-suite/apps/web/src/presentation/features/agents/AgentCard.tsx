import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';

interface SharedAgent {
  id: string;
  name: string;
  role: string;
  description?: string;
  category: string;
  invokeCount: number;
  icon?: string;
}

interface AgentCardProps {
  agent: SharedAgent;
  onClick?: () => void;
}

const categoryGradients: Record<string, string> = {
  dev: 'from-blue-500 to-cyan-500',
  docs: 'from-emerald-500 to-teal-500',
  data: 'from-violet-500 to-purple-500',
  design: 'from-pink-500 to-rose-500',
  test: 'from-amber-500 to-orange-500',
  ops: 'from-slate-500 to-gray-600',
  translate: 'from-sky-500 to-blue-500',
  security: 'from-red-500 to-rose-600',
};

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const gradient = categoryGradients[agent.category] ?? 'from-primary to-primary-dark';

  return (
    <Card hoverable className="p-4" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}
        >
          <Icon name={agent.icon || 'smart_toy'} size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text-primary">{agent.name}</h4>
          <p className="text-xs text-text-secondary mt-0.5">{agent.role}</p>
          {agent.description && (
            <p className="text-xs text-text-muted mt-1 line-clamp-2">{agent.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-text-muted">{agent.invokeCount} 次调用</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
