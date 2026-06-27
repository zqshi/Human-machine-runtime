import { useMemo, useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { employeeDetailApi, evalApi, type Employee, type AgentRuntime, type EvalSuite } from '../../../application/services/adminApi';
import type { InstanceScope } from '../../../domain/shared/types';

interface VersionRecord {
  version: string;
  status: string;
  date: string;
  changes: string;
  createdAt?: string;
  releaseNote?: string;
}

interface Props {
  open: boolean;
  employeeId: string | null;
  employees: Employee[];
  onClose: () => void;
  onSave: () => void;
}

type Tab = 'basic' | 'capabilities' | 'evaluation' | 'version';

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
];

const RUNTIME_OPTIONS: { value: AgentRuntime; label: string }[] = [
  { value: 'cockpit', label: 'Cockpit' },
  { value: 'harness', label: 'Harness' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'active（运行中）' },
  { value: 'paused', label: 'paused（暂停）' },
  { value: 'inactive', label: 'inactive（停用）' },
];

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'basic', label: '基础信息', icon: 'info' },
  { key: 'capabilities', label: '能力配置', icon: 'extension' },
  { key: 'evaluation', label: '评测配置', icon: 'fact_check' },
  { key: 'version', label: '版本管理', icon: 'new_releases' },
];

function buildDefaultPrompt(input: {
  name?: string;
  department?: string;
  description?: string;
  modelId?: string;
  agentRuntime?: string;
}) {
  const name = input.name || '未命名数字员工';
  return [
    `你是组织级数字员工「${name}」。`,
    input.department ? `你归属于「${input.department}」部门。` : '你服务于组织内的通用业务场景。',
    `你的运行类型是 ${input.agentRuntime || 'cockpit'}，默认模型是 ${input.modelId || 'gpt-4o'}。`,
    '',
    '你的工作目标：',
    input.description || '根据组织授权，为员工提供准确、稳定、可追踪的任务处理和信息支持。',
    '',
    '行为要求：',
    '1. 优先基于已配置的工具、Skill 和评测标准完成任务。',
    '2. 遇到缺少权限、缺少上下文或高不确定性的请求时，明确说明限制，不编造结果。',
    '3. 对关键操作保持可审计表达，必要时提示用户确认。',
    '4. 回复应专业、简洁，并说明下一步建议。',
  ].join('\n');
}

