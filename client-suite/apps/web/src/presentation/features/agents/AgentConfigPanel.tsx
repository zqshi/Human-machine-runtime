import { Icon } from '../../components/ui/Icon';

interface AgentCapability {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
}

interface AgentConfigPanelProps {
  agentId: string;
  agentName: string;
  capabilities: AgentCapability[];
  onToggle: (capId: string, enabled: boolean) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  text: '文本处理',
  data: '数据分析',
  code: '代码执行',
  retrieval: '信息检索',
  workflow: '流程编排',
};

export function AgentConfigPanel({
  agentName,
  capabilities,
  onToggle,
  onClose,
}: AgentConfigPanelProps) {
  const grouped = capabilities.reduce<Record<string, AgentCapability[]>>((acc, cap) => {
    const group = acc[cap.category] ?? [];
    group.push(cap);
    acc[cap.category] = group;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] border-l border-white/10">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <Icon name="arrow_back" size={18} />
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-slate-100">{agentName}</h3>
          <p className="text-xs text-slate-500">能力配置</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-4 space-y-5">
        {Object.entries(grouped).map(([category, caps]) => (
          <div key={category}>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              {CATEGORY_LABELS[category] ?? category}
            </h4>
            <div className="space-y-2">
              {caps.map((cap) => (
                <div
                  key={cap.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                >
                  <span className="text-sm text-slate-200">{cap.name}</span>
                  <button
                    onClick={() => onToggle(cap.id, !cap.enabled)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      cap.enabled ? 'bg-primary' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        cap.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
