import { useEffect, useState, useCallback } from 'react';
import { evalApi } from '../../../../application/services/adminApi';
import type { EvalSuite, EvalCase } from '../../../../application/services/adminApi';
import { useAdminStore } from '../../../../application/stores/adminStore';
import { Icon } from '../../../components/ui/Icon';
import { CaseFormModal, BatchImportModal } from './EvalSuites';

/* ──── 常量 ──── */

const CONFIG_TYPE_META: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  ideal_output: { label: '理想输出', color: 'bg-blue-50 text-blue-600', icon: 'check_circle', desc: '验证 Agent 输出与预定义期望是否一致' },
  workflow: { label: '工作流', color: 'bg-purple-50 text-purple-600', icon: 'account_tree', desc: '验证 Agent 执行流程、工具调用路径与轨迹推理' },
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

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  retired: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-100 text-gray-500',
};

/* ──── 主组件 ──── */

export function EvalSuiteDetail() {
  const selectedSuiteId = useAdminStore((s) => s.selectedSuiteId);
  const exitSuiteDetail = useAdminStore((s) => s.exitSuiteDetail);

  const [suite, setSuite] = useState<EvalSuite | null>(null);
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCase, setShowAddCase] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [editingCase, setEditingCase] = useState<EvalCase | null>(null);

  const loadData = useCallback(() => {
    if (!selectedSuiteId) return;
    setLoading(true);
    Promise.all([evalApi.getSuite(selectedSuiteId), evalApi.listCases(selectedSuiteId)])
      .then(([s, c]) => { setSuite(s); setCases(c.cases); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSuiteId]);

  useEffect(() => { if (selectedSuiteId) loadData(); }, [selectedSuiteId, loadData]);

  if (!selectedSuiteId) { exitSuiteDetail(); return null; }

  const configType = suite?.configType ?? 'ideal_output';
  const configMeta = CONFIG_TYPE_META[configType];
  const isWorkflow = configType === 'workflow';

  return (
    <div className="min-h-screen">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button onClick={exitSuiteDetail} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <Icon name="arrow_back" size={16} /> 返回评测集
        </button>
        <div className="text-gray-300">|</div>
        <span className="text-sm font-medium text-gray-700">{suite?.name ?? '评测集详情'}</span>
        {suite && (
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${configMeta.color}`}>
              <Icon name={configMeta.icon} size={11} /> {configMeta.label}
            </span>
            <span>{cases.length} 个用例</span>
            <span>·</span>
            <span>v{suite.version}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          <Icon name="hourglass_empty" size={20} className="mr-2" />加载中…
        </div>
      ) : !suite ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">不存在</div>
      ) : (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* 元信息区 */}
          {suite.description && <p className="text-xs text-gray-500">{suite.description}</p>}

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${configMeta.color}`}>
              <Icon name={configMeta.icon} size={11} /> {configMeta.label}
            </span>
            {suite.evalType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600">
                {EVAL_TYPE_LABELS[suite.evalType] ?? suite.evalType}
              </span>
            )}
            <span>{cases.length} 个用例</span>
            <span>·</span>
            <span>v{suite.version}</span>
            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[suite.status] || 'bg-gray-100 text-gray-500'}`}>
              {suite.status === 'active' ? '活跃' : suite.status}
            </span>
          </div>

          {/* 用例操作栏 */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">用例列表</span>
            <div className="flex items-center gap-2">
              <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
                <Icon name="refresh" size={16} />
              </button>
              <button onClick={() => setShowBatchImport(true)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <Icon name="upload_file" size={13} className="mr-1 align-[-2px]" /> 批量导入
              </button>
              <button onClick={() => setShowAddCase(true)} className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]">
                <Icon name="add" size={13} className="mr-1 align-[-2px]" /> 添加用例
              </button>
            </div>
          </div>

          {/* 用例表格 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">ID</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">用户输入</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">场景</th>
                  {!isWorkflow && <th className="text-left px-4 py-2.5 font-medium text-gray-500">评测类型</th>}
                  {isWorkflow && <th className="text-left px-4 py-2.5 font-medium text-gray-500">{/* 动态列 */}</th>}
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cases.map((c) => {
                  const isTrajectory = c.evalType === 'trajectory';
                  const workflowCol = isTrajectory
                    ? (c.expectedTrajectory ?? '—')
                    : (c.expectedBehavior ?? '—');
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setEditingCase(c)}>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#007AFF]">{c.caseKey}</td>
                      <td className="px-4 py-2.5 max-w-[260px] truncate text-gray-700" title={c.taskDescription}>{c.taskDescription}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{c.category}{c.subcategory ? ` / ${c.subcategory}` : ''}</td>
                      {!isWorkflow && <td className="px-4 py-2.5 text-gray-500 text-xs">{EVAL_TYPE_LABELS[c.evalType] ?? c.evalType}</td>}
                      {isWorkflow && (
                        <td className="px-4 py-2.5 max-w-[280px] truncate text-xs text-gray-500" title={workflowCol}>
                          {isTrajectory ? '📍 ' : '🔄 '}{workflowCol.length > 40 ? workflowCol.slice(0, 40) + '…' : workflowCol}
                        </td>
                      )}
                      <td className="px-4 py-2.5"><span className={`text-xs ${c.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>{c.status === 'active' ? '活跃' : c.status}</span></td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={async (e) => { e.stopPropagation(); if (!confirm(`确认删除用例「${c.caseKey}」？`)) return; await evalApi.deleteCase(c.id); loadData(); }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="删除用例"
                        >
                          <Icon name="delete_outline" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {cases.length === 0 && <tr><td colSpan={isWorkflow ? 7 : 6} className="px-4 py-10 text-center text-gray-400 text-sm">暂无用例，点击右上角「添加用例」开始</td></tr>}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* 用例表单 / 批量导入弹窗 */}
      {(showAddCase || editingCase) && (
        <CaseFormModal suiteId={selectedSuiteId} suiteConfigType={configType} suiteEvalType={suite?.evalType ?? undefined} caseData={editingCase} existingCount={cases.length}
          onSaved={() => { setShowAddCase(false); setEditingCase(null); loadData(); }}
          onClose={() => { setShowAddCase(false); setEditingCase(null); }} />
      )}
      <BatchImportModal open={showBatchImport} suiteId={selectedSuiteId} suiteConfigType={configType} existingCount={cases.length}
        onImported={() => { setShowBatchImport(false); loadData(); }} onClose={() => setShowBatchImport(false)} />
    </div>
  );
}
