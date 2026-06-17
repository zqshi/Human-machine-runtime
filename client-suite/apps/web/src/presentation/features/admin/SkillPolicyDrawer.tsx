import { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { skillApi } from '../../../application/services/adminApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Override {
  skillId: string;
  mode: string;
  minConfidence: number;
  minRepeated: number;
  fallback: string;
}

const MODE_DESC: Record<string, string> = {
  auto: '系统根据置信度和重复次数自动判断是否沉淀技能',
  manual: '所有沉淀操作需人工审核确认后执行',
  disabled: '关闭沉淀功能，技能状态保持不变',
};

const FALLBACK_DESC: Record<string, string> = {
  ignore: '不满足沉淀条件时静默跳过，不做任何处理',
  queue: '加入待审队列，等待条件满足或人工干预',
  reject: '明确拒绝沉淀，标记为不可沉淀状态',
};

export function SkillPolicyDrawer({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('auto');
  const [minConfidence, setMinConfidence] = useState(0.8);
  const [minRepeated, setMinRepeated] = useState(3);
  const [fallback, setFallback] = useState('ignore');
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [error, setError] = useState('');
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);

  // 打开抽屉时在渲染阶段标记 loading（避免 useEffect 中同步 setState）
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLoading(true);
      setError('');
    }
  }

  useEffect(() => {
    if (!open) return;
    Promise.all([skillApi.getSedimentationPolicy(), skillApi.list()])
      .then(([data, skillData]) => {
        setMode(String(data.mode || 'auto'));
        setMinConfidence(Number(data.minConfidence) || 0.8);
        setMinRepeated(Number(data.minRepeated) || 3);
        setFallback(String(data.fallback || 'ignore'));
        setOverrides(Array.isArray(data.overrides) ? (data.overrides as Override[]) : []);
        const list = (skillData.skills || []) as { id: string; name: string }[];
        setSkills(list.map((s) => ({ id: String(s.id), name: String(s.name) })));
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await skillApi.updateSedimentationPolicy({
        mode,
        minConfidence,
        minRepeated,
        fallback,
        overrides,
      });
      onClose();
    } catch (e) {
      setError(String((e as Error).message || '保存失败'));
    }
    setSaving(false);
  };

  const addOverride = () => {
    const usedIds = new Set(overrides.map((o) => o.skillId));
    const available = skills.find((s) => !usedIds.has(s.id));
    setOverrides((o) => [
      ...o,
      {
        skillId: available?.id || '',
        mode: 'auto',
        minConfidence: 0.8,
        minRepeated: 3,
        fallback: 'ignore',
      },
    ]);
  };

  const updateOverride = (index: number, field: string, value: string | number) => {
    setOverrides((o) => o.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeOverride = (index: number) => {
    setOverrides((o) => o.filter((_, i) => i !== index));
  };

  const skillName = (id: string) => skills.find((s) => s.id === id)?.name || id;
  const usedSkillIds = new Set(overrides.map((o) => o.skillId));

  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title="技能沉淀策略" width="w-[520px]">
      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">加载中...</div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}

          <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Icon name="info" size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                沉淀策略控制技能从"实时调用"转为"预计算缓存"的自动化程度。
                当技能调用达到置信度和重复次数阈值后，系统按策略决定是否将结果固化，降低后续调用延迟和成本。
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">沉淀模式</label>
            <div className="space-y-1.5">
              {(['auto', 'manual', 'disabled'] as const).map((m) => (
                <label
                  key={m}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    mode === m
                      ? 'border-[#007AFF] bg-[#007AFF]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="mt-0.5 accent-[#007AFF]"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {m === 'auto' ? '自动' : m === 'manual' ? '手动' : '禁用'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{MODE_DESC[m]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {mode !== 'disabled' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">最小置信度</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">调用结果一致性 ≥ 此值才触发沉淀</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    最小重复次数
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={minRepeated}
                    onChange={(e) => setMinRepeated(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">同类调用 ≥ 此次数才纳入候选</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">回退策略</label>
                <select
                  value={fallback}
                  onChange={(e) => setFallback(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="ignore">忽略 — 静默跳过</option>
                  <option value="queue">排队 — 进入待审队列</option>
                  <option value="reject">拒绝 — 标记不可沉淀</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">{FALLBACK_DESC[fallback]}</p>
              </div>
            </>
          )}

          {mode !== 'disabled' && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-medium text-gray-600">单技能覆盖规则</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    为特定技能设置独立的沉淀参数，优先级高于全局策略
                  </p>
                </div>
                <button
                  onClick={addOverride}
                  disabled={overrides.length >= skills.length}
                  className="text-xs text-[#007AFF] hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  + 添加覆盖
                </button>
              </div>
              {overrides.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400">暂无覆盖规则，所有技能使用全局策略</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {overrides.map((o, i) => (
                    <div key={o.skillId || `ov-${i}`} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <select
                          value={o.skillId}
                          onChange={(e) => updateOverride(i, 'skillId', e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg mr-2 bg-white"
                        >
                          <option value="">选择技能...</option>
                          {skills
                            .filter((s) => s.id === o.skillId || !usedSkillIds.has(s.id))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.id})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => removeOverride(i)}
                          className="text-xs text-red-400 hover:text-red-600 shrink-0"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">模式</label>
                          <select
                            value={o.mode}
                            onChange={(e) => updateOverride(i, 'mode', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white"
                          >
                            <option value="auto">自动</option>
                            <option value="manual">手动</option>
                            <option value="disabled">禁用</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">置信度</label>
                          <input
                            type="number"
                            step="0.05"
                            min={0}
                            max={1}
                            value={o.minConfidence}
                            onChange={(e) =>
                              updateOverride(i, 'minConfidence', Number(e.target.value))
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">重复次数</label>
                          <input
                            type="number"
                            min={1}
                            value={o.minRepeated}
                            onChange={(e) =>
                              updateOverride(i, 'minRepeated', Number(e.target.value))
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                          />
                        </div>
                      </div>
                      {o.skillId && (
                        <div className="text-[10px] text-gray-400 mt-1.5">
                          覆盖{' '}
                          <span className="font-medium text-gray-600">{skillName(o.skillId)}</span>{' '}
                          的沉淀策略
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存策略'}
          </button>
        </div>
      )}
    </Drawer>
  );
}
