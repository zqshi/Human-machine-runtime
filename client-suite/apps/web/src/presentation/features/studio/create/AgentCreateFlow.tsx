/**
 * AgentCreateFlow — Agent 完整创建流程
 *
 * Step 1: 基础信息（名称、头像、描述、模板选择）
 * Step 2: → 跳转编排配置三栏页
 */
import { useState } from 'react';
import { useStudioStore } from '../../../../application/stores/studioStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

const TEMPLATES = [
  { id: 'blank', name: '空白 Agent', desc: '完全自定义，从零开始', icon: '✨' },
  { id: 'customer-service', name: '客服助手', desc: '知识库问答 + 工单路由', icon: '🎧' },
  { id: 'data-analyst', name: '数据分析师', desc: 'SQL 生成 + 可视化报表', icon: '📊' },
  { id: 'content-writer', name: '内容创作', desc: '多格式文案/文章/报告', icon: '✍️' },
  { id: 'dev-assistant', name: '开发助手', desc: '代码审查 + Bug 分析 + 技术文档', icon: '💻' },
  { id: 'project-manager', name: '项目管理', desc: '任务跟踪 + 进度报告', icon: '📋' },
  { id: 'knowledge-qa', name: '知识问答', desc: '多文档库精准问答', icon: '📚' },
  { id: 'translator', name: '翻译专家', desc: '多语言互译 + 术语管理', icon: '🌐' },
];

type Step = 'info' | 'template';

export function AgentCreateFlow({ onBack }: Props) {
  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const openAgentManagement = useStudioStore((s) => s.openAgentManagement);
  const toast = useToastStore((s) => s.addToast);

  const handleCreate = () => {
    if (!name.trim()) {
      toast('请输入 Agent 名称', 'error');
      return;
    }
    // TODO: 调用后端创建 Agent 并返回真实 ID
    const newAgentId = `agent-${Date.now()}`;
    toast(`Agent「${name}」已创建，进入编排配置`, 'success');
    openAgentManagement(newAgentId);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto hmr-scrollbar">
      <BackButton onClick={step === 'info' ? onBack : () => setStep('info')} />

      {step === 'info' && (
        <>
          <h2 className="text-[15px] font-bold text-slate-100 mb-1">创建 Agent</h2>
          <p className="text-[12px] text-slate-400 mb-6">设置基本信息，创建后进入编排配置</p>

          <div className="space-y-5 max-w-[480px]">
            {/* Avatar */}
            <div>
              <label className="text-[11px] text-slate-400 mb-2 block">头像</label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-2xl">
                  {avatar}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['🤖', '🧠', '💡', '🎯', '🚀', '📊', '🔧', '🎧'].map((e) => (
                    <button
                      key={e}
                      onClick={() => setAvatar(e)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                        avatar === e
                          ? 'bg-primary/20 ring-1 ring-primary'
                          : 'bg-white/[0.04] hover:bg-white/[0.08]'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">名称 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：智能客服、代码审查助手"
                className="w-full h-10 px-3 border border-white/[0.1] bg-white/[0.04] rounded-xl text-[13px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述 Agent 的职责和能力范围"
                className="w-full h-20 px-3 py-2 border border-white/[0.1] bg-white/[0.04] rounded-xl text-[13px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            <button
              onClick={() => setStep('template')}
              className="h-10 px-6 rounded-xl text-[13px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
            >
              下一步：选择模板
            </button>
          </div>
        </>
      )}

      {step === 'template' && (
        <>
          <h2 className="text-[15px] font-bold text-slate-100 mb-1">选择模板</h2>
          <p className="text-[12px] text-slate-400 mb-6">
            模板预设了 System Prompt 和推荐配置，创建后可自由修改
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTemplate === t.id
                    ? 'border-primary/50 bg-primary/[0.06]'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <div className="text-[13px] font-medium text-slate-100 mt-2">{t.name}</div>
                <div className="text-[11px] text-slate-400 mt-1">{t.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              className="h-10 px-6 rounded-xl text-[13px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
            >
              创建并进入编排
            </button>
            <button
              onClick={() => setStep('info')}
              className="h-10 px-5 rounded-xl text-[13px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06] transition-colors"
            >
              上一步
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="self-start flex items-center gap-1 text-xs text-slate-400 hover:text-primary mb-4 transition-colors"
    >
      <Icon name="arrow_back" size={14} /> 返回
    </button>
  );
}
