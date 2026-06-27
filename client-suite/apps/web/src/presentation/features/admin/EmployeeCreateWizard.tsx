import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  channelApi,
  evalApi,
  skillApi,
  toolApi,
  type ChannelConfig,
  type EvalSuite,
  type ToolDefinition,
} from '../../../application/services/adminApi';
import {
  createOrganizationEmployee,
  type OrganizationEmployeeCreateDraft,
} from '../../../application/use-cases/createOrganizationEmployee';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { DepartmentSelect } from './DepartmentSelect';
import {
  buildDefaultPrompt,
  MODEL_OPTIONS,
  RUNTIME_OPTIONS,
  STEPS,
  type Step,
} from './EmployeeCreateWizard.helpers';
import {
  CapabilityRow,
  EmptyBlock,
  LoadingBlock,
  Summary,
} from './EmployeeCreateWizard.parts';

interface EmployeeCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type SkillOption = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
};

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

const initialDraft: OrganizationEmployeeCreateDraft = {
  basic: {
    name: '',
    description: '',
    department: '',
    departmentId: '',
    ownerId: '',
    channelId: '',
    channelAppId: '',
    channelName: '',
    agentRuntime: 'cockpit',
    modelId: 'gpt-4o',
    systemPrompt: '',
    enableMemory: true,
    memorySearchMode: 'keyword',
  },
  capabilities: {
    toolDefinitionIds: [],
    skillIds: [],
  },
  evaluation: {
    suiteId: '',
    runBaselineAfterCreate: false,
  },
  version: {
    versionName: 'v0.1.0',
    releaseNote: '创建组织数字员工初始版本',
    publishAfterCreate: false,
  },
};

