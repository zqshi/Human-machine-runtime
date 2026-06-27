/**
 * GoalCreationDialog — 结构化目标创建表单
 *
 * 分步骤创建契约化目标：意图 → 约束 → 授权 → 成功标准。
 * 通过 cockpitStore.createGoal 调用后端。
 */
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/ui/Icon';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import type {
  GoalPriority,
  GoalConstraint,
  GoalAuthorization,
  GoalSuccessCriteria,
} from '../../../domain/agent/UserGoal';

type Step = 'intent' | 'constraints' | 'authorization' | 'criteria' | 'review';
const STEPS: Step[] = ['intent', 'constraints', 'authorization', 'criteria', 'review'];
const STEP_LABELS: Record<Step, string> = {
  intent: '意图定义',
  constraints: '约束设置',
  authorization: '授权范围',
  criteria: '成功标准',
  review: '确认创建',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GoalCreationDialog({ open, onClose }: Props) {
  const createGoal = useCockpitStore((s) => s.createGoal);

  const [step, setStep] = useState<Step>('intent');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [intent, setIntent] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<GoalPriority>('normal');
  const [deadline, setDeadline] = useState('');
  const [constraints, setConstraints] = useState<GoalConstraint[]>([]);
  const [authorization, setAuthorization] = useState<GoalAuthorization>({
    autoExecute: [],
    requireOwner: [],
    requireCollaborator: [],
  });
  const [criteria, setCriteria] = useState<GoalSuccessCriteria[]>([]);

  // Constraint input
  const [newConstraintDesc, setNewConstraintDesc] = useState('');
  const [newConstraintHard, setNewConstraintHard] = useState(true);

  // Authorization input
  const [newAutoExec, setNewAutoExec] = useState('');
  const [newRequireOwner, setNewRequireOwner] = useState('');

  // Criteria input
  const [newMetric, setNewMetric] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newMeasure, setNewMeasure] = useState('');

  const currentStepIdx = STEPS.indexOf(step);

  const handleNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const handlePrev = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const addConstraint = () => {
    if (!newConstraintDesc.trim()) return;
    setConstraints([
      ...constraints,
      {
        id: `c-${Date.now()}`,
        type: 'custom',
        description: newConstraintDesc.trim(),
        hardLimit: newConstraintHard,
      },
    ]);
    setNewConstraintDesc('');
  };

  const addAutoExec = () => {
    if (!newAutoExec.trim()) return;
    setAuthorization({
      ...authorization,
      autoExecute: [...authorization.autoExecute, newAutoExec.trim()],
    });
    setNewAutoExec('');
  };

  const addRequireOwner = () => {
    if (!newRequireOwner.trim()) return;
    setAuthorization({
      ...authorization,
      requireOwner: [...authorization.requireOwner, newRequireOwner.trim()],
    });
    setNewRequireOwner('');
  };

  const addCriteria = () => {
    if (!newMetric.trim() || !newTarget.trim()) return;
    setCriteria([
      ...criteria,
      {
        id: `sc-${Date.now()}`,
        metric: newMetric.trim(),
        target: newTarget.trim(),
        measureMethod: newMeasure.trim() || '人工确认',
      },
    ]);
    setNewMetric('');
    setNewTarget('');
    setNewMeasure('');
  };

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createGoal({
        intent,
        title: title || intent,
        priority,
        deadline: deadline ? new Date(deadline).getTime() : undefined,
        constraints: constraints.length > 0 ? constraints : undefined,
        authorization:
          authorization.autoExecute.length > 0 || authorization.requireOwner.length > 0
            ? authorization
            : undefined,
        successCriteria: criteria.length > 0 ? criteria : undefined,
      });
      onClose();
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    intent,
    title,
    priority,
    deadline,
    constraints,
    authorization,
    criteria,
    createGoal,
    onClose,
  ]);

  const resetForm = () => {
    setStep('intent');
    setIntent('');
    setTitle('');
    setPriority('normal');
    setDeadline('');
    setConstraints([]);
    setAuthorization({ autoExecute: [], requireOwner: [], requireCollaborator: [] });
    setCriteria([]);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative w-[520px] max-h-[80vh] rounded-2xl border border-white/15 bg-[#1c1c2e]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Icon name="flag" size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-slate-100">创建目标</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-white/[0.06]">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => i <= currentStepIdx && setStep(s)}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                  s === step
                    ? 'bg-primary/20 text-primary font-medium'
                    : i < currentStepIdx
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600'
                }`}
              >
                {STEP_LABELS[s]}
              </button>
              {i < STEPS.length - 1 && (
                <Icon name="chevron_right" size={10} className="text-slate-600" />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto hmr-scrollbar px-5 py-4 space-y-4">
          {step === 'intent' && (
            <>
              <div>
                <label className="text-[11px] text-slate-400 mb-1.5 block">
                  意图（一句话可衡量的结果）
                </label>
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="例：将核心 API P99 延迟降至 150ms 以下"
                  className="w-full h-20 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1.5 block">
                  标题（可选，默认用意图）
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如不填写将使用意图作为标题"
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400 mb-1.5 block">优先级</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as GoalPriority)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 focus:outline-none focus:border-primary/50"
                  >
                    <option value="critical">紧急</option>
                    <option value="high">重要</option>
                    <option value="normal">普通</option>
                    <option value="low">低</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400 mb-1.5 block">截止日期</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            </>
          )}

          {step === 'constraints' && (
            <>
              <p className="text-[11px] text-slate-400">
                定义 Agent 执行过程中不可逾越的约束条件。
              </p>
              {constraints.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${c.hardLimit ? 'bg-red-400' : 'bg-yellow-400'}`}
                  />
                  <span className="text-[11px] text-slate-200 flex-1">{c.description}</span>
                  <button
                    type="button"
                    onClick={() => setConstraints(constraints.filter((_, idx) => idx !== i))}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <input
                    value={newConstraintDesc}
                    onChange={(e) => setNewConstraintDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') addConstraint();
                    }}
                    placeholder="输入约束描述"
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newConstraintHard}
                    onChange={(e) => setNewConstraintHard(e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  硬约束
                </label>
                <button
                  type="button"
                  onClick={addConstraint}
                  className="h-9 px-3 rounded-lg bg-primary/20 text-xs text-primary hover:bg-primary/30"
                >
                  添加
                </button>
              </div>
            </>
          )}

          {step === 'authorization' && (
            <>
              <p className="text-[11px] text-slate-400">
                定义 Agent 可自主执行的动作和需要确认的动作。
              </p>
              <div>
                <label className="text-[10px] text-green-400 mb-1 block">可自主执行</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {authorization.autoExecute.map((a, i) => (
                    <span
                      key={`${i}-${a}`}
                      className="text-[9px] px-2 py-1 rounded bg-green-400/10 text-green-300 border border-green-400/20 flex items-center gap-1"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() =>
                          setAuthorization({
                            ...authorization,
                            autoExecute: authorization.autoExecute.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        <Icon name="close" size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newAutoExec}
                    onChange={(e) => setNewAutoExec(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') addAutoExec();
                    }}
                    placeholder="例：缓存刷新、日志清理"
                    className="flex-1 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={addAutoExec}
                    className="h-8 px-3 rounded-lg bg-green-400/20 text-[10px] text-green-300 hover:bg-green-400/30"
                  >
                    添加
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-orange-400 mb-1 block">需要确认</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {authorization.requireOwner.map((a, i) => (
                    <span
                      key={`${i}-${a}`}
                      className="text-[9px] px-2 py-1 rounded bg-orange-400/10 text-orange-300 border border-orange-400/20 flex items-center gap-1"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() =>
                          setAuthorization({
                            ...authorization,
                            requireOwner: authorization.requireOwner.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        <Icon name="close" size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newRequireOwner}
                    onChange={(e) => setNewRequireOwner(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') addRequireOwner();
                    }}
                    placeholder="例：预算超支、人员变更"
                    className="flex-1 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={addRequireOwner}
                    className="h-8 px-3 rounded-lg bg-orange-400/20 text-[10px] text-orange-300 hover:bg-orange-400/30"
                  >
                    添加
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'criteria' && (
            <>
              <p className="text-[11px] text-slate-400">
                定义可衡量的成功标准，Agent 会持续追踪进度。
              </p>
              {criteria.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 block truncate">{c.metric}</span>
                    <span className="text-[9px] text-slate-500">
                      目标: {c.target} · 方法: {c.measureMethod}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCriteria(criteria.filter((_, idx) => idx !== i))}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    placeholder="指标名称"
                    className="flex-1 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                  <input
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="目标值"
                    className="w-24 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    value={newMeasure}
                    onChange={(e) => setNewMeasure(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') addCriteria();
                    }}
                    placeholder="度量方式（可选）"
                    className="flex-1 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={addCriteria}
                    className="h-8 px-3 rounded-lg bg-primary/20 text-[10px] text-primary hover:bg-primary/30"
                  >
                    添加
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <span className="text-[10px] text-slate-500 block mb-1">意图</span>
                <p className="text-xs text-slate-200">{intent || '（未填写）'}</p>
              </div>
              {constraints.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-[10px] text-slate-500 block mb-1">
                    约束 ({constraints.length})
                  </span>
                  {constraints.map((c) => (
                    <p key={c.id} className="text-[11px] text-slate-300">
                      • {c.description} {c.hardLimit ? '(硬)' : '(软)'}
                    </p>
                  ))}
                </div>
              )}
              {(authorization.autoExecute.length > 0 || authorization.requireOwner.length > 0) && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-[10px] text-slate-500 block mb-1">授权</span>
                  {authorization.autoExecute.length > 0 && (
                    <p className="text-[11px] text-green-300">
                      自动: {authorization.autoExecute.join(', ')}
                    </p>
                  )}
                  {authorization.requireOwner.length > 0 && (
                    <p className="text-[11px] text-orange-300">
                      需确认: {authorization.requireOwner.join(', ')}
                    </p>
                  )}
                </div>
              )}
              {criteria.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-[10px] text-slate-500 block mb-1">
                    成功标准 ({criteria.length})
                  </span>
                  {criteria.map((c) => (
                    <p key={c.id} className="text-[11px] text-slate-300">
                      • {c.metric}: {c.target}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={currentStepIdx > 0 ? handlePrev : onClose}
            className="h-8 px-4 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/[0.06]"
          >
            {currentStepIdx > 0 ? '上一步' : '取消'}
          </button>
          {step === 'review' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!intent.trim() || submitting}
              className="h-8 px-5 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {submitting ? '创建中...' : '确认创建'}
              {!submitting && <Icon name="check" size={14} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 'intent' && !intent.trim()}
              className="h-8 px-4 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              下一步
              <Icon name="arrow_forward" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
