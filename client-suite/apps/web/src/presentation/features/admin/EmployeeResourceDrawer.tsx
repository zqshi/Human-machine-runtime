import { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import {
  employeeDetailApi,
  type Employee,
  type EmployeeResourceConfig,
} from '../../../application/services/adminApi';

interface Props {
  open: boolean;
  employeeId: string | null;
  employees: Employee[];
  onClose: () => void;
  onSave: () => void;
}

const CPU_OPTIONS = ['250m', '500m', '1000m', '2000m', '4000m'];
const MEMORY_OPTIONS = ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'];
const STORAGE_OPTIONS = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'];

function defaultForm(): EmployeeResourceConfig {
  return {
    compute: { cpu: '500m', memory: '512Mi', gpu: null },
    model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
    budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
    storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
    source: 'tenant_default',
    customizedAt: null,
    customizedBy: null,
  };
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
        />
        {suffix && <span className="text-xs text-gray-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
      />
    </label>
  );
}

export function EmployeeResourceDrawer({ open, employeeId, employees, onClose, onSave }: Props) {
  const [form, setForm] = useState<EmployeeResourceConfig>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const emp = employees.find((e) => e.id === employeeId);

  useEffect(() => {
    if (!open) return;
    const target = employees.find((e) => e.id === employeeId);
    if (!target) return;
    setForm(target.resources ?? defaultForm());
  }, [open, employeeId, employees]);

  const handleSave = async () => {
    if (!employeeId) return;
    setSaving(true);
    try {
      await employeeDetailApi.updateResources(employeeId, {
        compute: form.compute,
        model: form.model,
        budget: form.budget,
        storage: form.storage,
      });
      onSave();
    } catch {
      /* handled by caller */
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!employeeId) return;
    setResetting(true);
    try {
      await employeeDetailApi.resetResources(employeeId);
      onSave();
    } catch {
      /* handled by caller */
    }
    setResetting(false);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`资源配置 · ${emp?.displayName || emp?.name || employeeId || ''}`}
      width="w-[480px]"
    >
      <div className="space-y-4">
        {/* 配置来源标识 */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <span
            className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
              form.source === 'custom' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {form.source === 'custom' ? '独立配置' : '继承租户默认'}
          </span>
          {form.customizedAt && (
            <span className="text-[11px] text-gray-400">
              {form.customizedBy} · {new Date(form.customizedAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>

        {/* 计算资源 */}
        <section>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Icon name="memory" size={16} className="text-gray-400" /> 计算资源
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="CPU"
              value={form.compute.cpu}
              options={CPU_OPTIONS}
              onChange={(v) => setForm({ ...form, compute: { ...form.compute, cpu: v } })}
            />
            <SelectField
              label="内存"
              value={form.compute.memory}
              options={MEMORY_OPTIONS}
              onChange={(v) => setForm({ ...form, compute: { ...form.compute, memory: v } })}
            />
          </div>
          <div className="mt-2">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={form.compute.gpu !== null}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compute: {
                      ...form.compute,
                      gpu: e.target.checked ? { type: 'A100', count: 1 } : null,
                    },
                  })
                }
                className="rounded border-gray-300"
              />
              启用 GPU
            </label>
            {form.compute.gpu && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <TextField
                  label="GPU 类型"
                  value={form.compute.gpu.type}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      compute: { ...form.compute, gpu: { ...form.compute.gpu!, type: v } },
                    })
                  }
                />
                <NumberField
                  label="GPU 数量"
                  value={form.compute.gpu.count}
                  min={1}
                  max={8}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      compute: { ...form.compute, gpu: { ...form.compute.gpu!, count: v } },
                    })
                  }
                />
              </div>
            )}
          </div>
        </section>

        {/* AI 模型 */}
        <section>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Icon name="smart_toy" size={16} className="text-gray-400" /> AI 模型
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="主模型"
              value={form.model.primaryModel}
              placeholder="auto"
              onChange={(v) => setForm({ ...form, model: { ...form.model, primaryModel: v } })}
            />
            <NumberField
              label="最大并发"
              value={form.model.maxConcurrency}
              min={1}
              max={100}
              onChange={(v) => setForm({ ...form, model: { ...form.model, maxConcurrency: v } })}
            />
          </div>
          <div className="mt-2">
            <TextField
              label="降级模型（逗号分隔）"
              value={form.model.fallbackModels.join(', ')}
              onChange={(v) =>
                setForm({
                  ...form,
                  model: {
                    ...form.model,
                    fallbackModels: v
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="claude-sonnet-4-6, gpt-4o"
            />
          </div>
        </section>

        {/* 预算 */}
        <section>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Icon name="payments" size={16} className="text-gray-400" /> 预算
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="月度上限"
              value={form.budget.monthlyLimitCny}
              min={0}
              suffix="CNY"
              onChange={(v) => setForm({ ...form, budget: { ...form.budget, monthlyLimitCny: v } })}
            />
            <NumberField
              label="日度上限"
              value={form.budget.dailyLimitCny ?? 0}
              min={0}
              suffix="CNY"
              onChange={(v) =>
                setForm({ ...form, budget: { ...form.budget, dailyLimitCny: v || null } })
              }
            />
            <NumberField
              label="告警阈值"
              value={form.budget.alertThresholdPct}
              min={1}
              max={100}
              suffix="%"
              onChange={(v) =>
                setForm({ ...form, budget: { ...form.budget, alertThresholdPct: v } })
              }
            />
          </div>
        </section>

        {/* 存储 */}
        <section>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Icon name="storage" size={16} className="text-gray-400" /> 存储
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="持久卷"
              value={form.storage.persistentVolumeSize}
              options={STORAGE_OPTIONS}
              onChange={(v) =>
                setForm({ ...form, storage: { ...form.storage, persistentVolumeSize: v } })
              }
            />
            <SelectField
              label="临时存储"
              value={form.storage.tempStorageSize}
              options={STORAGE_OPTIONS}
              onChange={(v) =>
                setForm({ ...form, storage: { ...form.storage, tempStorageSize: v } })
              }
            />
          </div>
        </section>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting || form.source === 'tenant_default'}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {resetting ? '重置中...' : '重置为默认'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
