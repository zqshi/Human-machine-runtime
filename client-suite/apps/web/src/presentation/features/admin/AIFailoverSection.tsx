import { useState, useEffect, useCallback, type DragEvent } from 'react';
import { aiGatewayApi } from '../../../application/services/adminApi';
import { Icon } from '../../components/ui/Icon';

interface FailoverForm {
  primaryModelId: string;
  strategy: 'ordered' | 'random';
  fallbackModelIds: string[];
}

const EMPTY_FORM: FailoverForm = {
  primaryModelId: '',
  strategy: 'ordered',
  fallbackModelIds: [],
};

/**
 * 故障转移 — 全局单条规则的内联配置。
 * 主模型异常（欠费/限流/挂了/超时/报错）时按备用链自动切换，用户无感知。
 * 系统级能力，故全局仅一条规则：展示态 + 编辑态切换，无列表/新建/删除。
 */
export function FailoverSection({ models: modelsProp }: { models: Record<string, unknown>[] }) {
  const models = modelsProp;
  const [rule, setRule] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FailoverForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ primaryModelId?: string }>({});

  const modelName = (id: string) => {
    const m = models.find((m) => String(m.id) === id);
    return m ? String(m.displayName || m.name) : id;
  };

  const load = useCallback(() => {
    aiGatewayApi
      .listFailoverChains()
      .then((r) => setRule((r.rows || [])[0] || null))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const enterEdit = () => {
    setForm(
      rule
        ? {
            primaryModelId: String(rule.primaryModelId || ''),
            strategy: String(rule.strategy || 'ordered') as 'ordered' | 'random',
            fallbackModelIds: (rule.fallbackModelIds || []) as string[],
          }
        : { ...EMPTY_FORM, primaryModelId: models[0] ? String(models[0].id) : '' }
    );
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setErrors({});
  };

  const save = async () => {
    const nextErrors: { primaryModelId?: string } = {};
    if (!form.primaryModelId) nextErrors.primaryModelId = '请选择主模型';
    setErrors(nextErrors);
    if (nextErrors.primaryModelId) return;

    setSaving(true);
    try {
      await aiGatewayApi.saveFailoverChain({
        ...(rule ? { id: String(rule.id) } : {}),
        ...form,
        enabled: true,
      });
      setEditing(false);
      load();
    } catch {
      /* intentionally ignored */
    }
    setSaving(false);
  };

  const toggleFallback = (mid: string) => {
    setForm((f) => ({
      ...f,
      fallbackModelIds: f.fallbackModelIds.includes(mid)
        ? f.fallbackModelIds.filter((id) => id !== mid)
        : [...f.fallbackModelIds, mid],
    }));
  };

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const resetDrag = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // 拖拽排序（仅顺序策略）：拖动一项插入到目标项位置
  const onItemDragStart = (idx: number) => (e: DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onItemDragOver = (idx: number) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx !== null && dragIdx !== idx) setDragOverIdx(idx);
  };
  const onItemDrop = (idx: number) => (e: DragEvent) => {
    e.preventDefault();
    const from = dragIdx;
    resetDrag();
    if (from === null || from === idx) return;
    setForm((f) => {
      const arr = [...f.fallbackModelIds];
      const [moved] = arr.splice(from, 1);
      arr.splice(idx, 0, moved);
      return { ...f, fallbackModelIds: arr };
    });
  };

  const fallbacks = (rule ? (rule.fallbackModelIds || []) : []) as string[];
  const ruleStrategy = String(rule?.strategy || 'ordered');
  const candidates = models.filter(
    (m) =>
      String(m.id) !== form.primaryModelId &&
      !form.fallbackModelIds.includes(String(m.id))
  );

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            故障转移
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            主模型异常时，按备用链自动切换，保障调用可用性
          </p>
        </div>
        {!editing && (
          <button
            onClick={enterEdit}
            className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            <Icon name="edit" size={12} className="mr-0.5 align-[-2px]" />
            {rule ? '编辑' : '配置规则'}
          </button>
        )}
      </div>

      {!editing ? (
        rule ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-400 w-20 shrink-0">主模型</span>
              <span className="text-gray-800 font-medium">
                {modelName(String(rule.primaryModelId))}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 w-20 shrink-0">切换策略</span>
              <span className="text-gray-600">
                {ruleStrategy === 'random' ? '随机切换' : '顺序切换'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 w-20 shrink-0">备用模型</span>
              {fallbacks.length === 0 ? (
                <span className="text-amber-500 text-xs">未配置，故障转移不会生效</span>
              ) : (
                <span className="text-gray-600 text-xs">
                  {ruleStrategy === 'random'
                    ? fallbacks.map((fid) => modelName(fid)).join('、')
                    : fallbacks.map((fid, i) => `${i + 1}.${modelName(fid)}`).join(' → ')}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 py-1">
            尚未配置故障转移。主模型异常时调用将直接失败。
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              主模型 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.primaryModelId}
              onChange={(e) => {
                setForm((f) => ({ ...f, primaryModelId: e.target.value }));
                setErrors((p) => ({ ...p, primaryModelId: undefined }));
              }}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg ${errors.primaryModelId ? 'border-red-400' : 'border-gray-200'}`}
            >
              <option value="">请选择主模型</option>
              {models.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {String(m.displayName || m.name)}
                </option>
              ))}
            </select>
            {errors.primaryModelId && (
              <p className="text-[11px] text-red-500 mt-1">{errors.primaryModelId}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">切换策略</label>
            <select
              value={form.strategy}
              onChange={(e) =>
                setForm((f) => ({ ...f, strategy: e.target.value as 'ordered' | 'random' }))
              }
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              <option value="ordered">指定顺序（按优先级依次切换）</option>
              <option value="random">随机切换（随机选择一个可用备用模型）</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              备用模型
              <span className="text-gray-400 ml-1">
                {form.strategy === 'ordered' ? '（已选可调整优先级）' : '（已选将随机切换）'}
              </span>
            </label>

            {/* 已选区：始终展示已选备用。ordered 带序号+上下移，random 仅展示，均可移除 */}
            {form.fallbackModelIds.length > 0 ? (
              <div className="space-y-1 mb-2 p-2 bg-gray-50 rounded-lg">
                {form.fallbackModelIds.map((fid, idx) => {
                  const m = models.find((mm) => String(mm.id) === fid);
                  return (
                    <div
                      key={fid}
                      draggable={form.strategy === 'ordered'}
                      onDragStart={form.strategy === 'ordered' ? onItemDragStart(idx) : undefined}
                      onDragOver={form.strategy === 'ordered' ? onItemDragOver(idx) : undefined}
                      onDrop={form.strategy === 'ordered' ? onItemDrop(idx) : undefined}
                      onDragEnd={resetDrag}
                      className={[
                        'flex items-center gap-2 text-sm rounded px-1 -mx-1',
                        form.strategy === 'ordered' ? 'cursor-grab active:cursor-grabbing' : '',
                        dragIdx === idx ? 'opacity-40' : '',
                        dragOverIdx === idx ? 'border-t-2 border-[#007AFF]' : '',
                      ].join(' ')}
                    >
                      {form.strategy === 'ordered' && (
                        <>
                          <Icon name="drag_indicator" size={14} className="text-gray-300" />
                          <span className="w-4 text-center text-xs text-gray-400 font-mono">
                            {idx + 1}
                          </span>
                        </>
                      )}
                      <span className="flex-1 text-gray-700">
                        {m ? String(m.displayName || m.name) : fid}
                      </span>
                      <button
                        onClick={() => toggleFallback(fid)}
                        className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                        title="移除"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 mb-2">尚未选择备用模型</p>
            )}

            {/* 候选区：仅展示未选模型，勾选即加入已选 */}
            {candidates.length === 0 ? (
              <p className="text-[11px] text-gray-400">无可添加的备用模型</p>
            ) : (
              <div className="space-y-1">
                {candidates.map((m) => {
                  const mid = String(m.id);
                  return (
                    <label
                      key={mid}
                      className="flex items-center gap-2 text-sm cursor-pointer text-gray-600 hover:text-[#007AFF]"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleFallback(mid)}
                        className="rounded border-gray-300"
                      />
                      {String(m.displayName || m.name)}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
