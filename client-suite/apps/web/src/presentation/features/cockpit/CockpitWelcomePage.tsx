/**
 * CockpitWelcomePage — Cockpit 欢迎页
 *
 * 三种状态：
 * - 首次访问（isFirstVisit）：数字分身自我介绍卡片
 * - 直接对话共享 Agent：显示该 Agent 信息 + 专属问候
 * - 日常访问：简洁问候 + 快捷指令（详细信息已在右侧面板展示）
 */
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { getCategoryDisplay } from '../../../domain/agent/AgentCategoryConfig';
import { GoalCreationDialog } from './GoalCreationDialog';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

interface WelcomePageProps {
  onStartChat: (text: string) => void;
}

export function CockpitWelcomePage({ onStartChat }: WelcomePageProps) {
  const isFirstVisit = useAgentStore((s) => s.isFirstVisit);
  const primaryAgent = useAgentStore((s) => s.primaryAgent);
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const quickCommands = useCockpitStore((s) => s.quickCommands);
  const activeSharedAgentId = useCockpitStore((s) => s.activeSharedAgentId);
  const goals = useCockpitStore((s) => s.goals);
  const activeGoalId = useCockpitStore((s) => s.activeGoalId);
  const _setActiveGoal = useCockpitStore((s) => s.setActiveGoal);
  const returnToPrimary = useCockpitStore((s) => s.returnToPrimaryAgent);
  const workOrders = useCockpitStore((s) => s.workOrders);
  const setDiscussingWorkOrderId = useCockpitStore((s) => s.setDiscussingWorkOrderId);
  const setDiscussingGoalId = useCockpitStore((s) => s.setDiscussingGoalId);
  const setProfileEditOpen = useUIStore((s) => s.setProfileEditOpen);
  const isSending = useCockpitStore((s) => s.isSending);

  const [showGoalCreation, setShowGoalCreation] = useState(false);

  const pendingWorkOrders = workOrders.filter((wo) => wo.isPending);

  const activeSharedAgent = activeSharedAgentId
    ? sharedAgents.find((a) => a.id === activeSharedAgentId)
    : null;

  const handleStartChat = useCallback(
    (text: string) => {
      if (isFirstVisit) {
        useAgentStore.getState().markVisited();
      }
      onStartChat(text);
    },
    [isFirstVisit, onStartChat]
  );

  const handleEnter = useCallback(() => {
    useAgentStore.getState().markVisited();
  }, []);

  const agentName = primaryAgent?.name ?? '你的数字分身';
  const agentRole = primaryAgent?.role ?? '';
  const agentDept = primaryAgent?.department ?? '';
  const agentPersona = primaryAgent?.persona ?? '';

  // ── First visit: intro card ──
  if (isFirstVisit) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-full">
        <div className="w-full max-w-[560px] mx-auto">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00D4B8] to-[#00A893] flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(0,212,184,0.3)]">
              <Icon name="smart_toy" size={40} className="text-white" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
            <div className="text-center">
              <h1 className="text-lg font-semibold text-slate-100">你好，我是{agentName}</h1>
              <p className="text-sm text-slate-400 mt-1">我已根据你的身份信息自动配置完成</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.04] p-3">
                <p className="text-[10px] text-slate-500 mb-0.5">岗位</p>
                <p className="text-sm text-slate-200">{agentRole || '未设置'}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3">
                <p className="text-[10px] text-slate-500 mb-0.5">部门</p>
                <p className="text-sm text-slate-200">{agentDept || '未设置'}</p>
              </div>
            </div>

            {agentPersona && (
              <div className="rounded-xl bg-white/[0.04] p-3">
                <p className="text-[10px] text-slate-500 mb-0.5">人设</p>
                <p className="text-xs text-slate-300 leading-relaxed">{agentPersona}</p>
              </div>
            )}

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-start gap-2">
                <Icon name="hub" size={16} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  我可以帮你处理日常工作。当涉及代码开发、安全审计、数据分析等专业领域时，
                  会自动从组织能力中心调用对应的专业 Agent，无需你手动管理。
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setProfileEditOpen(true)}
                className="flex-1 h-10 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="edit" size={16} />
                编辑设定
              </button>
              <button
                type="button"
                onClick={handleEnter}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#00D4B8] to-[#00A893] text-sm text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Icon name="chat" size={16} />
                开始对话
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-600 text-center mt-4">
            点击顶部头像或「编辑设定」可随时修改数字分身设定
          </p>
        </div>
      </div>
    );
  }

  // ── Direct chat with shared Agent ──
  if (activeSharedAgent) {
    const catDisplay = getCategoryDisplay(activeSharedAgent.category);
    return (
      <div className="flex items-center justify-center min-h-full px-8 py-6">
        <div className="space-y-6 max-w-[560px] w-full">
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${catDisplay.color}, ${catDisplay.color}cc)`,
              }}
            >
              <Icon name={catDisplay.icon} size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-100">{activeSharedAgent.name}</h1>
              <p className="text-sm text-slate-400 mt-1">{activeSharedAgent.role}</p>
            </div>
          </div>

          {activeSharedAgent.description && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeSharedAgent.description}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={returnToPrimary}
              className="flex-1 h-10 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="arrow_back" size={16} />
              返回主助手
            </button>
            <button
              type="button"
              onClick={() => handleStartChat(`你好，我想咨询${activeSharedAgent.name}相关的问题`)}
              className="flex-1 h-10 rounded-xl text-sm text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(90deg, ${catDisplay.color}, ${catDisplay.color}cc)`,
              }}
            >
              <Icon name="chat" size={16} />
              开始对话
            </button>
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            直接输入你的问题，{activeSharedAgent.name}将为你提供专业帮助
          </p>
        </div>
      </div>
    );
  }

  // ── Daily visit: greeting + quick commands ──
  // Detailed info (insights, activities, chains) is shown in the right panel
  return (
    <div className="flex items-center justify-center min-h-full px-8 py-6">
      <div className="space-y-6 max-w-[560px] w-full">
        {/* Greeting */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D4B8] to-[#00A893] flex items-center justify-center shadow-[0_0_30px_rgba(0,212,184,0.25)]">
            <Icon name="auto_awesome" size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">
              {getGreeting()}，{primaryAgent?.name?.replace(/的数字分身$/, '') || '管理员'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">有什么我可以帮你的？</p>
          </div>
        </div>

        {/* Central input — 进入对话流的轻量入口，发送后底部常驻 composer 出现 */}
        <WelcomeComposer onSend={handleStartChat} disabled={isSending} />

        {/* Quick commands grid */}
        <div className="grid grid-cols-2 gap-2">
          {quickCommands.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => handleStartChat(cmd.desc)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
            >
              <Icon name={cmd.icon} size={18} className="text-primary shrink-0" />
              <span className="text-xs text-slate-200">{cmd.label}</span>
            </button>
          ))}
        </div>

        {/* Active goals */}
        {goals.some((g) => g.status === 'active') ? (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="flag" size={14} className="text-primary" />
              <span className="text-xs font-medium text-slate-400">进行中的目标</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setShowGoalCreation(true)}
                className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
              >
                <Icon name="add" size={12} />
                新建
              </button>
            </div>
            <div className="space-y-2">
              {goals
                .filter((g) => g.status === 'active')
                .map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setDiscussingGoalId(goal.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      goal.id === activeGoalId
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <Icon name="flag" size={16} className="text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {goal.title}
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                          {goal.overallProgress}%
                        </span>
                      </div>
                      {goal.activeMilestone && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="material-symbols-outlined text-primary"
                            style={{ fontSize: 10 }}
                          >
                            radio_button_checked
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {goal.activeMilestone.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowGoalCreation(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="add" size={18} className="text-primary" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-200">创建第一个目标</span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                定义意图、约束和成功标准，Agent 自动拆解执行
              </p>
            </div>
          </button>
        )}

        {/* Pending work orders */}
        {pendingWorkOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="assignment" size={14} className="text-purple-400" />
              <span className="text-xs font-medium text-slate-400">待处理工单</span>
              <span className="text-[9px] text-slate-500">({pendingWorkOrders.length})</span>
            </div>
            <div className="space-y-2">
              {pendingWorkOrders.slice(0, 3).map((wo) => (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => setDiscussingWorkOrderId(wo.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0 animate-pulse" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-200 truncate block">
                      {wo.title}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                      {wo.context}
                    </span>
                  </div>
                  {wo.isHighConfidence && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-400/10 text-green-300 shrink-0">
                      AI 预答
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-600 text-center">任务和洞察信息见右侧面板</p>
      </div>
      <GoalCreationDialog open={showGoalCreation} onClose={() => setShowGoalCreation(false)} />
    </div>
  );
}

/**
 * WelcomeComposer — 欢迎页中央轻量输入框
 *
 * 仅文本 + 发送（无附件/语音/InstanceConversationSelector，那些在对话态底部
 * CockpitComposer）。发送即经 handleStartChat → sendMessage 进入对话流，底部
 * 常驻 composer 随后出现。承接 data-guide="composer" 供引导教程定位。
 */
interface WelcomeComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

function WelcomeComposer({ onSend, disabled }: WelcomeComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      data-guide="composer"
      className="w-full rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-primary/40 transition-colors"
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          resize();
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="输入问题，或选择下方快捷指令…"
        className="w-full min-h-[42px] max-h-[140px] px-4 py-3 text-sm bg-transparent resize-none outline-none text-slate-200 placeholder:text-slate-500"
      />
      <div className="flex justify-end px-2 pb-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  );
}
