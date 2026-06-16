import { useState, type ReactNode } from 'react';
import {
  scheduledTaskApi,
  type ScheduledTask,
  type ScheduledTaskInput,
} from '../../../../application/services/adminApi';
import { Drawer } from '../../../components/ui/Drawer';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { FieldRenderer } from './FieldRenderer';
import { FrequencyPicker } from './FrequencyPicker';
import { inferMode, type FreqConfig } from './jobSpecs';
import {
  JOB_SPECS,
  findSpecById,
  specIdOf,
  buildPayload,
  fieldVisible,
  type JobSpec,
} from './jobSpecs';

interface Props {
  open: boolean;
  task: ScheduledTask | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#007AFF]';

function initValues(spec: JobSpec, payload?: Record<string, unknown>): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of spec.fields) {
    v[f.key] = payload && payload[f.key] !== undefined ? payload[f.key] : f.default;
  }
  return v;
}

/** 新建/编辑定时任务（spec 驱动）。父组件用 key={task?.id ?? '__new__'} 控制 remount */
export function ScheduledTaskEditor({ open, task, onClose, onSaved }: Props) {
  const isEdit = !!task;
  const initSpecId = task ? specIdOf(task) : 'system:echo';
  const initSpec = findSpecById(initSpecId)!;

  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [specId, setSpecId] = useState(initSpecId);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initValues(initSpec, task?.jobPayload as Record<string, unknown> | undefined)
  );
  const [freq, setFreq] = useState<FreqConfig>(() => ({
    scheduleType: task?.scheduleType ?? 'interval',
    cronExpr: task?.cronExpr ?? undefined,
    intervalSeconds: task?.intervalSeconds ?? 300,
  }));
  const [isEnabled, setIsEnabled] = useState(task?.isEnabled ?? true);
  const [jsonInvalid, setJsonInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const spec = findSpecById(specId)!;

  const selectSpec = (id: string) => {
    const s = findSpecById(id);
    if (!s) return;
    setSpecId(id);
    setValues(initValues(s));
    setJsonInvalid(false);
  };

  const setField = (key: string, v: unknown) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    setError('');
    if (!name.trim()) {
      setError('请填写任务名称');
      return;
    }
    for (const f of spec.fields) {
      if (f.required) {
        const v = values[f.key];
        const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
        if (empty) {
          setError(`请填写「${f.label}」`);
          return;
        }
      }
    }
    if (jsonInvalid) {
      setError('存在 JSON 格式错误');
      return;
    }
    setSaving(true);
    try {
      const visibleFields = spec.fields.filter((f) => fieldVisible(f, values));
      const visibleValues = Object.fromEntries(visibleFields.map((f) => [f.key, values[f.key]]));
      const payload = buildPayload(spec, visibleValues, inferMode(freq));
      const data: ScheduledTaskInput = {
        name,
        description: description || undefined,
        jobType: spec.jobType,
        jobPayload: payload,
        scheduleType: freq.scheduleType,
        isEnabled,
        ...(freq.scheduleType === 'cron' ? { cronExpr: freq.cronExpr } : { intervalSeconds: freq.intervalSeconds }),
      };
      if (isEdit && task) {
        await scheduledTaskApi.update(task.id, data);
      } else {
        await scheduledTaskApi.create(data);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑定时任务' : '新建定时任务'}
      width="w-full md:w-[560px]"
    >
      <div className="space-y-4">
        <Field label="任务名称" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="描述（可选）">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="任务模板" required>
          <div className="grid grid-cols-2 gap-2">
            {JOB_SPECS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSpec(s.id)}
                className={`text-left p-2.5 rounded-lg border transition-colors ${
                  specId === s.id ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    name={s.icon}
                    size={16}
                    className={specId === s.id ? 'text-[#007AFF]' : 'text-gray-500'}
                  />
                  <span className="text-sm font-medium text-gray-800">{s.label}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{s.description}</div>
              </button>
            ))}
          </div>
        </Field>

        {spec.backendPending && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            ⚠ 该作业的后端 handler 尚未实现，可保存配置，但调度时不会真正执行。
          </div>
        )}

        {spec.fields
          .filter((f) => fieldVisible(f, values))
          .map((f) => (
            <Field key={f.key} label={f.label} required={f.required} help={f.help}>
              <FieldRenderer
                field={f}
                value={values[f.key]}
                onChange={(v) => setField(f.key, v)}
                onInvalid={setJsonInvalid}
              />
            </Field>
          ))}

        <Field label="调度频次" required>
          <FrequencyPicker
            value={freq}
            onChange={setFreq}
            allowedModes={spec.allowedFreqModes}
          />
        </Field>
        {spec.id === 'system:weekly-report' && (
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            统计窗口由频次自动推导：每周 → 上周，每月 → 近 30 天
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
          立即启用
        </label>

        {error && <div className="text-xs text-red-500">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  help?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-red-500 font-medium">*</span>}
        {help && <span className="text-gray-300 font-normal">（{help}）</span>}
      </div>
      {children}
    </div>
  );
}
