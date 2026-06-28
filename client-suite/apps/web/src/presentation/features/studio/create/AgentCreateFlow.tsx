/**
 * AgentCreateFlow — Agent 声明式创建向导(v1.9)
 *
 * 7 步声明完整 AgentDefinitionSpec,落库 agent_definitions CRD,实例可关联。
 *   Step1 基础(名称/头像/描述) | Step2 人设(systemPrompt+guardrails+refusalResponse)
 *   Step3 模型(primaryModel/fallbackModels/maxConcurrency) | Step4 技能(boundSkills)
 *   Step5 知识(boundKnowledge) | Step6 工具(boundTools) | Step7 运行时(runtimeType+sandboxTemplate)
 *
 * 提交:agentDefinitionApi.create/update → openAgentManagement(def.id)。
 * 编辑模式(传 definitionId+initial):走 update,后端 updateSpec 内部 generation+1(bumpGeneration)。
 * 未编辑字段(resourceLimits/workspaceStrategy)用 defaultAgentDefinitionSpec 默认。
 */
import { useRef, useState } from 'react';
import { useStudioStore } from '../../../../application/stores/studioStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { useUIStore } from '../../../../application/stores/uiStore';
import { useAuthStore } from '../../../../application/stores/authStore';
import { sharedAgentChatService } from '../../../../application/services/sharedAgentChatService';
import {
  GUARDRAIL_ACTIONS,
  GUARDRAIL_TYPES,
  RUNTIME_TYPES,
  RUNTIME_TYPE_LABELS,
  SANDBOX_TEMPLATES,
  SANDBOX_TEMPLATE_LABELS,
  type AgentDefinitionSpec,
  type AgentRuntimeType,
  type GuardrailAction,
  type GuardrailRule,
  type GuardrailType,
  runtimeManifestApi,
} from '../../../../application/services/adminApi';
import {
  buildAgentDefinitionSpec,
  createOrUpdateAgentDefinition,
  instantiateAgentDefinition,
} from '../../../../application/use-cases/agentDefinitionUseCase';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
  /** 编辑模式:传入已有定义 id + 初始 spec,提交走 update(bumpGeneration) */
  definitionId?: string;
  initial?: { name: string; description: string; spec: AgentDefinitionSpec };
}

const AVATARS = ['🤖', '🧠', '💡', '🎯', '🚀', '📊', '🔧', '🎧'];
const MODEL_SUGGESTIONS = ['auto', 'claude-sonnet-4', 'deepseek-v3', 'qwen3-235b'];
const STEPS = ['基础', '人设', '模型', '技能', '知识', '工具', '运行时'] as const;

/** guardrail id 递增序列(模块级,避免删后 id 重复) */
let guardrailIdSeq = 0;

