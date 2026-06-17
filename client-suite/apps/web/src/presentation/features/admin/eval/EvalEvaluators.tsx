import { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { evalApi } from '../../../../application/services/adminApi';
import type { EvalEvaluator, EvalDimension, RuleConfigItem, JudgeConfig } from '../../../../application/services/adminApi';
import { Icon } from '../../../components/ui/Icon';

/* ──── 常量 ──── */

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  rule_based: { label: '规则评估', color: 'bg-blue-50 text-blue-600', icon: 'rule' },
  llm_judge: { label: 'LLM 评判', color: 'bg-purple-50 text-purple-600', icon: 'psychology' },
  hybrid: { label: '混合评估', color: 'bg-amber-50 text-amber-600', icon: 'merge_type' },
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const DEFAULT_JUDGE_PROMPT = `你是一个严格的数字员工任务评审官。请根据以下评分标准评判该任务的执行质量。

## 任务描述
{taskDescription}

{expectedBehavior}

## 最终输出
{actualOutput}

请严格按照上述标准打分。输出 JSON 格式：
{OUTPUT_FORMAT}`;

/* ──── Prompt 模板输出格式同步 ──── */

/** 根据维度列表生成输出格式 JSON 行 */
function generateOutputFormat(dimensions: EvalDimension[]): string {
  if (dimensions.length === 0) return '{}';
  if (dimensions.length === 1) {
    // 单维度 → 输出 score + reasoning 格式
    return `{"score": <0.0-1.0>, "reasoning": "<评分原因>"}`;
  }
  // 多维度 → 输出各维度分 + comment + top_issue
  const dimFields = dimensions.map((d) => `"${d.key}": <1-5>`).join(', ');
  return `{${dimFields}, "comment": "<一句话评价>", "top_issue": "<最需要改进的一点>"}`;
}

/** 输出格式标记 — 用于在 Prompt 中定位和替换 */
const OUTPUT_FORMAT_MARKER = '{OUTPUT_FORMAT}';

/** 在 Prompt 模板中同步输出格式 */
function syncOutputFormatInPrompt(prompt: string, dimensions: EvalDimension[]): string {
  const outputFormat = generateOutputFormat(dimensions);
  // 如果包含标记，直接替换
  if (prompt.includes(OUTPUT_FORMAT_MARKER)) {
    return prompt.replace(OUTPUT_FORMAT_MARKER, outputFormat);
  }
  // 如果包含 "输出 JSON 格式" 行，替换该行
  const formatLineRegex = /输出 JSON 格式[：:]\s*\n?.*$/s;
  if (formatLineRegex.test(prompt)) {
    return prompt.replace(formatLineRegex, `输出 JSON 格式：\n${outputFormat}`);
  }
  // 否则追加到末尾
  return `${prompt}\n\n输出 JSON 格式：\n${outputFormat}`;
}

/* ──── 主组件 ──── */

export function EvalEvaluators() {
  const [evaluators, setEvaluators] = useState<EvalEvaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState<EvalEvaluator | null>(null);

  const loadEvaluators = useCallback(() => {
    evalApi.listEvaluators(filterType ? { type: filterType } : undefined)
      .then((r) => setEvaluators(r.evaluators))
      .catch(() => setEvaluators([]))
      .finally(() => setLoading(false));
  }, [filterType]);

  useEffect(() => { loadEvaluators(); }, [loadEvaluators]);

  const openCreate = () => { setSelectedEvaluator(null); setDrawerOpen(true); };
  const openDetail = (ev: EvalEvaluator) => { setSelectedEvaluator(ev); setDrawerOpen(true); };
  const handleClose = () => { setDrawerOpen(false); setSelectedEvaluator(null); };

  return (
    <div className="p-6 space-y-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">评估器</h2>
          <p className="text-xs text-gray-400 mt-0.5">配置评测维度、评判规则与 LLM Judge 模板</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadEvaluators} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新"><Icon name="refresh" size={16} /></button>
          <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors flex items-center gap-1">
            <Icon name="add" size={16} /> 创建评估器
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-1.5">
        {[{ key: '', label: '全部' }, ...Object.entries(TYPE_META).map(([k, v]) => ({ key: k, label: v.label }))].map((f) => (
          <button key={f.key} onClick={() => setFilterType(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === f.key ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 表格 */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : evaluators.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <Icon name="psychology" size={28} className="mb-2 text-gray-300" />
          <span className="text-sm">暂无评估器</span>
          <span className="text-xs mt-1">点击右上角「创建评估器」开始</span>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">评估器</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">维度</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">阈值</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {evaluators.map((ev) => {
                const meta = TYPE_META[ev.type] ?? TYPE_META.rule_based;
                return (
                  <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => openDetail(ev)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-800">{ev.name}</div>
                      {ev.description && <div className="text-xs text-gray-400 line-clamp-1">{ev.description}</div>}
                    </td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${meta.color}`}>{meta.label}</span></td>
                    <td className="px-4 py-2.5 text-gray-600">{ev.dimensions.length} 个</td>
                    <td className="px-4 py-2.5"><span className={`font-semibold ${ev.threshold >= 0.8 ? 'text-green-600' : ev.threshold >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>{(ev.threshold * 100).toFixed(0)}%</span></td>
                    <td className="px-4 py-2.5"><span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[ev.status] || 'bg-gray-100 text-gray-500'}`}>{ev.status === 'active' ? '活跃' : ev.status}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`确认删除「${ev.name}」？`)) return; await evalApi.deleteEvaluator(ev.id); loadEvaluators(); }} className="text-gray-400 hover:text-red-500"><Icon name="delete_outline" size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 评估器抽屉 — 使用共享 Drawer 组件 */}
      <EvaluatorDrawer
        open={drawerOpen}
        evaluator={selectedEvaluator}
        onSaved={() => { handleClose(); loadEvaluators(); }}
        onClose={handleClose}
      />
    </div>
  );
}

/* ──── 评估器抽屉 ──── */

function EvaluatorDrawer({ open, evaluator, onSaved, onClose }: {
  open: boolean; evaluator: EvalEvaluator | null; onSaved: () => void; onClose: () => void;
}) {
  const isView = !!evaluator;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'rule_based' | 'llm_judge' | 'hybrid'>('llm_judge');
  const [dimensions, setDimensions] = useState<EvalDimension[]>([
    { key: 'accuracy', label: '准确性', weight: 0.3 },
    { key: 'completeness', label: '完整性', weight: 0.25 },
    { key: 'relevance', label: '相关性', weight: 0.25 },
    { key: 'conciseness', label: '简洁性', weight: 0.2 },
  ]);
  const [rules, setRules] = useState<RuleConfigItem[]>([]);
  const [judgeConfig, setJudgeConfig] = useState<JudgeConfig>({ model: 'gpt-4o', temperature: 0.1, maxTokens: 500, promptTemplate: DEFAULT_JUDGE_PROMPT });
  const [threshold, setThreshold] = useState(0.75);
  const [submitting, setSubmitting] = useState(false);
  const [promptManuallyEdited, setPromptManuallyEdited] = useState(false);

  // 维度变化时自动同步 Prompt 中的输出格式（仅当用户未手动编辑过 Prompt 时）
  const handleDimensionChange = (newDimensions: EvalDimension[]) => {
    setDimensions(newDimensions);
    if (!promptManuallyEdited && (type === 'llm_judge' || type === 'hybrid')) {
      const synced = syncOutputFormatInPrompt(judgeConfig.promptTemplate, newDimensions);
      setJudgeConfig({ ...judgeConfig, promptTemplate: synced });
    }
  };

  // prop 变化时重置表单
  const [prevKey, setPrevKey] = useState({ open, id: evaluator?.id });
  if (open !== prevKey.open || evaluator?.id !== prevKey.id) {
    setPrevKey({ open, id: evaluator?.id });
    if (evaluator) {
      setName(evaluator.name);
      setDescription(evaluator.description ?? '');
      setType(evaluator.type);
      setDimensions(evaluator.dimensions);
      setRules(evaluator.ruleConfig ?? []);
      setJudgeConfig(evaluator.judgeConfig ?? { model: 'gpt-4o', temperature: 0.1, maxTokens: 500, promptTemplate: DEFAULT_JUDGE_PROMPT });
      setThreshold(evaluator.threshold);
    } else {
      setName('');
      setDescription('');
      setType('llm_judge');
      setDimensions([
        { key: 'accuracy', label: '准确性', weight: 0.3 },
        { key: 'completeness', label: '完整性', weight: 0.25 },
        { key: 'relevance', label: '相关性', weight: 0.25 },
        { key: 'conciseness', label: '简洁性', weight: 0.2 },
      ]);
      setRules([]);
      setJudgeConfig({ model: 'gpt-4o', temperature: 0.1, maxTokens: 500, promptTemplate: DEFAULT_JUDGE_PROMPT });
      setThreshold(0.75);
    }
    setSubmitting(false);
    setPromptManuallyEdited(false);
  }

  const totalDimWeight = dimensions.reduce((s, d) => s + d.weight, 0);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, type, dimensions, ruleConfig: type === 'rule_based' || type === 'hybrid' ? rules : undefined, judgeConfig: type === 'llm_judge' || type === 'hybrid' ? judgeConfig : undefined, threshold };
      if (evaluator) { await evalApi.updateEvaluator(evaluator.id, payload); }
      else { await evalApi.createEvaluator(payload); }
      onSaved();
    } finally { setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title={isView ? '评估器详情' : '创建评估器'} width="w-[520px]">
      <div className="space-y-5">
        {/* 类型切换 */}
        {!isView && (
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {(Object.entries(TYPE_META) as [string, typeof TYPE_META.rule_based][]).map(([key, meta]) => (
              <button key={key} onClick={() => { setType(key as typeof type); setPromptManuallyEdited(false); }} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${type === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon name={meta.icon} size={13} /> {meta.label}
              </button>
            ))}
          </div>
        )}
        {isView && evaluator && (
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${TYPE_META[evaluator.type]?.color ?? ''}`}>{TYPE_META[evaluator.type]?.label ?? evaluator.type}</span>
        )}

        {/* 基本信息 */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">名称</label>
            {isView ? <div className="text-sm text-gray-800">{evaluator?.name}</div> : <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：通用语义评判器" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" autoFocus />}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">描述</label>
            {isView ? <div className="text-xs text-gray-500">{evaluator?.description || '—'}</div> : <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="评估器的用途说明" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" />}
          </div>
        </div>

        {/* 维度 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500">评估维度</label>
            {!isView && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${Math.abs(totalDimWeight - 1) < 0.01 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>合计 {(totalDimWeight * 100).toFixed(0)}%</span>}
          </div>
          <div className="space-y-2">
            {dimensions.map((dim, i) => (
              <div key={`${dim.key}-${i}`} className="flex items-center gap-2">
                {isView ? (
                  <>
                    <span className="text-xs text-gray-600 w-20">{dim.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-[#007AFF]" style={{ width: `${dim.weight * 100}%` }} /></div>
                    <span className="text-[11px] font-semibold text-gray-500 w-10 text-right">{(dim.weight * 100).toFixed(0)}%</span>
                  </>
                ) : (
                  <>
                    <input value={dim.key} onChange={(e) => { const u = [...dimensions]; u[i] = { ...u[i], key: e.target.value }; handleDimensionChange(u); }} placeholder="key" className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" />
                    <input value={dim.label} onChange={(e) => { const u = [...dimensions]; u[i] = { ...u[i], label: e.target.value }; handleDimensionChange(u); }} placeholder="标签" className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                    <input type="range" min={0.05} max={0.6} step={0.05} value={dim.weight} onChange={(e) => { const u = [...dimensions]; u[i] = { ...u[i], weight: +e.target.value }; handleDimensionChange(u); }} className="flex-1" />
                    <span className="text-[11px] font-semibold w-8 text-right">{(dim.weight * 100).toFixed(0)}%</span>
                    {dimensions.length > 1 && <button onClick={() => handleDimensionChange(dimensions.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Icon name="close" size={13} /></button>}
                  </>
                )}
              </div>
            ))}
            {!isView && <button onClick={() => handleDimensionChange([...dimensions, { key: `dim_${dimensions.length + 1}`, label: '', weight: 0.2 }])} className="text-xs text-[#007AFF] hover:underline flex items-center gap-0.5"><Icon name="add" size={13} /> 添加维度</button>}
          </div>
        </div>

        {/* 类型配置 */}
        {(type === 'rule_based' || type === 'hybrid') && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">匹配规则</label>
            {isView && evaluator?.ruleConfig ? (
              <div className="space-y-1">{(evaluator.ruleConfig as RuleConfigItem[]).map((rule, i) => (
                <div key={i} className="px-3 py-1.5 rounded-lg bg-gray-50 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-semibold">
                      {rule.type === 'exact_match' ? '精确' : rule.type === 'contains' ? '包含' : rule.type === 'regex' ? '正则' : rule.type === 'json_path_match' ? 'JSON路径' : '执行函数'}
                    </span>
                    {rule.type === 'script' && rule.language && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-semibold">{rule.language === 'python' ? 'Python' : 'JavaScript'}</span>
                    )}
                    <span className="text-gray-400 ml-auto">{(rule.weight * 100).toFixed(0)}%</span>
                  </div>
                  {rule.type === 'script' ? (
                    <pre className="font-mono text-gray-600 text-[10px] leading-relaxed whitespace-pre-wrap max-h-[80px] overflow-y-auto">{rule.value}</pre>
                  ) : (
                    <span className="font-mono text-gray-600 truncate block">{rule.value || '(通配)'}</span>
                  )}
                </div>
              ))}</div>
            ) : !isView ? (
              <div className="space-y-2">
                {rules.map((rule, i) => (
                  <div key={`${rule.type}-${i}`} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <select value={rule.type} onChange={(e) => {
                        const u = [...rules];
                        const newType = e.target.value as RuleConfigItem['type'];
                        u[i] = { ...u[i], type: newType, ...(newType === 'script' && !u[i].language ? { language: 'javascript' } : {}) };
                        setRules(u);
                      }} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                        <option value="exact_match">精确</option>
                        <option value="contains">包含</option>
                        <option value="regex">正则</option>
                        <option value="json_path_match">JSON路径</option>
                        <option value="script">执行函数</option>
                      </select>
                      {rule.type === 'script' && (
                        <select value={rule.language ?? 'javascript'} onChange={(e) => { const u = [...rules]; u[i] = { ...u[i], language: e.target.value as 'python' | 'javascript' }; setRules(u); }} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                        </select>
                      )}
                      <input type="number" min={0.1} max={1} step={0.1} value={rule.weight} onChange={(e) => { const u = [...rules]; u[i] = { ...u[i], weight: +e.target.value }; setRules(u); }} className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                      <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Icon name="close" size={13} /></button>
                    </div>
                    {rule.type === 'script' ? (
                      <div>
                        <textarea value={rule.value} onChange={(e) => { const u = [...rules]; u[i] = { ...u[i], value: e.target.value }; setRules(u); }}
                          placeholder={rule.language === 'python'
                            ? 'def evaluate(ctx):\n    # ctx: {taskDescription, expectedBehavior, expectedOutput, actualOutput, toolCallsLog}\n    return "关键词" in ctx["actualOutput"]'
                            : 'function evaluate(ctx) {\n  // ctx: {taskDescription, expectedBehavior, expectedOutput, actualOutput, toolCallsLog}\n  return ctx.actualOutput.includes("关键词");\n}'
                          }
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] min-h-[80px]"
                          rows={5}
                        />
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {rule.language === 'python'
                            ? '可用内置库：json, re, math, collections, datetime, os.environ["EVAL_CTX"]'
                            : '可用内置库：JSON, RegExp, Math, Date, Array, String, Object'
                          }
                        </p>
                      </div>
                    ) : (
                      <input value={rule.value} onChange={(e) => { const u = [...rules]; u[i] = { ...u[i], value: e.target.value }; setRules(u); }} placeholder="匹配值" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" />
                    )}
                  </div>
                ))}
                <button onClick={() => setRules([...rules, { type: 'contains', field: 'output', value: '', weight: 0.5 }])} className="text-xs text-[#007AFF] hover:underline flex items-center gap-0.5"><Icon name="add" size={13} /> 添加规则</button>
                <button onClick={() => setRules([...rules, { type: 'script', field: 'output', value: '', weight: 0.5, language: 'javascript' }])} className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5 ml-2"><Icon name="code" size={13} /> 添加执行函数</button>
              </div>
            ) : null}
          </div>
        )}

        {(type === 'llm_judge' || type === 'hybrid') && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">LLM Judge</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '模型', key: 'model' as const, val: String(judgeConfig.model), opts: [{ v: 'gpt-4o', l: 'GPT-4o' }, { v: 'gpt-4o-mini', l: 'GPT-4o Mini' }, { v: 'claude-sonnet-4-6', l: 'Claude Sonnet' }, { v: 'qwen-max', l: '通义千问' }, { v: 'deepseek-chat', l: 'DeepSeek' }] },
                { label: 'Temperature', key: 'temperature' as const, val: String(judgeConfig.temperature) },
                { label: 'Max Tokens', key: 'maxTokens' as const, val: String(judgeConfig.maxTokens) },
              ].map((f) => (
                <div key={f.key}>
                  <div className="text-[10px] text-gray-400 mb-1">{f.label}</div>
                  {isView ? <div className="text-xs font-semibold text-gray-700">{f.val}</div> : f.opts ? (
                    <select value={String(judgeConfig[f.key])} onChange={(e) => setJudgeConfig({ ...judgeConfig, [f.key]: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">{f.opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                  ) : (
                    <input type="number" step={f.key === 'temperature' ? 0.05 : 100} min={0} value={judgeConfig[f.key]} onChange={(e) => setJudgeConfig({ ...judgeConfig, [f.key]: +e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="text-[10px] text-gray-400 mb-1">Prompt 模板</div>
              {isView && evaluator?.judgeConfig ? (
                <details><summary className="text-[11px] text-[#007AFF] cursor-pointer hover:underline">查看</summary><pre className="mt-1 p-3 rounded-lg bg-gray-900 text-gray-300 text-[10px] leading-relaxed overflow-x-auto max-h-[200px] overflow-y-auto">{(evaluator.judgeConfig as JudgeConfig).promptTemplate}</pre></details>
              ) : !isView ? (
                <><textarea value={judgeConfig.promptTemplate} onChange={(e) => { setPromptManuallyEdited(true); setJudgeConfig({ ...judgeConfig, promptTemplate: e.target.value }); }} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={5} /><p className="text-[9px] text-gray-400 mt-0.5">变量：{'{taskDescription}'} {'{expectedBehavior}'} {'{actualOutput}'} {'{OUTPUT_FORMAT}'}（输出格式标记，随维度自动同步）</p></>
              ) : null}
            </div>
          </div>
        )}

        {/* 阈值 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">通过阈值</label>
          <div className="flex items-center gap-3">
            {isView ? (
              <>
                <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden"><div className={`h-full rounded-full ${threshold >= 0.8 ? 'bg-green-500' : threshold >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${threshold * 100}%` }} /></div>
                <span className="text-sm font-bold text-gray-700">{(threshold * 100).toFixed(0)}%</span>
              </>
            ) : (
              <>
                <input type="range" min={0.3} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="flex-1" />
                <span className="text-sm font-bold" style={{ color: threshold >= 0.8 ? '#34C759' : threshold >= 0.6 ? '#FF9500' : '#FF3B30' }}>{(threshold * 100).toFixed(0)}%</span>
              </>
            )}
          </div>
        </div>

        {/* 操作 */}
        {!isView && (
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">取消</button>
            <button onClick={handleSubmit} disabled={!name.trim() || submitting} className="px-4 py-1.5 bg-[#007AFF] text-white text-sm rounded-lg hover:bg-[#0066DD] disabled:opacity-50">{submitting ? '创建中…' : '创建'}</button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