function valueToString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function toTagItems(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export function EmployeeEditDrawer({ open, employeeId, employees, onClose, onSave }: Props) {
  const [tab, setTab] = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const derived = useMemo(() => {
    if (!open || !employeeId) return null;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return null;
    const d = emp as Record<string, unknown>;
    const runtime = (d.runtimeProfile || d.runtime || {}) as Record<string, unknown>;
    return {
      readonlyMeta: {
        id: valueToString(d.id),
        tenantId: valueToString(d.tenantId),
        matrixRoomId: valueToString(d.matrixRoomId),
        channelName: valueToString(d.channelName || d.channelAppId || d.channelId),
      },
      basic: {
        name: valueToString(d.displayName || d.name),
        department: valueToString(d.department),
        ownerId: valueToString(d.ownerId || d.enterpriseUserId),
        description: valueToString(d.description || d.personality),
        agentRuntime: (d.agentRuntime === 'harness' ? 'harness' : 'cockpit') as AgentRuntime,
        modelId: valueToString(d.model || runtime.modelId || 'gpt-4o'),
        status: valueToString(d.status || 'active'),
        scope: (d.scope === 'personal' ? 'personal' : 'organization') as InstanceScope,
        systemPrompt: valueToString(runtime.systemPrompt || d.runtimeSystemPrompt),
      },
      capabilities: {
        tools: toTagItems(Array.isArray(runtime.toolScope) ? runtime.toolScope : d.linkedToolIds),
        skills: toTagItems(d.linkedSkillIds || d.skills),
      },
      evaluation: {
        suiteId: valueToString(d.evalSuiteId),
        suiteName: valueToString(d.evalSuiteName || d.evalSuiteId),
        runBaselineAfterCreate: Boolean(d.runBaselineAfterCreate),
      },
      version: {
        versionName: valueToString(d.versionName || d.currentVersion || d.version),
        releaseNote: valueToString(d.releaseNote),
        publishAfterCreate: Boolean(d.publishAfterCreate),
        versions: Array.isArray(d.versions)
          ? (d.versions as VersionRecord[]).map((v) => ({
              version: valueToString(v.version),
              status: valueToString(v.status || 'draft'),
              date: valueToString(v.date || v.createdAt),
              changes: valueToString(v.changes || v.releaseNote),
            }))
          : [],
      },
    };
  }, [open, employeeId, employees]);

  const [readonlyMeta, setReadonlyMeta] = useState({
    id: '',
    tenantId: '',
    matrixRoomId: '',
    channelName: '',
  });
  const [basic, setBasic] = useState({
    name: '',
    department: '',
    ownerId: '',
    description: '',
    agentRuntime: 'cockpit' as AgentRuntime,
    modelId: 'gpt-4o',
    status: 'active',
    scope: 'organization' as InstanceScope,
    systemPrompt: '',
  });
  const [capabilities, setCapabilities] = useState({ tools: [] as string[], skills: [] as string[] });
  const [evaluation, setEvaluation] = useState({ suiteId: '', suiteName: '', runBaselineAfterCreate: false });
  const [version, setVersion] = useState({
    versionName: '',
    releaseNote: '',
    publishAfterCreate: false,
    versions: [] as VersionRecord[],
  });
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [newVersionNum, setNewVersionNum] = useState('');
  const [newVersionNote, setNewVersionNote] = useState('');

  const [prevKey, setPrevKey] = useState({ open, employeeId });
  if (open !== prevKey.open || employeeId !== prevKey.employeeId) {
    setPrevKey({ open, employeeId });
    if (derived) {
      setReadonlyMeta(derived.readonlyMeta);
      setBasic(derived.basic);
      setCapabilities(derived.capabilities);
      setEvaluation(derived.evaluation);
      setVersion(derived.version);
    }
    setTab('basic');
    setStatusMsg(null);
    setNewVersionNum('');
    setNewVersionNote('');
  }

  useEffect(() => {
    if (open) {
      evalApi.listSuites().then((res) => setSuites(res.suites)).catch(() => {});
    }
  }, [open]);

  // 打开抽屉时拉取完整详情（列表 API 不含 profile/versions）
  useEffect(() => {
    if (!open || !employeeId) return;
    employeeDetailApi
      .getDetail(employeeId)
      .then((detail) => {
        const d = detail as Record<string, unknown>;
        const profile = (d.profile || {}) as Record<string, unknown>;
        const settings = (profile.settings || {}) as Record<string, unknown>;
        const runtimeProfile = (settings.runtimeProfile || d.runtimeProfile || d.runtime || {}) as Record<string, unknown>;

        // versions 嵌套在 profile.settings.versions
        const rawVersions = Array.isArray(settings.versions)
          ? settings.versions
          : Array.isArray(d.versions)
            ? d.versions
            : [];
        const parsedVersions: VersionRecord[] = (rawVersions as Record<string, unknown>[]).map((v) => ({
          version: valueToString(v.version),
          status: valueToString(v.status || 'draft'),
          date: valueToString(v.date || v.createdAt),
          changes: valueToString(v.changes || v.releaseNote),
        }));

        const evalConfig = (settings.evaluationConfig || {}) as Record<string, unknown>;
        const channelBinding = (settings.channelBinding || {}) as Record<string, unknown>;

        setReadonlyMeta({
          id: valueToString(d.id),
          tenantId: valueToString(d.tenantId),
          matrixRoomId: valueToString(d.matrixRoomId),
          channelName: valueToString(channelBinding.name || d.channelName || d.channelAppId || d.channelId),
        });
        setBasic((prev) => ({
          ...prev,
          name: valueToString(profile.displayName || d.name || prev.name),
          department: valueToString(d.department || prev.department),
          ownerId: valueToString(d.ownerId || d.enterpriseUserId || prev.ownerId),
          description: valueToString(profile.knowMe || d.description || prev.description),
          agentRuntime: (d.jobTitle === 'harness' || runtimeProfile.agentRuntime === 'harness') ? 'harness' : 'cockpit',
          modelId: valueToString(runtimeProfile.modelId || d.model || prev.modelId),
          status: valueToString(d.state || d.status || prev.status),
          scope: (settings.scope === 'personal' ? 'personal' : 'organization') as InstanceScope,
          systemPrompt: valueToString(runtimeProfile.systemPrompt || prev.systemPrompt),
        }));
        setCapabilities({
          tools: toTagItems(Array.isArray(settings.capabilities) ? settings.capabilities : (runtimeProfile.toolScope || d.linkedToolIds)),
          skills: toTagItems(settings.linkedSkillIds || d.linkedSkillIds || d.skills),
        });
        setEvaluation({
          suiteId: valueToString(evalConfig.suiteId || d.evalSuiteId),
          suiteName: valueToString(d.evalSuiteName || evalConfig.suiteId || d.evalSuiteId),
          runBaselineAfterCreate: Boolean(evalConfig.runBaselineAfterCreate || d.runBaselineAfterCreate),
        });
        setVersion({
          versionName: valueToString(d.versionName || d.currentVersion || d.version || (parsedVersions.length > 0 ? parsedVersions[parsedVersions.length - 1].version : '')),
          releaseNote: valueToString(d.releaseNote),
          publishAfterCreate: parsedVersions.some((v) => v.status === 'published'),
          versions: parsedVersions,
        });
      })
      .catch(() => {
        // 详情拉取失败时保持列表基础数据
      });
  }, [open, employeeId]);

  const generateSystemPrompt = () => {
    setBasic((prev) => ({ ...prev, systemPrompt: buildDefaultPrompt(prev) }));
    setStatusMsg({ text: 'System Prompt 已根据基础信息生成，请检查后保存。', ok: true });
  };

  const saveEmployee = async () => {
    if (!employeeId) return;
    if (!basic.name.trim()) {
      setStatusMsg({ text: '请输入员工名称。', ok: false });
      return;
    }
    if (!basic.systemPrompt.trim()) {
      setStatusMsg({ text: '请填写或生成 System Prompt。', ok: false });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      const updatePayload: Record<string, unknown> = {
        name: basic.name,
        department: basic.department,
        ownerId: basic.ownerId,
        description: basic.description,
        status: basic.status,
        scope: basic.scope,
        agentRuntime: basic.agentRuntime,
        model: basic.modelId,
        runtimeProfile: { systemPrompt: basic.systemPrompt },
        evaluationConfig: {
          suiteId: evaluation.suiteId || null,
          runBaselineAfterCreate: evaluation.runBaselineAfterCreate,
        },
      };

      // Append new version to history if user entered one
      if (newVersionNum.trim()) {
        const newVer: VersionRecord = {
          version: newVersionNum.trim(),
          status: 'draft',
          date: new Date().toISOString(),
          changes: newVersionNote.trim() || '无变更说明',
        };
        updatePayload.versions = [...version.versions, newVer];
      }

      await employeeDetailApi.updateProfile(employeeId, updatePayload);
      const msg = newVersionNum.trim()
        ? `数字员工保存成功，新版本 ${newVersionNum.trim()} 已创建：${new Date().toLocaleString()}`
        : `数字员工保存成功：${new Date().toLocaleString()}`;
      setStatusMsg({ text: msg, ok: true });
      onSave();
    } catch (e) {
      setStatusMsg({ text: `保存失败：${(e as Error).message}`, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const publishVersion = async (versionIndex: number) => {
    if (!employeeId) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const updatedVersions = version.versions.map((v, i) =>
        i === versionIndex ? { ...v, status: 'published' } : v
      );
      await employeeDetailApi.updateProfile(employeeId, { versions: updatedVersions });
      setVersion((prev) => ({ ...prev, versions: updatedVersions }));
      setStatusMsg({
        text: `版本 ${version.versions[versionIndex].version} 已发布`,
        ok: true,
      });
      onSave();
    } catch (e) {
      setStatusMsg({ text: `发布失败：${(e as Error).message}`, ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="编辑数字员工" width="w-[560px]">
      <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 mb-2">固定信息（只读）</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <ReadonlyMeta label="实例ID" value={readonlyMeta.id} mono />
          <ReadonlyMeta label="租户" value={readonlyMeta.tenantId} />
          <ReadonlyMeta label="绑定 Channel 应用" value={readonlyMeta.channelName} />
          <ReadonlyMeta label="固定会话ID" value={readonlyMeta.matrixRoomId} mono />
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-100 pb-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              tab === item.key ? 'bg-[#007AFF] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {statusMsg && (
        <div
          className={`mb-3 text-xs px-3 py-2 rounded-lg ${statusMsg.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}
        >
          {statusMsg.text}
        </div>
      )}

      {tab === 'basic' && (
        <div className="space-y-3">
          <LabelInput
            label="员工名称 *"
            value={basic.name}
            onChange={(value) => setBasic((prev) => ({ ...prev, name: value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <LabelInput
              label="归属部门"
              value={basic.department}
              onChange={(value) => setBasic((prev) => ({ ...prev, department: value }))}
            />
            <LabelInput
              label="负责人"
              value={basic.ownerId}
              onChange={(value) => setBasic((prev) => ({ ...prev, ownerId: value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabelSelect
              label="Agent Runtime"
              value={basic.agentRuntime}
              options={RUNTIME_OPTIONS}
              onChange={(value) => setBasic((prev) => ({ ...prev, agentRuntime: value as AgentRuntime }))}
            />
            <LabelSelect
              label="默认模型"
              value={basic.modelId}
              options={MODEL_OPTIONS}
              onChange={(value) => setBasic((prev) => ({ ...prev, modelId: value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabelSelect
              label="运行状态"
              value={basic.status}
              options={STATUS_OPTIONS}
              onChange={(value) => setBasic((prev) => ({ ...prev, status: value }))}
            />
            <LabelSelect
              label="实例类型"
              value={basic.scope}
              options={[
                { value: 'organization', label: '组织级实例' },
                { value: 'personal', label: '个人级实例' },
              ]}
              onChange={(value) => setBasic((prev) => ({ ...prev, scope: value as InstanceScope }))}
            />
          </div>
          <LabelTextarea
            label="描述"
            value={basic.description}
            onChange={(value) => setBasic((prev) => ({ ...prev, description: value }))}
            rows={3}
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">System Prompt *</label>
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
              value={basic.systemPrompt}
              onChange={(e) => setBasic((prev) => ({ ...prev, systemPrompt: e.target.value }))}
              rows={8}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] resize-y font-mono leading-relaxed"
            />
          </div>
        </div>
      )}

      {tab === 'capabilities' && (
        <div className="space-y-4">
          <TagSection title="工具 Tools" items={capabilities.tools} empty="未绑定工具" />
          <TagSection title="Skill" items={capabilities.skills} empty="未绑定 Skill" />
        </div>
      )}

      {tab === 'evaluation' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">评测集</label>
            {suites.length > 0 ? (
              <select
                value={evaluation.suiteId}
                onChange={(e) => {
                  const s = suites.find((x) => x.id === e.target.value);
                  setEvaluation((prev) => ({ ...prev, suiteId: e.target.value, suiteName: s?.name ?? '' }));
                }}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                <option value="">未绑定评测集</option>
                {suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}（{s.totalCases} 用例）
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
                {evaluation.suiteName || '未绑定评测集'}
              </div>
            )}
          </div>
          <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white text-sm">
            <span>
              <span className="block font-medium text-gray-700">保存后运行基线评测</span>
              <span className="block text-xs text-gray-400 mt-0.5">需要先选择评测集</span>
            </span>
            <input
              type="checkbox"
              checked={evaluation.runBaselineAfterCreate}
              disabled={!evaluation.suiteId}
              onChange={(e) =>
                setEvaluation((prev) => ({ ...prev, runBaselineAfterCreate: e.target.checked }))
              }
              className="rounded border-gray-300"
            />
          </label>
        </div>
      )}

      {tab === 'version' && (
        <div className="space-y-4">
          {/* 当前版本 */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-400 mb-1">当前版本</div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{version.versionName || '未记录'}</span>
              {version.publishAfterCreate && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-700">已发布</span>
              )}
            </div>
            {version.releaseNote && (
              <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{version.releaseNote}</div>
            )}
          </div>

          {/* 版本历史 */}
          {version.versions.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">版本历史</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {version.versions.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 border border-gray-100 rounded-lg text-xs">
                    <span className="font-mono font-semibold text-gray-700">{v.version}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        v.status === 'published'
                          ? 'bg-green-50 text-green-700'
                          : v.status === 'review'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {v.status === 'published' ? '已发布' : v.status === 'review' ? '审核中' : '草稿'}
                    </span>
                    <span className="text-gray-400 ml-auto">{v.date ? new Date(v.date).toLocaleDateString('zh-CN') : '-'}</span>
                    {v.status !== 'published' && (
                      <button
                        onClick={() => publishVersion(i)}
                        disabled={saving}
                        className="px-2 py-0.5 text-[10px] font-medium text-[#007AFF] border border-[#007AFF]/30 rounded hover:bg-[#007AFF]/5 transition-colors disabled:opacity-40"
                      >
                        发布
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 创建新版本 */}
          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs font-medium text-gray-600 mb-2">创建新版本</div>
            <div className="space-y-2">
              <input
                type="text"
                value={newVersionNum}
                onChange={(e) => setNewVersionNum(e.target.value)}
                placeholder="版本号，如 v0.2.0"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              />
              <textarea
                value={newVersionNote}
                onChange={(e) => setNewVersionNote(e.target.value)}
                placeholder="版本说明（可选）"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] resize-none"
              />
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 mt-4 border-t border-gray-100">
        <button
          onClick={saveEmployee}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '保存数字员工'}
        </button>
      </div>
    </Drawer>
  );
}

function ReadonlyMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-gray-400">{label}</span>
      <div className={`font-medium text-gray-700 truncate ${mono ? 'font-mono' : ''}`}>
        {value || '-'}
      </div>
    </div>
  );
}





function TagSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium text-gray-800">{title}</h4>
      {items.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-lg">
          {empty}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
              {item}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function LabelInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
      />
    </div>
  );
}

function LabelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LabelTextarea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] resize-y"
      />
    </div>
  );
}