export function AgentCreateFlow({ onBack, definitionId, initial }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [avatar, setAvatar] = useState('🤖');

  const [systemPrompt, setSystemPrompt] = useState(initial?.spec.persona.systemPrompt ?? '');
  const [refusalResponse, setRefusalResponse] = useState(
    initial?.spec.persona.refusalResponse ?? ''
  );
  const [guardrails, setGuardrails] = useState<GuardrailRule[]>(
    initial?.spec.persona.guardrails ?? []
  );

  const [primaryModel, setPrimaryModel] = useState(
    initial?.spec.modelConfig.primaryModel ?? 'auto'
  );
  const [fallbackModels, setFallbackModels] = useState<string[]>(
    initial?.spec.modelConfig.fallbackModels ?? []
  );
  const [maxConcurrency, setMaxConcurrency] = useState(
    initial?.spec.modelConfig.maxConcurrency ?? 5
  );

  const [boundSkills, setBoundSkills] = useState<string[]>(initial?.spec.boundSkills ?? []);
  const [boundKnowledge, setBoundKnowledge] = useState<string[]>(
    initial?.spec.boundKnowledge ?? []
  );
  const [boundTools, setBoundTools] = useState<string[]>(initial?.spec.boundTools ?? []);

  const [runtimeType, setRuntimeType] = useState<AgentRuntimeType>(
    initial?.spec.runtime.runtimeType ?? 'claude'
  );
  const [sandboxTemplate, setSandboxTemplate] = useState<string>(
    initial?.spec.sandboxTemplate ?? 'basic'
  );

  const [submitting, setSubmitting] = useState(false);
  const toast = useToastStore((s) => s.addToast);
  const openAgentManagement = useStudioStore((s) => s.openAgentManagement);
  const exitCreateFlow = useStudioStore((s) => s.exitCreateFlow);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const next = () => {
    if (step === 1 && !name.trim()) {
      toast('请输入 Agent 名称', 'error');
      nameInputRef.current?.focus();
      return;
    }
    setStep((s) => Math.min(7, s + 1));
  };
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast('请输入 Agent 名称', 'error');
      setStep(1);
      return;
    }
    const tenantId = useAuthStore.getState().hmrUser?.tenantId;
    if (!definitionId && !tenantId) {
      toast('未获取到租户信息,请重新登录后重试', 'error');
      return;
    }
    const spec = buildAgentDefinitionSpec({
      sandboxTemplate,
      primaryModel,
      fallbackModels,
      maxConcurrency,
      systemPrompt,
      guardrails,
      refusalResponse,
      boundSkills,
      boundKnowledge,
      boundTools,
      runtimeType,
    });
    setSubmitting(true);
    try {
      const def = await createOrUpdateAgentDefinition({
        definitionId,
        tenantId,
        name: name.trim(),
        description: description.trim(),
        spec,
      });
      exitCreateFlow();

      // v2.0 C14:发布即固化。创建/更新成功后自动触发 bake(同步固化 manifest),
      // 运行时 harness 读 manifest 不再动态查 DB。固化失败不阻断创建(Agent 已落库,可在编译固化面板重试)。
      runtimeManifestApi
        .bake(def.id)
        .then((r) => {
          if (r.status === 'baked') {
            toast(`「${def.name}」编译固化成功(gen ${def.generation} 已锁定)`, 'success');
          } else {
            toast(
              `「${def.name}」编译固化失败: ${r.errorMsg ?? '未知错误'},可在「编译固化」面板重试`,
              'error'
            );
          }
        })
        .catch((be) =>
          toast(`编译固化未触发: ${(be as Error).message},可在「编译固化」面板重试`, 'error')
        );

      if (definitionId) {
        // 更新模式:已有 instance 关联,跳管理页(不重建 instance)
        toast(`更新 Agent「${def.name}」成功(generation ${def.generation})`, 'success');
        openAgentManagement(def.id);
      } else {
        // D10:新建→实例化对话 instance + 同步默认 key + 跳对话页
        // (管理后台新建Agent→页面可对话;复用 marketplace 安装即对话的 openInstalledInstance 接线)
        toast(`已创建 Agent「${def.name}」,正在打开对话...`, 'success');
        try {
          const inst = await instantiateAgentDefinition(def.id);
          sharedAgentChatService.openInstalledInstance(inst.instanceId, inst.name);
          useUIStore.getState().setDock('messages');
          toast(`已创建「${inst.name}」并打开对话`, 'success');
        } catch (ie) {
          // 实例化/打开对话失败→降级跳管理页,不阻断创建成功(Agent 已落库)
          openAgentManagement(def.id);
          toast(`Agent「${def.name}」已创建,打开对话失败: ${(ie as Error).message}`, 'error');
        }
      }
    } catch (e) {
      toast(`Agent ${definitionId ? '更新' : '创建'}失败: ${(e as Error).message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto hmr-scrollbar">
      <BackButton onClick={onBack} />

      <h2 className="text-[15px] font-bold text-slate-100 mb-1">
        {definitionId ? '编辑 Agent 定义' : '创建 Agent'}
      </h2>
      <p className="text-[12px] text-slate-400 mb-5">
        声明式定义 Agent 的人设、模型、技能、知识、工具与运行时,落库后实例可关联消费
      </p>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-1.5 mb-6 max-w-[640px]">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <button
                onClick={() => n <= step && setStep(n)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                  active
                    ? 'bg-primary/20 text-primary'
                    : done
                      ? 'text-slate-300 hover:bg-white/[0.06]'
                      : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                    active
                      ? 'bg-primary text-white'
                      : done
                        ? 'bg-slate-600 text-white'
                        : 'bg-white/[0.08]'
                  }`}
                >
                  {done ? '✓' : n}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && <span className="text-slate-600 text-[10px]">→</span>}
            </div>
          );
        })}
      </div>

      <div className="max-w-[640px] flex-1">
        {step === 1 && (
          <StepContainer title="基础信息" desc="设置 Agent 的身份标识">
            <Field label="头像">
              <div className="flex flex-wrap gap-1.5">
                {AVATARS.map((e) => (
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
            </Field>
            <Field label="名称 *">
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：智能客服、代码审查助手"
                className={inputCls}
              />
            </Field>
            <Field label="描述">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述 Agent 的职责和能力范围"
                className={`${inputCls} h-20 resize-none`}
              />
            </Field>
          </StepContainer>
        )}

        {step === 2 && (
          <StepContainer
            title="人设与拒答边界"
            desc="systemPrompt 软约束注入 + guardrails 硬约束拦截(#1)"
          >
            <Field label="System Prompt(人设/角色/能力边界)">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="你是一名资深前端工程师,只回答前端开发相关问题,拒绝讨论与工作无关内容..."
                className={`${inputCls} h-28 resize-none font-mono text-[12px]`}
              />
            </Field>
            <Field label="拒答规则(guardrails)">
              <GuardrailEditor guardrails={guardrails} onChange={setGuardrails} />
            </Field>
            <Field label="命中拒答时的回复话术(refusalResponse)">
              <input
                value={refusalResponse}
                onChange={(e) => setRefusalResponse(e.target.value)}
                placeholder="抱歉,这超出了我的职责范围,无法协助。"
                className={inputCls}
              />
            </Field>
          </StepContainer>
        )}

        {step === 3 && (
          <StepContainer title="模型配置" desc="主模型 + 降级模型 + 并发上限">
            <Field label="主模型(primaryModel)">
              <input
                value={primaryModel}
                onChange={(e) => setPrimaryModel(e.target.value)}
                placeholder="auto"
                list="model-suggestions"
                className={inputCls}
              />
              <datalist id="model-suggestions">
                {MODEL_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="降级模型(fallbackModels)">
              <TagsInput
                value={fallbackModels}
                onChange={setFallbackModels}
                placeholder="输入模型 id 回车添加"
              />
            </Field>
            <Field label="并发上限(maxConcurrency,1-100)">
              <input
                type="number"
                min={1}
                max={100}
                value={maxConcurrency}
                onChange={(e) =>
                  setMaxConcurrency(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                }
                className={`${inputCls} w-32`}
              />
            </Field>
          </StepContainer>
        )}

        {step === 4 && (
          <StepContainer title="绑定技能" desc="Agent 可调用的技能 id 列表(boundSkills,组装层消费)">
            <TagsInput
              value={boundSkills}
              onChange={setBoundSkills}
              placeholder="输入技能 id 回车添加"
            />
          </StepContainer>
        )}

        {step === 5 && (
          <StepContainer title="绑定知识库" desc="RAG 召回范围约束(boundKnowledge,空=不限)">
            <TagsInput
              value={boundKnowledge}
              onChange={setBoundKnowledge}
              placeholder="输入知识库 id 回车添加"
            />
          </StepContainer>
        )}

        {step === 6 && (
          <StepContainer
            title="绑定工具"
            desc="Agent 可调用的工具 id 列表(boundTools,执行审批按 riskLevel)"
          >
            <TagsInput
              value={boundTools}
              onChange={setBoundTools}
              placeholder="输入工具 id 回车添加"
            />
          </StepContainer>
        )}

        {step === 7 && (
          <StepContainer
            title="运行时与沙箱"
            desc="声明运行时类型(治本 D8)+沙箱模板(docker-runner 消费)"
          >
            <Field label="运行时类型(runtimeType)">
              <div className="grid grid-cols-1 gap-2">
                {RUNTIME_TYPES.map((rt) => (
                  <button
                    key={rt}
                    onClick={() => setRuntimeType(rt)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      runtimeType === rt
                        ? 'border-primary/50 bg-primary/[0.06]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-[13px] font-medium text-slate-100">
                      {RUNTIME_TYPE_LABELS[rt]}
                    </div>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="沙箱模板(sandboxTemplate)">
              <div className="grid grid-cols-1 gap-2">
                {SANDBOX_TEMPLATES.map((st) => (
                  <button
                    key={st}
                    onClick={() => setSandboxTemplate(st)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sandboxTemplate === st
                        ? 'border-primary/50 bg-primary/[0.06]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-[12px] font-medium text-slate-100">{st}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {SANDBOX_TEMPLATE_LABELS[st]}
                    </div>
                  </button>
                ))}
              </div>
            </Field>
          </StepContainer>
        )}
      </div>

      {/* 导航 */}
      <div className="flex items-center gap-3 mt-6 max-w-[640px]">
        {step > 1 && (
          <button
            onClick={prev}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06] transition-colors"
          >
            上一步
          </button>
        )}
        {step < 7 ? (
          <button
            onClick={next}
            className="h-10 px-6 rounded-xl text-[13px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
          >
            下一步
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-10 px-6 rounded-xl text-[13px] font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? '提交中...' : definitionId ? '保存更新' : '创建 Agent'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 内部组件 ---------- */

const inputCls =
  'w-full h-10 px-3 border border-white/[0.1] bg-white/[0.04] rounded-xl text-[13px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors';

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

function StepContainer({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-100">{title}</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

/** 标签输入:回车/按钮添加,chip 可删。boundSkills/boundKnowledge/boundTools/fallbackModels 共用 */
function TagsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputCls}
        />
        <button
          onClick={add}
          className="h-10 px-4 rounded-xl text-[13px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
        >
          添加
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/[0.08] border border-primary/20 text-[12px] text-slate-200"
            >
              {t}
              <button
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="text-slate-400 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Guardrail 规则编辑器:可增删行,type/pattern/action/reason */
function GuardrailEditor({
  guardrails,
  onChange,
}: {
  guardrails: GuardrailRule[];
  onChange: (v: GuardrailRule[]) => void;
}) {
  const addRule = () =>
    onChange([
      ...guardrails,
      { id: `g-${++guardrailIdSeq}`, type: 'keyword', pattern: '', action: 'block', reason: '' },
    ]);
  const update = (id: string, patch: Partial<GuardrailRule>) =>
    onChange(guardrails.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id: string) => onChange(guardrails.filter((g) => g.id !== id));

  return (
    <div className="space-y-2">
      {guardrails.map((g) => (
        <div
          key={g.id}
          className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]"
        >
          <select
            value={g.type}
            onChange={(e) => update(g.id, { type: e.target.value as GuardrailType })}
            className="h-9 px-2 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] text-slate-200 outline-none focus:border-primary/50"
          >
            {GUARDRAIL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={g.pattern}
            onChange={(e) => update(g.id, { pattern: e.target.value })}
            placeholder="匹配模式(关键词/正则/意图描述)"
            className="flex-1 h-9 px-2 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50"
          />
          <select
            value={g.action}
            onChange={(e) => update(g.id, { action: e.target.value as GuardrailAction })}
            className="h-9 px-2 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] text-slate-200 outline-none focus:border-primary/50"
          >
            {GUARDRAIL_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            value={g.reason}
            onChange={(e) => update(g.id, { reason: e.target.value })}
            placeholder="拒答原因"
            className="w-32 h-9 px-2 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50"
          />
          <button
            onClick={() => remove(g.id)}
            className="h-9 w-9 shrink-0 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addRule}
        className="h-9 px-4 rounded-lg text-[12px] font-medium border border-dashed border-white/[0.15] text-slate-400 hover:text-primary hover:border-primary/40 transition-colors"
      >
        + 添加拒答规则
      </button>
    </div>
  );
}
