import { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Modal } from '../../../components/ui/Modal';
import { evalApi } from '../../../../application/services/adminApi';
import type { EvalSuite, EvalCase } from '../../../../application/services/adminApi';
import { useAdminStore } from '../../../../application/stores/adminStore';
import { Icon } from '../../../components/ui/Icon';

/* ──── 常量 ──── */

const CONFIG_TYPE_META: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  ideal_output: { label: '理想输出', color: 'bg-blue-50 text-blue-600', icon: 'check_circle', desc: '验证 Agent 输出与预定义期望是否一致' },
  workflow: { label: '工作流', color: 'bg-purple-50 text-purple-600', icon: 'account_tree', desc: '验证 Agent 执行流程、工具调用路径与轨迹推理' },
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  retired: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-100 text-gray-500',
};

const EVAL_TYPE_LABELS: Record<string, string> = {
  exact_match: '精确匹配',
  structured_match: '结构匹配',
  behavioral: '行为验证',
  safety_check: '安全边界',
  llm_judge: 'LLM 评判',
  f1_score: 'F1 分数',
  trajectory: '轨迹验证',
};

type CreateDrawerOpen = boolean;

/* ──── 主组件 ──── */

export function EvalSuites() {
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState<CreateDrawerOpen>(false);
  const navigateToSuiteDetail = useAdminStore((s) => s.navigateToSuiteDetail);

  const loadSuites = useCallback(() => {
    evalApi.listSuites().then((r) => setSuites(r.suites)).catch(() => setSuites([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSuites(); }, [loadSuites]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">评测集</h2>
          <p className="text-xs text-gray-400 mt-0.5">按配置类型组织评估基准，约束用例字段和评测方式</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadSuites} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新"><Icon name="refresh" size={16} /></button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors flex items-center gap-1">
            <Icon name="add" size={16} /> 新建评测集
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : suites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <Icon name="checklist" size={28} className="mb-2 text-gray-300" />
          <span className="text-sm">暂无评测集</span>
          <span className="text-xs mt-1">点击右上角「新建评测集」开始</span>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">评测集</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">配置类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">用例数</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">版本</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">更新时间</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {suites.map((suite) => {
                const meta = CONFIG_TYPE_META[suite.configType] ?? CONFIG_TYPE_META.ideal_output;
                return (
                  <tr key={suite.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigateToSuiteDetail(suite.id)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-800">{suite.name}</div>
                      {suite.description && <div className="text-xs text-gray-400 line-clamp-1">{suite.description}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${meta.color}`}>
                        <Icon name={meta.icon} size={11} /> {meta.label}
                      </span>
                      {suite.evalType && (
                        <span className="ml-1 inline-flex px-2 py-0.5 text-xs rounded-full font-medium bg-indigo-50 text-indigo-600">
                          {EVAL_TYPE_LABELS[suite.evalType] ?? suite.evalType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{suite.totalCases}</td>
                    <td className="px-4 py-2.5 text-gray-600">v{suite.version}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[suite.status] || 'bg-gray-100 text-gray-500'}`}>
                        {suite.status === 'active' ? '活跃' : suite.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(suite.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`确认删除「${suite.name}」？`)) return; await evalApi.deleteSuite(suite.id); loadSuites(); }} className="text-gray-400 hover:text-red-500"><Icon name="delete_outline" size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SuiteCreateDrawer open={showCreate} onCreated={(id) => { setShowCreate(false); navigateToSuiteDetail(id); loadSuites(); }} onClose={() => setShowCreate(false)} />
    </div>
  );
}

/* ──── 创建评测集抽屉 ──── */

function SuiteCreateDrawer({ open, onCreated, onClose }: { open: boolean; onCreated: (id: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [configType, setConfigType] = useState<'ideal_output' | 'workflow'>('ideal_output');
  const [evalType, setEvalType] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // 当 configType 变更时，自动选中第一个 evalType
  const handleConfigTypeChange = (ct: 'ideal_output' | 'workflow') => {
    setConfigType(ct);
    setEvalType(CASE_TYPE_BY_CONFIG[ct][0].value);
  };

  // 初始化默认 evalType
  const availableEvalTypes = CASE_TYPE_BY_CONFIG[configType] ?? CASE_TYPE_BY_CONFIG.ideal_output;
  if (!evalType || !availableEvalTypes.some((t) => t.value === evalType)) {
    setEvalType(availableEvalTypes[0].value);
  }

  const handleSubmit = async () => {
    if (!name.trim() || !evalType) return;
    setSubmitting(true);
    try {
      const suite = await evalApi.createSuite({ name: name.trim(), description: description.trim() || undefined, configType, evalType });
      onCreated(suite.id);
    } finally { setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="新建评测集" width="w-[460px]">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：理想输出评测集 v1" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" autoFocus />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">描述</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="评测集的用途说明" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={3} />
        </div>

        {/* 配置类型二选一 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">配置类型 *</label>
          <div className="space-y-2">
            {(Object.entries(CONFIG_TYPE_META) as [string, typeof CONFIG_TYPE_META.ideal_output][]).map(([key, meta]) => (
              <button key={key} onClick={() => handleConfigTypeChange(key as typeof configType)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${configType === key ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${configType === key ? 'bg-[#007AFF]/10' : 'bg-gray-100'}`}>
                  <Icon name={meta.icon} size={18} className={configType === key ? 'text-[#007AFF]' : 'text-gray-400'} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${configType === key ? 'text-[#007AFF]' : 'text-gray-800'}`}>{meta.label}</span>
                  <div className="text-xs text-gray-500 mt-0.5">{meta.desc}</div>
                </div>
                {configType === key && <Icon name="check_circle" size={16} className="text-[#007AFF] mt-1 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* 评测类型选择 — 由 configType 约束 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">评测类型 * <span className="text-gray-400">（锁定后用例只能使用此类型）</span></label>
          <div className={availableEvalTypes.length <= 2 ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-3 gap-1.5'}>
            {availableEvalTypes.map((opt) => (
              <button key={opt.value} onClick={() => setEvalType(opt.value)}
                className={`px-3 py-2 rounded-lg border text-left transition-colors ${evalType === opt.value ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                <div className="flex items-center gap-1.5">
                  <Icon name={opt.icon} size={13} className={evalType === opt.value ? 'text-[#007AFF]' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${evalType === opt.value ? 'text-[#007AFF]' : 'text-gray-700'}`}>{opt.label}</span>
                  {opt.recommended && <span className="text-[9px] px-1 py-0 rounded bg-[#007AFF]/10 text-[#007AFF] font-semibold">推荐</span>}
                </div>
                <div className="text-[10px] text-gray-400 leading-tight mt-0.5 ml-5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || !evalType || submitting} className="px-4 py-1.5 bg-[#007AFF] text-white text-sm rounded-lg hover:bg-[#0066DD] disabled:opacity-50">{submitting ? '创建中…' : '创建'}</button>
        </div>
      </div>
    </Drawer>
  );
}

/* ──── 用例类型选项 — 根据 configType 约束 ──── */

const CASE_TYPE_BY_CONFIG: Record<string, Array<{ value: string; label: string; desc: string; icon: string; recommended?: boolean }>> = {
  ideal_output: [
    { value: 'exact_match', label: '精确输出', desc: '验证输出与期望值完全一致', icon: 'check_circle' },
    { value: 'structured_match', label: '结构输出', desc: '验证 JSON 等结构化输出的字段完整性', icon: 'data_object' },
    { value: 'f1_score', label: '检索召回', desc: '验证检索结果的精确率与召回率', icon: 'query_stats' },
  ],
  workflow: [
    { value: 'behavioral', label: '行为验证', desc: '验证 Agent 执行流程与工具调用是否符合预期', icon: 'psychology', recommended: true },
    { value: 'trajectory', label: '轨迹验证', desc: '验证 Agent 推理路径和决策选择是否合理', icon: 'route' },
    { value: 'safety_check', label: '安全边界', desc: '验证 Agent 是否拒绝越权/注入等危险请求', icon: 'shield' },
  ],
};

const CATEGORY_TREE: Record<string, string[]> = {
  '客服问答': ['工单-查询', 'FAQ-查询', '邮件-查询', '邮件-撰写', '会议-创建', '文档-摘要', '文档-写入', '待办-创建', '每日简报'],
  'DevOps 运维': ['流水线-查询', '部署', '部署-状态', '日志查看', '代码搜索'],
  'OA/审批': ['差旅', 'OKR', '审批查询', '审批处理'],
  知识检索: ['云产品文档', '知识库管理', '运维知识'],
  安全边界: ['越权-读取', '越权-写入', '数据泄露', '指令注入', '危险操作', 'PII保护', '能力边界'],
  异常处理: ['工具不可用', '模糊指令', '权限不足', '无效输入'],
};

const CATEGORY_ABBR: Record<string, string> = {
  '客服问答': 'CS', 'DevOps 运维': 'DEV', 'OA/审批': 'OA', 知识检索: 'KB', 安全边界: 'SAFE', 异常处理: 'ERROR',
};

/* ──── 用例表单弹窗 ──── */

export function CaseFormModal({ suiteId, suiteConfigType, suiteEvalType, caseData, existingCount, onSaved, onClose }: {
  suiteId: string; suiteConfigType: 'ideal_output' | 'workflow'; suiteEvalType?: string; caseData: EvalCase | null; existingCount: number; onSaved: () => void; onClose: () => void;
}) {
  const isEdit = !!caseData;
  const allowedTypes = CASE_TYPE_BY_CONFIG[suiteConfigType] ?? CASE_TYPE_BY_CONFIG.ideal_output;
  const defaultEvalType = suiteEvalType ?? allowedTypes[0].value;

  const [category, setCategory] = useState(caseData?.category ?? '');
  const [subcategory, setSubcategory] = useState(caseData?.subcategory ?? '');
  const [evalType, setEvalType] = useState(caseData?.evalType ?? defaultEvalType);
  const [userInput, setUserInput] = useState(caseData?.taskDescription ?? '');
  const [expectedBehavior, setExpectedBehavior] = useState(caseData?.expectedBehavior ?? '');
  const [expectedTools, setExpectedTools] = useState(caseData?.expectedTools ? (caseData.expectedTools as string[]).join('\n') : '');
  const [expectedOutput, setExpectedOutput] = useState(caseData?.expectedOutput ? JSON.stringify(caseData.expectedOutput, null, 2) : '');
  const [expectedTrajectory, setExpectedTrajectory] = useState(caseData?.expectedTrajectory ?? '');
  const [submitting, setSubmitting] = useState(false);

  const subcategories = category ? (CATEGORY_TREE[category] ?? []) : [];
  const abbr = CATEGORY_ABBR[category] ?? 'CASE';
  const subAbbr = subcategory ? subcategory.replace(/[^a-zA-Z一-鿿]/g, '').slice(0, 6).toUpperCase() : '';
  const seq = String(existingCount + 1).padStart(3, '0');
  const generatedKey = subcategory ? `${abbr}-${subAbbr}-${seq}` : `${abbr}-${seq}`;

  const isTrajectory = evalType === 'trajectory';

  const handleSubmit = async () => {
    if (!category || !userInput) return;
    setSubmitting(true);
    try {
      const parsedOutput = expectedOutput.trim() ? (() => { try { return JSON.parse(expectedOutput); } catch { return expectedOutput; } })() : undefined;
      const payload: Record<string, unknown> = {
        category,
        subcategory: subcategory || undefined,
        taskDescription: userInput,
        evalType,
        expectedOutput: parsedOutput,
      };

      if (suiteConfigType === 'workflow') {
        if (isTrajectory) {
          payload.expectedTrajectory = expectedTrajectory || undefined;
        } else {
          payload.expectedBehavior = expectedBehavior || undefined;
          payload.expectedTools = expectedTools ? expectedTools.split('\n').map((t) => t.trim()).filter(Boolean) : undefined;
        }
      }

      if (isEdit) {
        await evalApi.updateCase(caseData!.id, payload);
      } else {
        await evalApi.createCase({ suiteId, caseKey: generatedKey, ...payload } as Parameters<typeof evalApi.createCase>[0]);
      }
      onSaved();
    } finally { setSubmitting(false); }
  };

  // 当 evalType 切换时清空特有字段
  const handleEvalTypeChange = (newType: string) => {
    setEvalType(newType);
    if (newType !== 'trajectory') {
      // 切回 behavioral/safety_check 时不自动清空，保留用户输入
    }
  };

  const canSubmit = (() => {
    if (!category || !userInput || submitting) return false;
    if (suiteConfigType === 'ideal_output' && !expectedOutput.trim()) return false;
    if (suiteConfigType === 'workflow') {
      if (isTrajectory && !expectedTrajectory.trim()) return false;
      if (!isTrajectory && !expectedBehavior.trim()) return false;
    }
    return true;
  })();

  return (
    <Modal open onClose={onClose} title={isEdit ? '编辑用例' : '添加用例'} width="max-w-2xl">
      <div className="space-y-4">
        {/* 配置类型指示 */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CONFIG_TYPE_META[suiteConfigType].color}`}>
            <Icon name={CONFIG_TYPE_META[suiteConfigType].icon} size={11} /> {CONFIG_TYPE_META[suiteConfigType].label}
          </span>
          <span className="text-xs text-gray-400">{CONFIG_TYPE_META[suiteConfigType].desc}</span>
        </div>

        {/* 用户输入 */}
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">用户输入 * <span className="text-gray-400">（用户对 Agent 说的话）</span></label>
          <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="例：帮我看看今天有没有未读邮件" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={3} autoFocus />
        </div>

        {/* 场景/子场景 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">场景 *</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">选择…</option>
              {Object.keys(CATEGORY_TREE).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">子场景</label>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white disabled:bg-gray-50">
              <option value="">选择…</option>
              {subcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
        </div>

        {/* 用例类型 — 锁定时只展示标签，未锁定时允许选择 */}
        {suiteEvalType ? (
          <div className="text-xs text-gray-400">评测类型：<span className="font-medium text-gray-600">{EVAL_TYPE_LABELS[suiteEvalType] ?? suiteEvalType}</span> <span className="text-gray-300">（已由评测集锁定）</span></div>
        ) : allowedTypes.length > 1 ? (
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">用例类型</label>
            <div className={allowedTypes.length <= 2 ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-3 gap-1.5'}>
              {allowedTypes.map((opt) => (
                <button key={opt.value} onClick={() => handleEvalTypeChange(opt.value)}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${evalType === opt.value ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <Icon name={opt.icon} size={13} className={evalType === opt.value ? 'text-[#007AFF]' : 'text-gray-400'} />
                    <span className={`text-xs font-medium ${evalType === opt.value ? 'text-[#007AFF]' : 'text-gray-700'}`}>{opt.label}</span>
                    {opt.recommended && <span className="text-[9px] px-1 py-0 rounded bg-[#007AFF]/10 text-[#007AFF] font-semibold">推荐</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 leading-tight mt-0.5 ml-5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400">用例类型：<span className="font-medium text-gray-600">{allowedTypes[0].label}</span></div>
        )}

        {/* ── 工作流专用字段 — 根据 evalType 切换 ── */}

        {/* 行为验证：期望行为 + 预期工具 */}
        {suiteConfigType === 'workflow' && !isTrajectory && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">期望行为 * <span className="text-gray-400">（Agent 应执行的步骤）</span></label>
              <textarea value={expectedBehavior} onChange={(e) => setExpectedBehavior(e.target.value)} placeholder={"1. 调用邮件查询工具\n2. 按重要性排序\n3. 输出摘要"} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={3} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">预期调用工具 <span className="text-gray-400">（每行一个）</span></label>
              <textarea value={expectedTools} onChange={(e) => setExpectedTools(e.target.value)} placeholder="email_tool.list_mails" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={2} />
            </div>
          </>
        )}

        {/* 轨迹验证：期望轨迹 */}
        {suiteConfigType === 'workflow' && isTrajectory && (
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">期望轨迹 * <span className="text-gray-400">（Agent 的推理路径和决策选择）</span></label>
            <textarea value={expectedTrajectory} onChange={(e) => setExpectedTrajectory(e.target.value)} placeholder={"1. 识别用户意图 → 邮件查询\n2. 判断需要调用工具 → 选择 list_mails\n3. 获取结果 → 按重要性排序\n4. 如有紧急邮件，主动高亮提示\n5. 生成摘要 → 输出结果"} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={5} />
          </div>
        )}

        {/* 理想输出 — 所有类型都有 */}
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">
            理想输出 {suiteConfigType === 'ideal_output' && '*'}
            <span className="text-gray-400">（期望的精确输出，JSON 或纯文本）</span>
          </label>
          <textarea value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} placeholder={'{"summary": "您有3封未读邮件", "unread_count": 3}'} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={4} />
        </div>

        {!isEdit && <div className="text-xs text-gray-400">自动编号：<span className="font-mono px-2 py-0.5 rounded bg-gray-100 text-[#007AFF] font-semibold">{generatedKey}</span></div>}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="px-4 py-1.5 bg-[#007AFF] text-white text-sm rounded-lg hover:bg-[#0066DD] disabled:opacity-50">{submitting ? '保存中…' : isEdit ? '保存' : '创建'}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ──── 批量导入弹窗 ──── */

const BATCH_TEMPLATES: Record<string, string> = {
  ideal_output: `taskDescription,category,subcategory,caseType,expectedOutput
"帮我查看今天的邮件",客服问答,邮件-查询,structured_match,"{\\"hasUnread\\": true}"
"今天下午有什么会？",客服问答,会议-创建,structured_match,"{\\"meetings\\": []}"`,
  workflow: `taskDescription,category,subcategory,caseType,expectedBehavior,expectedTools,expectedTrajectory,expectedOutput
"帮我查看今天的邮件",客服问答,邮件-查询,behavioral,"1. 调用邮件查询\n2. 排序输出","email_tool.list_mails",,"{\\"summary\\": \\"\\"}"
"帮我查看今天的邮件",客服问答,邮件-查询,trajectory,,"1. 识别意图→查询\n2. 选择工具→获取\n3. 推理排序→输出","{\\"summary\\": \\"\\"}"`,
};

export function BatchImportModal({ open, suiteId, suiteConfigType, existingCount, onImported, onClose }: {
  open: boolean; suiteId: string; suiteConfigType: 'ideal_output' | 'workflow'; existingCount: number; onImported: () => void; onClose: () => void;
}) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [input, setInput] = useState('');
  const [parsedCases, setParsedCases] = useState<Array<{ category: string; subcategory?: string; evalType: string; taskDescription: string; expectedBehavior?: string; expectedTools?: string[]; expectedOutput?: unknown; expectedTrajectory?: string }>>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);

  const allowedTypes = CASE_TYPE_BY_CONFIG[suiteConfigType] ?? CASE_TYPE_BY_CONFIG.ideal_output;
  const defaultEvalType = allowedTypes[0].value;

  const handleParse = () => {
    setParseError('');
    setParsedCases([]);
    try {
      if (format === 'json') {
        const data = JSON.parse(input);
        if (!Array.isArray(data)) throw new Error('JSON 必须是数组格式');
        const cases = data.map((item: Record<string, unknown>) => ({
          category: String(item.category || ''),
          subcategory: item.subcategory ? String(item.subcategory) : undefined,
          evalType: String(item.caseType || item.evalType || defaultEvalType),
          taskDescription: String(item.taskDescription || ''),
          expectedBehavior: item.expectedBehavior ? String(item.expectedBehavior) : undefined,
          expectedTools: Array.isArray(item.expectedTools) ? item.expectedTools.map(String) : undefined,
          expectedOutput: item.expectedOutput ?? undefined,
          expectedTrajectory: item.expectedTrajectory ? String(item.expectedTrajectory) : undefined,
        })).filter((c: { taskDescription: string }) => c.taskDescription);
        if (cases.length === 0) throw new Error('未解析到有效用例');
        setParsedCases(cases);
      } else {
        const lines = input.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV 至少需要表头 + 1 行数据');
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        for (const rh of ['taskDescription', 'category']) {
          if (!headers.includes(rh)) throw new Error(`CSV 缺少必需列: ${rh}`);
        }
        const cases = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
          if (!obj.taskDescription) continue;
          cases.push({
            category: obj.category,
            subcategory: obj.subcategory || undefined,
            evalType: obj.caseType || obj.evalType || defaultEvalType,
            taskDescription: obj.taskDescription,
            expectedBehavior: obj.expectedBehavior || undefined,
            expectedTools: obj.expectedTools ? obj.expectedTools.split(';').map((t: string) => t.trim()).filter(Boolean) : undefined,
            expectedTrajectory: obj.expectedTrajectory || undefined,
          });
        }
        if (cases.length === 0) throw new Error('未解析到有效用例');
        setParsedCases(cases);
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : '解析失败');
    }
  };

  const handleImport = async () => {
    if (parsedCases.length === 0) return;
    setImporting(true);
    try {
      const abbr = 'CASE';
      const cases = parsedCases.map((c, i) => ({
        suiteId,
        caseKey: `${abbr}-${String(existingCount + i + 1).padStart(3, '0')}`,
        ...c,
      }));
      await evalApi.batchCreateCases(cases as Parameters<typeof evalApi.batchCreateCases>[0][number][]);
      onImported();
    } catch (e) {
      setParseError(e instanceof Error ? e.message : '导入失败');
    } finally { setImporting(false); }
  };

  const handleDownloadTemplate = () => {
    const template = BATCH_TEMPLATES[suiteConfigType] ?? BATCH_TEMPLATES.ideal_output;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eval-cases-template-${suiteConfigType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={onClose} title="批量导入用例" width="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CONFIG_TYPE_META[suiteConfigType].color}`}>
            <Icon name={CONFIG_TYPE_META[suiteConfigType].icon} size={11} /> {CONFIG_TYPE_META[suiteConfigType].label}
          </span>
          <span className="text-xs text-gray-400">导入模板将匹配当前配置类型的字段</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button onClick={() => { setFormat('csv'); setParsedCases([]); setParseError(''); }} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${format === 'csv' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>CSV</button>
            <button onClick={() => { setFormat('json'); setParsedCases([]); setParseError(''); }} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${format === 'json' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>JSON</button>
          </div>
          <button onClick={handleDownloadTemplate} className="text-xs text-[#007AFF] hover:underline flex items-center gap-1">
            <Icon name="download" size={13} /> 下载模板
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">{format === 'csv' ? '粘贴 CSV 数据' : '粘贴 JSON 数组'}</label>
          <textarea value={input} onChange={(e) => { setInput(e.target.value); setParsedCases([]); setParseError(''); }}
            placeholder={format === 'csv' ? BATCH_TEMPLATES[suiteConfigType]?.split('\n').slice(0, 3).join('\n') + '…' : '[\n  {\n    "taskDescription": "帮我查看邮件",\n    "category": "客服问答",\n    "caseType": "behavioral"\n  }\n]'}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" rows={8} />
        </div>

        <button onClick={handleParse} disabled={!input.trim()} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <Icon name="parse" size={13} className="mr-1 align-[-2px]" /> 解析预览
        </button>

        {parseError && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{parseError}</div>}

        {parsedCases.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">解析结果 ({parsedCases.length} 条)</span>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/60 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500">#</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500">用户输入</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500">场景</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parsedCases.map((c, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">{c.taskDescription}</td>
                      <td className="px-3 py-1.5 text-gray-600">{c.category}{c.subcategory ? ` / ${c.subcategory}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleImport} disabled={parsedCases.length === 0 || importing} className="px-4 py-1.5 bg-[#007AFF] text-white text-sm rounded-lg hover:bg-[#0066DD] disabled:opacity-50">
            {importing ? '导入中…' : `导入 ${parsedCases.length} 条`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──── CSV 行解析 ──── */

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}
