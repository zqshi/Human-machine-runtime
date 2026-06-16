/**
 * CreateTab — 统一创建入口（暗色主题）
 *
 * Segmented Tab 切换类型（App / Skill / Agent / MCP）
 * - App/Skill/Agent: 对话输入框 + 模板
 * - MCP: 三种接入模式卡片（内联展示，不跳转）
 * 点击发送或模式卡片后进入对应的独立 Workspace/Flow
 */
import { useState, useRef, useEffect } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { useStudioStore } from '../../../../application/stores/studioStore';

type CreateType = 'App' | 'Skill' | 'Agent' | 'MCP';

const TABS: CreateType[] = ['App', 'Skill', 'Agent', 'MCP'];

const MODELS = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', color: '#34C759' },
  { id: 'deepseek-v3', label: 'DeepSeek V3', color: '#007AFF' },
  { id: 'qwen3-235b', label: 'Qwen3 235B', color: '#AF52DE' },
];

const TEMPLATES: Record<Exclude<CreateType, 'MCP'>, { label: string; desc: string }[]> = {
  App: [
    { label: 'React 应用', desc: '基于 React 的 SPA 应用' },
    { label: '数据看板', desc: '可视化 Dashboard' },
    { label: '表单审批', desc: '多级审批工作流' },
    { label: 'API 文档', desc: '自动化接口文档' },
  ],
  Skill: [
    { label: 'SQL 优化', desc: '分析并优化 SQL 查询' },
    { label: '文本摘要', desc: '长文本智能摘要' },
    { label: '代码审查', desc: '多语言代码 Review' },
    { label: '数据清洗', desc: '结构化数据处理' },
  ],
  Agent: [
    { label: '客服助手', desc: '自动回复常见问题' },
    { label: '数据分析师', desc: '对话式数据探索' },
    { label: '内容创作', desc: '文案/文章生成' },
    { label: '工具型 Agent', desc: '集成多工具调用' },
  ],
};

const MCP_MODES = [
  {
    key: 'mcp-openapi' as const,
    label: 'OpenAPI 导入',
    desc: '提供 API 文档链接或描述，AI 自动解析并完成全部接入',
    icon: 'description',
    color: 'rgba(0,122,255,0.12)',
  },
  {
    key: 'mcp-database' as const,
    label: 'Database 直连',
    desc: '填写数据库连接信息，自动探测表结构并生成查询工具',
    icon: 'storage',
    color: 'rgba(52,199,89,0.12)',
  },
  {
    key: 'mcp-gateway' as const,
    label: 'Gateway 对接',
    desc: '连接 API 网关 Admin API，自动发现已有路由转为工具',
    icon: 'hub',
    color: 'rgba(255,149,0,0.12)',
  },
];

export function CreateTab() {
  const [activeTab, setActiveTab] = useState<CreateType>('Agent');
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const modelMenuRef = useRef<HTMLDivElement>(null);
  const openAgentManagement = useStudioStore((s) => s.openAgentManagement);
  const enterCreateFlow = useStudioStore((s) => s.enterCreateFlow);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        showModelMenu &&
        modelMenuRef.current &&
        !modelMenuRef.current.contains(e.target as Node)
      ) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelMenu]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (activeTab === 'Agent') {
      const agentId = `agent-${Date.now()}`;
      openAgentManagement(agentId);
    } else if (activeTab === 'Skill') {
      enterCreateFlow('Skill');
    } else if (activeTab === 'App') {
      enterCreateFlow('App');
    }
  };

  const handleTemplateClick = (label: string) => {
    setInputText(label);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-y-auto dcf-scrollbar">
      <div className="w-full max-w-2xl">
        {/* Title */}
        <h1 className="text-[22px] font-bold text-center text-slate-100 mb-6">你想要创造什么？</h1>

        {/* Segmented Tab */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex p-1 rounded-full bg-white/[0.06]">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-full text-[12px] font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content: 根据 activeTab 不同 */}
        {activeTab !== 'MCP' ? (
          <>
            {/* Input Area */}
            <div className="relative mb-6 rounded-2xl border border-white/[0.1] bg-white/[0.03] shadow-sm">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`描述你想创建的${activeTab === 'App' ? '应用' : activeTab === 'Skill' ? '技能' : 'Agent'}...`}
                className="w-full h-24 px-5 py-4 text-[13px] rounded-2xl resize-none outline-none bg-transparent text-slate-200 placeholder:text-slate-500"
              />
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 pb-3 border-t border-white/[0.06] pt-2.5 mt-1">
                <div className="flex items-center gap-1.5">
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-colors">
                    <Icon name="attach_file" size={14} />
                  </button>
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-colors text-[13px] font-medium">
                    @
                  </button>
                  {/* Model selector */}
                  <div className="relative" ref={modelMenuRef}>
                    <button
                      onClick={() => setShowModelMenu(!showModelMenu)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-[10px] text-slate-400 ml-1"
                    >
                      <span
                        className="w-[6px] h-[6px] rounded-full"
                        style={{ background: selectedModel.color }}
                      />
                      {selectedModel.label}
                      <span className="text-[8px] ml-0.5">▾</span>
                    </button>
                    {showModelMenu && (
                      <div className="absolute bottom-full left-0 mb-2 w-44 bg-[#1e1e2e] border border-white/[0.1] rounded-xl shadow-lg py-1 z-50">
                        {MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedModel(m);
                              setShowModelMenu(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-[11px] transition-colors flex items-center gap-2 ${m.id === selectedModel.id ? 'bg-primary/[0.06] text-primary' : 'text-slate-300 hover:bg-white/[0.04]'}`}
                          >
                            <span
                              className="w-[7px] h-[7px] rounded-full"
                              style={{ background: m.color }}
                            />
                            {m.label}
                            {m.id === selectedModel.id && <span className="ml-auto">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-primary disabled:opacity-30 transition-all"
                >
                  ↑
                </button>
              </div>
            </div>

            {/* Templates */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400">从模板开始</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES[activeTab].map((t) => (
                  <button
                    key={t.label}
                    onClick={() => handleTemplateClick(t.label)}
                    className="flex items-start gap-2.5 p-3 border border-white/[0.08] bg-white/[0.03] rounded-xl text-left hover:border-primary/30 hover:bg-white/[0.06] transition-all"
                  >
                    <div>
                      <div className="text-[12px] font-medium text-slate-200">{t.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* MCP 模式选择卡片 — 内联展示 */
          <div>
            <p className="text-[13px] text-slate-400 text-center mb-6">选择接入方式</p>
            <div className="flex flex-col gap-3">
              {MCP_MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => enterCreateFlow(m.key)}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left hover:border-primary/30 hover:bg-white/[0.06] transition-all group"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: m.color }}
                  >
                    <Icon name={m.icon} size={22} className="text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-slate-100">{m.label}</div>
                    <div className="text-[12px] text-slate-400 mt-0.5">{m.desc}</div>
                  </div>
                  <Icon
                    name="chevron_right"
                    size={16}
                    className="text-slate-600 group-hover:text-primary transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
