/**
 * AgentStudioContent — OpenClaw Drawer 内嵌的轻量创建入口
 *
 * 设计原则：Drawer 只做「快速创建表单」，不做深度编排。
 * 创建完成后自动跳转 Studio 全屏页面进行编排配置。
 *
 * 支持全类型：Agent / Skill / App / MCP
 */
import { useState, useCallback } from 'react';
import { useStudioStore } from '../../../../application/stores/studioStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { useOpenClawStore } from '../../../../application/stores/openclawStore';
import { useUIStore } from '../../../../application/stores/uiStore';
import { Icon } from '../../../components/ui/Icon';

interface ContentProps {
  data: Record<string, unknown>;
}

/* ─── 类型元数据 ─── */

type StudioIntent =
  | 'create-agent'
  | 'edit-agent'
  | 'debug-agent'
  | 'create-skill'
  | 'create-app'
  | 'create-mcp';

interface TypeMeta {
  label: string;
  icon: string;
  placeholder: string;
  descPlaceholder: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  Agent: {
    label: 'Agent',
    icon: 'smart_toy',
    placeholder: '如：智能客服、数据分析师',
    descPlaceholder: '描述 Agent 的职责和能力范围',
  },
  Skill: {
    label: 'Skill',
    icon: 'bolt',
    placeholder: '如：SQL 优化、文本摘要',
    descPlaceholder: '描述技能的输入输出和用途',
  },
  App: {
    label: 'App',
    icon: 'grid_view',
    placeholder: '如：数据看板、审批系统',
    descPlaceholder: '描述应用的功能需求',
  },
  MCP: {
    label: 'MCP 工具',
    icon: 'build',
    placeholder: '如：用户管理 API、订单数据库',
    descPlaceholder: '描述要接入的外部服务',
  },
};

const AGENT_TEMPLATES = [
  { id: 'blank', name: '空白 Agent', desc: '完全自定义', icon: '✨' },
  { id: 'customer-service', name: '客服助手', desc: '知识库问答 + 工单', icon: '🎧' },
  { id: 'data-analyst', name: '数据分析师', desc: 'SQL + 可视化', icon: '📊' },
  { id: 'dev-assistant', name: '开发助手', desc: '代码审查 + 文档', icon: '💻' },
];

const SKILL_TEMPLATES = [
  { id: 'sql-opt', name: 'SQL 优化', desc: '分析并优化查询', icon: '🗄️' },
  { id: 'text-summary', name: '文本摘要', desc: '长文本智能摘要', icon: '📝' },
  { id: 'code-review', name: '代码审查', desc: '多语言 Review', icon: '🔍' },
  { id: 'report-gen', name: '报告生成', desc: '结构化报告', icon: '📋' },
];

const APP_TEMPLATES = [
  { id: 'dashboard', name: '数据看板', desc: '可视化 Dashboard', icon: '📊' },
  { id: 'form-flow', name: '表单审批', desc: '多级审批工作流', icon: '📋' },
  { id: 'chatbot', name: '客服聊天', desc: '嵌入式对话窗口', icon: '💬' },
];

const MCP_MODES = [
  {
    key: 'openapi',
    label: 'OpenAPI 导入',
    desc: 'Swagger 文档自动解析',
    icon: 'description',
    color: 'bg-primary/10',
  },
  {
    key: 'database',
    label: 'Database 直连',
    desc: '自动探测表结构',
    icon: 'storage',
    color: 'bg-emerald-500/10',
  },
  {
    key: 'gateway',
    label: 'Gateway 对接',
    desc: '自动发现已有路由',
    icon: 'hub',
    color: 'bg-amber-500/10',
  },
];

/* ─── 主组件 ─── */

