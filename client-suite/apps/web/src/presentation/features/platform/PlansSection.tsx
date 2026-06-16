import { useState, useEffect, useCallback } from 'react';
import { planApi, type PlanDTO } from '../../../application/services/adminApi';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import {
  PLAN_QUOTAS,
  CPU_OPTIONS,
  MEMORY_OPTIONS,
  STORAGE_OPTIONS,
  CAPACITY_LABELS,
  AI_LABELS,
  DATA_LABELS,
  type Quotas,
  type Features,
} from './tenantConstants';

type EditorTab = 'info' | 'capacity' | 'resource' | 'ai' | 'features';

const TABS: { key: EditorTab; label: string; icon: string }[] = [
  { key: 'info', label: '基础信息', icon: 'info' },
  { key: 'capacity', label: '容量配额', icon: 'speed' },
  { key: 'resource', label: '实例资源', icon: 'memory' },
  { key: 'ai', label: 'AI 用量', icon: 'psychology' },
  { key: 'features', label: '功能开关', icon: 'toggle_on' },
];

const DEFAULT_FEATURES: Features = {
  aiGateway: true,
  knowledgeBase: true,
  matrixIntegration: false,
  customTools: true,
};

function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !plan;
  const [tab, setTab] = useState<EditorTab>('info');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    displayOrder: 0,
    description: '',
    isDefault: false,
  });
  const [quotas, setQuotas] = useState<Quotas>({ ...PLAN_QUOTAS.standard });
  const [features, setFeatures] = useState<Features>({ ...DEFAULT_FEATURES });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name,
        slug: plan.slug,
        displayOrder: plan.displayOrder,
        description: plan.description || '',
        isDefault: plan.isDefault,
      });
      setQuotas({ ...PLAN_QUOTAS.standard, ...(plan.quotaTemplate as Partial<Quotas>) });
      setFeatures({ ...DEFAULT_FEATURES, ...(plan.featureTemplate as Partial<Features>) });
    } else {
      setForm({ name: '', slug: '', displayOrder: 0, description: '', isDefault: false });
      setQuotas({ ...PLAN_QUOTAS.standard });
      setFeatures({ ...DEFAULT_FEATURES });
    }
    setTab('info');
  }, [plan]);

  const save = async () => {
    if (!form.name.trim() || (!plan && !form.slug.trim())) return;
    setSaving(true);
    try {
      const payload = { ...form, quotaTemplate: quotas, featureTemplate: features };
      if (plan) await planApi.update(plan.id, payload);
      else await planApi.create(payload);
      onSaved();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const cls =
    'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';

  return (
    <Drawer open onClose={onClose} title={isNew ? '新建套餐' : '编辑套餐'} width="w-[560px]">
      <div className="flex gap-1 mb-4 border-b border-gray-100 pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-[#007AFF] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
        {tab === 'info' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">套餐名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：标准版"
                className={cls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">
                标识（Slug）
                {plan && <span className="text-[10px] text-gray-400 ml-1">创建后不可修改</span>}
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  }))
                }
                disabled={!!plan}
                placeholder="如：standard"
                className={`${cls} ${plan ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">排序</label>
                <input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayOrder: Number(e.target.value) || 0 }))
                  }
                  className={cls}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <ToggleSwitch
                    checked={form.isDefault}
                    onChange={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
                  />
                  默认套餐
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">描述</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="套餐说明"
                className={cls}
              />
            </div>
          </div>
        )}

        {tab === 'capacity' && (
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(CAPACITY_LABELS) as string[]).map((k) => (
              <div key={k}>
                <label className="text-xs text-gray-500 block mb-0.5">{CAPACITY_LABELS[k]}</label>
                <input
                  type="number"
                  min={0}
                  value={quotas[k as keyof Quotas] as number}
                  onChange={(e) => setQuotas((q) => ({ ...q, [k]: Number(e.target.value) || 0 }))}
                  className={cls}
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'resource' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">CPU</label>
              <select
                value={quotas.instanceCpu}
                onChange={(e) => setQuotas((q) => ({ ...q, instanceCpu: e.target.value }))}
                className={cls}
              >
                {CPU_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">内存</label>
              <select
                value={quotas.instanceMemory}
                onChange={(e) => setQuotas((q) => ({ ...q, instanceMemory: e.target.value }))}
                className={cls}
              >
                {MEMORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">存储</label>
              <select
                value={quotas.instanceStorage}
                onChange={(e) => setQuotas((q) => ({ ...q, instanceStorage: e.target.value }))}
                className={cls}
              >
                {STORAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(AI_LABELS) as string[]).map((k) => (
              <div key={k}>
                <label className="text-xs text-gray-500 block mb-0.5">{AI_LABELS[k]}</label>
                <input
                  type="number"
                  min={0}
                  value={quotas[k as keyof Quotas] as number}
                  onChange={(e) => setQuotas((q) => ({ ...q, [k]: Number(e.target.value) || 0 }))}
                  className={cls}
                />
              </div>
            ))}
            {(Object.keys(DATA_LABELS) as string[]).map((k) => (
              <div key={k}>
                <label className="text-xs text-gray-500 block mb-0.5">{DATA_LABELS[k]}</label>
                <input
                  type="number"
                  min={0}
                  value={quotas[k as keyof Quotas] as number}
                  onChange={(e) => setQuotas((q) => ({ ...q, [k]: Number(e.target.value) || 0 }))}
                  className={cls}
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'features' && (
          <div className="space-y-2.5">
            {(
              [
                { key: 'aiGateway', label: 'AI Gateway', desc: '启用 AI 网关模型路由与流控' },
                { key: 'knowledgeBase', label: '知识库', desc: '启用文档知识库上传与检索' },
                {
                  key: 'matrixIntegration',
                  label: 'Matrix 集成',
                  desc: '启用 Matrix 即时通讯集成',
                },
                { key: 'customTools', label: '自定义工具', desc: '允许租户注册自定义 MCP 工具' },
              ] as { key: keyof Features; label: string; desc: string }[]
            ).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-gray-100 bg-gray-50/50"
              >
                <div>
                  <div className="text-sm text-gray-700 font-medium">{item.label}</div>
                  <div className="text-[10px] text-gray-400">{item.desc}</div>
                </div>
                <ToggleSwitch
                  checked={features[item.key]}
                  onChange={() => setFeatures((f) => ({ ...f, [item.key]: !f[item.key] }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </Drawer>
  );
}

const PLAN_CARD_DEFAULT = 'border-[#007AFF]/40 bg-blue-50/30';
const PLAN_CARD_NORMAL = 'border-gray-200 bg-white';

export function PlansSection() {
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorTarget, setEditorTarget] = useState<PlanDTO | null | undefined>(undefined);

  const load = useCallback(() => {
    setLoading(true);
    planApi
      .list()
      .then((r) => setPlans(r.plans || []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (plan: PlanDTO) => {
    if (!confirm(`确认删除套餐「${plan.name}」？`)) return;
    try {
      await planApi.delete(plan.id);
      load();
    } catch {
      alert('删除失败：可能有租户正在使用该套餐');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">套餐管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">管理平台服务套餐及其配额模板</p>
        </div>
        <button
          onClick={() => setEditorTarget(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors"
        >
          <Icon name="add" size={16} />
          新建套餐
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中…</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-400 py-12">暂无套餐，点击上方按钮创建</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const q = plan.quotaTemplate as Record<string, unknown>;
            const colorCls = plan.isDefault ? PLAN_CARD_DEFAULT : PLAN_CARD_NORMAL;
            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 p-4 transition-shadow hover:shadow-md ${colorCls}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{plan.name}</span>
                      {plan.isDefault && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#007AFF]/10 text-[#007AFF] font-medium">
                          默认
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{plan.slug}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditorTarget(plan)}
                      className="p-1 text-gray-400 hover:text-[#007AFF] rounded transition-colors"
                      title="编辑"
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="删除"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </div>
                </div>
                {plan.description && (
                  <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">实例</span>
                    <span className="text-gray-700 font-medium">
                      {String(q.maxInstances ?? '-')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">用户</span>
                    <span className="text-gray-700 font-medium">{String(q.maxUsers ?? '-')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">月 Token</span>
                    <span className="text-gray-700 font-medium">
                      {q.tokenBudgetMonthly
                        ? `${(Number(q.tokenBudgetMonthly) / 10000).toFixed(0)}万`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">存储</span>
                    <span className="text-gray-700 font-medium">
                      {q.totalStorageGB ? `${String(q.totalStorageGB)} GB` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editorTarget !== undefined && (
        <PlanEditor
          plan={editorTarget}
          onClose={() => setEditorTarget(undefined)}
          onSaved={() => {
            setEditorTarget(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