export function EmployeeCreateWizard({ open, onClose, onSuccess }: EmployeeCreateWizardProps) {
  const [step, setStep] = useState<Step>('basic');
  const [draft, setDraft] = useState<OrganizationEmployeeCreateDraft>(initialDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [suitesLoading, setSuitesLoading] = useState(false);
  const [toolsError, setToolsError] = useState('');
  const [channelsError, setChannelsError] = useState('');
  const [skillsError, setSkillsError] = useState('');
  const [suitesError, setSuitesError] = useState('');

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const selectedToolNames = useMemo(
    () => tools.filter((t) => draft.capabilities.toolDefinitionIds.includes(t.id)).map((t) => t.name),
    [draft.capabilities.toolDefinitionIds, tools]
  );
  const selectedSkillNames = useMemo(
    () => skills.filter((s) => draft.capabilities.skillIds.includes(s.id)).map((s) => s.name),
    [draft.capabilities.skillIds, skills]
  );

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    setChannelsError('');
    try {
      const result = await channelApi.list();
      setChannels(result.channels || []);
    } catch (e) {
      setChannels([]);
      setChannelsError((e as Error).message || 'Channel 应用加载失败');
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  const loadTools = useCallback(async () => {
    setToolsLoading(true);
    setToolsError('');
    try {
      const result = await toolApi.listDefinitions();
      setTools(result.definitions.filter((t) => t.enabled));
    } catch (e) {
      setTools([]);
      setToolsError((e as Error).message || '工具列表加载失败');
    } finally {
      setToolsLoading(false);
    }
  }, []);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError('');
    try {
      const result = await skillApi.list({ status: 'active' });
      setSkills(
        result.skills.map((item) => ({
          id: String(item.id || ''),
          name: String(item.name || item.title || item.id || '未命名 Skill'),
          description: item.description ? String(item.description) : undefined,
          category: item.category ? String(item.category) : undefined,
          status: item.status ? String(item.status) : undefined,
        })).filter((item) => item.id)
      );
    } catch (e) {
      setSkills([]);
      setSkillsError((e as Error).message || 'Skill 列表加载失败');
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const loadSuites = useCallback(async () => {
    setSuitesLoading(true);
    setSuitesError('');
    try {
      const result = await evalApi.listSuites();
      setSuites(result.suites.filter((suite) => suite.status !== 'archived'));
    } catch (e) {
      setSuites([]);
      setSuitesError((e as Error).message || '评测集加载失败');
    } finally {
      setSuitesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (step === 'basic') void loadChannels();
    if (step === 'capabilities') {
      void loadTools();
      void loadSkills();
    }
    if (step === 'evaluation') void loadSuites();
  }, [loadChannels, loadSkills, loadSuites, loadTools, open, step]);

  const updateBasic = useCallback(
    <K extends keyof OrganizationEmployeeCreateDraft['basic']>(
      key: K,
      value: OrganizationEmployeeCreateDraft['basic'][K]
    ) => {
      setDraft((prev) => ({ ...prev, basic: { ...prev.basic, [key]: value } }));
    },
    []
  );

  const updateVersion = useCallback(
    <K extends keyof OrganizationEmployeeCreateDraft['version']>(
      key: K,
      value: OrganizationEmployeeCreateDraft['version'][K]
    ) => {
      setDraft((prev) => ({ ...prev, version: { ...prev.version, [key]: value } }));
    },
    []
  );

  const reset = () => {
    setDraft(initialDraft);
    setStep('basic');
    setError('');
    setTools([]);
    setChannels([]);
    setSkills([]);
    setSuites([]);
    setToolsError('');
    setChannelsError('');
    setSkillsError('');
    setSuitesError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canProceed = (): boolean => {
    if (step === 'basic') {
      return draft.basic.name.trim().length > 0 && draft.basic.channelId.trim().length > 0 && draft.basic.systemPrompt.trim().length > 0;
    }
    if (step === 'version') return draft.version.versionName.trim().length > 0;
    return true;
  };

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) setStep(STEPS[currentStepIndex + 1].key);
  };

  const goBack = () => {
    if (currentStepIndex > 0) setStep(STEPS[currentStepIndex - 1].key);
  };

  const generateSystemPrompt = () => {
    if (!draft.basic.name.trim()) {
      useToastStore.getState().addToast('请先填写员工名称', 'info');
      return;
    }
    updateBasic('systemPrompt', buildDefaultPrompt(draft));
    useToastStore.getState().addToast('System Prompt 已生成', 'success');
  };

  const toggleTool = (id: string) => {
    setDraft((prev) => {
      const current = prev.capabilities.toolDefinitionIds;
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      return { ...prev, capabilities: { ...prev.capabilities, toolDefinitionIds: next } };
    });
  };

  const toggleSkill = (id: string) => {
    setDraft((prev) => {
      const current = prev.capabilities.skillIds;
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      return { ...prev, capabilities: { ...prev.capabilities, skillIds: next } };
    });
  };

  const handleSubmit = async () => {
    if (!draft.basic.name.trim()) {
      setError('请输入员工名称');
      return;
    }
    if (!draft.basic.channelId.trim()) {
      setError('请选择要绑定的 Channel 应用');
      return;
    }
    if (!draft.basic.systemPrompt.trim()) {
      setError('请填写或生成 System Prompt');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createOrganizationEmployee(draft);
      reset();
      onSuccess();
      if (result.warnings.length > 0) {
        useToastStore.getState().addToast(
          `创建成功，但有 ${result.warnings.length} 项后续配置未完成`,
          'info'
        );
      } else {
        useToastStore.getState().addToast(
          draft.evaluation.suiteId && draft.evaluation.runBaselineAfterCreate
            ? '组织数字员工创建成功，基线评测已启动，可在评测看板查看运行记录'
            : '组织数字员工创建成功',
          'success'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => {
        const isActive = i === currentStepIndex;
        const isCompleted = i < currentStepIndex;
        return (
          <div key={s.key} className="flex items-center">
            <button
              type="button"
              onClick={() => {
                if (isCompleted) setStep(s.key);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-[#007AFF] text-white font-medium'
                  : isCompleted
                    ? 'bg-[#007AFF]/10 text-[#007AFF] cursor-pointer hover:bg-[#007AFF]/20'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              <Icon name={isCompleted ? 'check' : s.icon} size={14} />
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${isCompleted ? 'bg-[#007AFF]/30' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBasicStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>员工名称 *</label>
          <input
            type="text"
            value={draft.basic.name}
            onChange={(e) => updateBasic('name', e.target.value)}
            placeholder="例：财务数据分析助手"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>归属部门</label>
          <DepartmentSelect
            value={draft.basic.departmentId}
            onChange={(id, name) => {
              updateBasic('departmentId', id);
              updateBasic('department', name || '');
            }}
          />
        </div>
        <div>
          <label className={labelCls}>负责人</label>
          <input
            type="text"
            value={draft.basic.ownerId}
            onChange={(e) => updateBasic('ownerId', e.target.value)}
            placeholder="负责人用户ID，可选"
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>绑定 Channel 应用 *</label>
            <button type="button" onClick={loadChannels} className="text-xs text-[#007AFF] hover:underline">
              刷新应用
            </button>
          </div>
          {channelsLoading ? (
            <LoadingBlock />
          ) : channelsError ? (
            renderLoadError(channelsError, loadChannels)
          ) : channels.length === 0 ? (
            <EmptyBlock icon="radio" title="暂无 Channel 应用" desc="请先在 Channel 管理中新增应用配置" />
          ) : (
            <select
              value={draft.basic.channelId}
              onChange={(e) => {
                const selected = channels.find((channel) => channel.id === e.target.value);
                updateBasic('channelId', selected?.id || '');
                updateBasic('channelAppId', selected?.appId || '');
                updateBasic('channelName', selected?.name || '');
              }}
              className={inputCls}
            >
              <option value="">请选择 Channel 应用</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}（{channel.appId}）{channel.verified ? '' : ' - 未验证'}
                </option>
              ))}
            </select>
          )}
          <div className="text-[11px] text-gray-400 mt-1">
            数字员工会绑定到该应用的 appId / AK / SK 配置，用于后续渠道接入和消息路由。
          </div>
        </div>
        <div>
          <label className={labelCls}>Agent Runtime</label>
          <select
            value={draft.basic.agentRuntime}
            onChange={(e) => updateBasic('agentRuntime', e.target.value as 'cockpit' | 'harness')}
            className={inputCls}
          >
            {RUNTIME_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>默认模型</label>
          <select
            value={draft.basic.modelId}
            onChange={(e) => updateBasic('modelId', e.target.value)}
            className={inputCls}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>描述</label>
          <textarea
            value={draft.basic.description}
            onChange={(e) => updateBasic('description', e.target.value)}
            placeholder="描述该数字员工要解决的问题和服务范围"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>System Prompt *</label>
            <button
              type="button"
              onClick={generateSystemPrompt}
              className="text-xs text-[#007AFF] hover:underline flex items-center gap-1"
            >
              <Icon name="auto_awesome" size={14} />
              根据基础信息生成
            </button>
          </div>
          <textarea
            value={draft.basic.systemPrompt}
            onChange={(e) => updateBasic('systemPrompt', e.target.value)}
            placeholder="定义数字员工的行为方式、能力边界和回复要求"
            rows={8}
            className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
          />
        </div>
        <div className="col-span-2">
          <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white text-sm">
            <span>
              <span className="block font-medium text-gray-700">启用记忆库</span>
              <span className="block text-xs text-gray-400 mt-0.5">为每个用户独立存储记忆，实现千人千面</span>
            </span>
            <input
              type="checkbox"
              checked={draft.basic.enableMemory}
              onChange={(e) => updateBasic('enableMemory', e.target.checked)}
              className="rounded border-gray-300"
            />
          </label>
          {draft.basic.enableMemory && (
            <div className="mt-2">
              <label className={labelCls}>检索模式</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'keyword', label: '关键词检索', desc: '模糊匹配，无需外部服务' },
                  { value: 'vector', label: '向量语义检索', desc: 'WeKnora 语义搜索，需配置向量服务' },
                  { value: 'hybrid', label: '混合检索', desc: '关键词 + 向量语义搜索，双通道加权' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateBasic('memorySearchMode', opt.value)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                      draft.basic.memorySearchMode === opt.value
                        ? 'border-[#007AFF] bg-[#007AFF]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-700">{opt.label}</div>
                      <div className="text-[11px] text-gray-400">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLoadError = (message: string, retry: () => void) => (
    <div className="text-sm text-red-600 py-5 text-center border border-dashed border-red-200 rounded-lg bg-red-50">
      <Icon name="error" size={22} className="mx-auto mb-2" />
      <div>{message}</div>
      <button type="button" onClick={retry} className="mt-2 text-xs text-[#007AFF] hover:underline">
        重试
      </button>
    </div>
  );

  const renderCapabilitiesStep = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>选择真实工具和 Skill。加载失败时不使用本地假数据。</span>
        <span>已选 {draft.capabilities.toolDefinitionIds.length} 工具 / {draft.capabilities.skillIds.length} Skill</span>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800">工具 Tools</h4>
          <button type="button" onClick={loadTools} className="text-xs text-[#007AFF] hover:underline">刷新</button>
        </div>
        {toolsLoading ? (
          <LoadingBlock />
        ) : toolsError ? (
          renderLoadError(toolsError, loadTools)
        ) : tools.length === 0 ? (
          <EmptyBlock icon="build" title="暂无可用工具" desc="请先在工具管理中配置并启用工具定义" />
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {tools.map((tool) => (
              <CapabilityRow
                key={tool.id}
                selected={draft.capabilities.toolDefinitionIds.includes(tool.id)}
                title={tool.name}
                desc={tool.description || tool.summary || '无描述'}
                meta={tool.executionType === 'sync' ? '同步' : '异步'}
                onClick={() => toggleTool(tool.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800">Skill</h4>
          <button type="button" onClick={loadSkills} className="text-xs text-[#007AFF] hover:underline">刷新</button>
        </div>
        {skillsLoading ? (
          <LoadingBlock />
        ) : skillsError ? (
          renderLoadError(skillsError, loadSkills)
        ) : skills.length === 0 ? (
          <EmptyBlock icon="extension" title="暂无可用 Skill" desc="请先在技能管理中创建或导入 Skill" />
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {skills.map((skill) => (
              <CapabilityRow
                key={skill.id}
                selected={draft.capabilities.skillIds.includes(skill.id)}
                title={skill.name}
                desc={skill.description || '无描述'}
                meta={skill.category || skill.status || 'skill'}
                onClick={() => toggleSkill(skill.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderEvaluationStep = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-500">
        评测配置是可选项。选择评测集后，可以在创建完成时立即启动一次基线评测。
      </div>
      {suitesLoading ? (
        <LoadingBlock />
      ) : suitesError ? (
        renderLoadError(suitesError, loadSuites)
      ) : suites.length === 0 ? (
        <EmptyBlock icon="fact_check" title="暂无评测集" desc="请先在评测基准模块创建评测集" />
      ) : (
        <div>
          <label className={labelCls}>评测集</label>
          <select
            value={draft.evaluation.suiteId}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                evaluation: { ...prev.evaluation, suiteId: e.target.value },
              }))
            }
            className={inputCls}
          >
            <option value="">暂不绑定评测集</option>
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}（{suite.totalCases} 用例）
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white text-sm">
        <span>
          <span className="block font-medium text-gray-700">创建后立即运行基线评测</span>
          <span className="block text-xs text-gray-400 mt-0.5">需要先选择评测集</span>
        </span>
        <input
          type="checkbox"
          checked={draft.evaluation.runBaselineAfterCreate}
          disabled={!draft.evaluation.suiteId}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              evaluation: { ...prev.evaluation, runBaselineAfterCreate: e.target.checked },
            }))
          }
          className="rounded border-gray-300"
        />
      </label>
    </div>
  );

  const renderVersionStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>初始版本号 *</label>
          <input
            type="text"
            value={draft.version.versionName}
            onChange={(e) => updateVersion('versionName', e.target.value)}
            placeholder="v0.1.0"
            className={inputCls}
          />
        </div>
        <label className="flex items-end gap-2 text-sm text-gray-600 pb-2">
          <input
            type="checkbox"
            checked={draft.version.publishAfterCreate}
            onChange={(e) => updateVersion('publishAfterCreate', e.target.checked)}
            className="rounded border-gray-300"
          />
          创建后立即发布
        </label>
        <div className="col-span-2">
          <label className={labelCls}>版本说明</label>
          <textarea
            value={draft.version.releaseNote}
            onChange={(e) => updateVersion('releaseNote', e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>
      <div className="space-y-3">
        <Summary title="基础信息" items={[draft.basic.name || '-', draft.basic.department || '未指定部门', draft.basic.channelName || '未绑定应用', draft.basic.modelId]} />
        <Summary title="能力配置" items={[`${selectedToolNames.length} 个工具`, `${selectedSkillNames.length} 个 Skill`]} />
        <Summary
          title="评测与版本"
          items={[
            suites.find((s) => s.id === draft.evaluation.suiteId)?.name || '未绑定评测集',
            draft.evaluation.runBaselineAfterCreate ? '创建后运行基线评测' : '不自动运行评测',
            draft.version.publishAfterCreate ? '立即发布' : '保存草稿版本',
          ]}
        />
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (step === 'basic') return renderBasicStep();
    if (step === 'capabilities') return renderCapabilitiesStep();
    if (step === 'evaluation') return renderEvaluationStep();
    return renderVersionStep();
  };

  return (
    <Modal open={open} onClose={handleClose} title="创建组织数字员工" width="max-w-2xl">
      <div className="flex flex-col h-full max-h-[80vh]">
        {renderStepIndicator()}
        <div className="flex-1 overflow-y-auto pr-1 min-h-0">{renderStepContent()}</div>
        {error && <div className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        <div className="flex justify-between items-center pt-4 mt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            上一步
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            {currentStepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceed()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                下一步
                <Icon name="chevron_right" size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !canProceed()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loading ? '创建中...' : '创建初始版本'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