export default function AgentStudioContent({ data }: ContentProps) {
  const intent = (data.intent as StudioIntent) || 'create-agent';
  const suggestedName = (data.agentName as string) || '';
  const suggestedDesc = (data.description as string) || '';
  const suggestedMcpMode = (data.mcpMode as string) || '';

  const assetType = intent.startsWith('create-skill')
    ? 'Skill'
    : intent.startsWith('create-app')
      ? 'App'
      : intent.startsWith('create-mcp')
        ? 'MCP'
        : 'Agent';

  const meta = TYPE_META[assetType];
  const templates =
    assetType === 'Agent'
      ? AGENT_TEMPLATES
      : assetType === 'Skill'
        ? SKILL_TEMPLATES
        : assetType === 'App'
          ? APP_TEMPLATES
          : [];

  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState(suggestedDesc);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [mcpMode, setMcpMode] = useState(suggestedMcpMode);
  const [creating, setCreating] = useState(false);

  const closeDrawer = useOpenClawStore((s) => s.closeDrawer);
  const openAgentManagement = useStudioStore((s) => s.openAgentManagement);
  const enterCreateFlow = useStudioStore((s) => s.enterCreateFlow);
  const setDock = useUIStore((s) => s.setDock);
  const toast = useToastStore((s) => s.addToast);

  /** 创建并跳转到 Studio 全屏编辑 */
  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      toast(`请输入${meta.label}名称`, 'error');
      return;
    }
    if (assetType === 'MCP' && !mcpMode) {
      toast('请选择接入模式', 'error');
      return;
    }

    setCreating(true);

    // 模拟创建延迟
    await new Promise((r) => setTimeout(r, 400));

    const newId = `${assetType.toLowerCase()}-${Date.now()}`;
    toast(`${meta.label}「${name}」已创建`, 'success');

    // 关闭 Drawer → 切换到 Studio → 打开对应详情/管理页
    closeDrawer();

    // 切换 Dock 到 Studio
    setDock('studio');

    // 延迟一帧让 Dock 切换生效后再打开详情
    requestAnimationFrame(() => {
      switch (assetType) {
        case 'Agent':
          openAgentManagement(newId);
          break;
        case 'MCP':
          // 跳转 MCP 创建流程
          enterCreateFlow(`mcp-${mcpMode}` as 'mcp-openapi' | 'mcp-database' | 'mcp-gateway');
          break;
        case 'Skill':
          enterCreateFlow('Skill');
          break;
        case 'App':
          enterCreateFlow('App');
          break;
      }
    });
  }, [
    name,
    assetType,
    mcpMode,
    meta.label,
    closeDrawer,
    setDock,
    openAgentManagement,
    enterCreateFlow,
    toast,
  ]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto hmr-scrollbar">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center">
            <Icon name={meta.icon} size={20} className="text-slate-200" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-slate-100">创建 {meta.label}</h2>
            <p className="text-[11px] text-slate-400">填写基本信息，创建后进入 Studio 全屏编辑</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-5 pb-5 space-y-4">
        {/* 名称 */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1.5 block font-medium">名称 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={meta.placeholder}
            className="w-full h-10 px-3.5 border border-white/[0.1] bg-white/[0.04] rounded-xl text-[13px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors"
            autoFocus
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1.5 block font-medium">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={meta.descPlaceholder}
            rows={3}
            className="w-full px-3.5 py-2.5 border border-white/[0.1] bg-white/[0.04] rounded-xl text-[13px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors resize-none"
          />
        </div>

        {/* MCP 接入模式 */}
        {assetType === 'MCP' && (
          <div>
            <label className="text-[11px] text-slate-400 mb-2 block font-medium">接入模式 *</label>
            <div className="space-y-1.5">
              {MCP_MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMcpMode(m.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    mcpMode === m.key
                      ? 'border-primary/50 bg-primary/[0.06]'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}
                  >
                    <Icon name={m.icon} size={16} className="text-slate-200" />
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-slate-100">{m.label}</div>
                    <div className="text-[10px] text-slate-400">{m.desc}</div>
                  </div>
                  {mcpMode === m.key && (
                    <Icon name="check_circle" size={16} className="text-primary ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agent / Skill / App 模板 */}
        {assetType !== 'MCP' && templates.length > 0 && (
          <div>
            <label className="text-[11px] text-slate-400 mb-2 block font-medium">
              选择模板（可选）
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(selectedTemplate === t.id ? '' : t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedTemplate === t.id
                      ? 'border-primary/50 bg-primary/[0.06]'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t.icon}</span>
                    <div>
                      <div className="text-[11px] font-medium text-slate-100">{t.name}</div>
                      <div className="text-[9px] text-slate-400">{t.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 提交 */}
        <div className="pt-2">
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || (assetType === 'MCP' && !mcpMode)}
            className="w-full h-10 rounded-xl text-[13px] font-semibold bg-primary text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Icon name="rocket_launch" size={16} />
                创建并进入 Studio 编辑
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            创建后将自动跳转到 Studio 全屏编辑环境
          </p>
        </div>
      </div>
    </div>
  );
}
