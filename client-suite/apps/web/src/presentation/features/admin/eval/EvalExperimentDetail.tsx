import { useEffect, useState, Fragment } from 'react';
import { evalApi } from '../../../../application/services/adminApi';
import { useAdminStore } from '../../../../application/stores/adminStore';
import type { EvalReport, EvalResult } from '../../../../application/services/adminApi';
import { StatCard } from '../../../components/ui/StatCard';
import { Icon } from '../../../components/ui/Icon';
import { CaseTracePanel } from './EvalCaseTracePanel';

/* ──── 常量 ──── */

const VERDICT_COLORS: Record<string, string> = {
  PASS: 'bg-green-50 text-green-700',
  WARNING: 'bg-yellow-50 text-yellow-700',
  FAIL: 'bg-red-50 text-red-700',
};

const DIM_LABELS: Record<string, string> = {
  correctness: '正确性', efficiency: '效率', safety: '安全性', interaction: '交互体验',
  accuracy: '准确性', completeness: '完整性', relevance: '相关性', conciseness: '简洁性',
};

const SEV: Record<string, { label: string; cls: string }> = {
  critical: { label: '严重', cls: 'bg-red-50 text-red-600' },
  high: { label: '高', cls: 'bg-orange-50 text-orange-600' },
  medium: { label: '中', cls: 'bg-yellow-50 text-yellow-700' },
  low: { label: '低', cls: 'bg-gray-100 text-gray-500' },
};

/* ──── 主组件 ──── */

export function EvalExperimentDetail() {
  const selectedRunId = useAdminStore((s) => s.selectedRunId);
  const exitRunDetail = useAdminStore((s) => s.exitRunDetail);

  const [report, setReport] = useState<EvalReport | null>(null);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'stats'>('overview');

  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    Promise.all([evalApi.getRunReport(selectedRunId), evalApi.getRunResults(selectedRunId)])
      .then(([rep, res]) => { setReport(rep); setResults(res.results); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRunId]);

  if (!selectedRunId) { exitRunDetail(); return null; }

  const tabs = [
    { key: 'overview' as const, label: '概览', icon: 'dashboard' },
    { key: 'cases' as const, label: '用例详情', icon: 'list_alt' },
    { key: 'stats' as const, label: '统计分析', icon: 'bar_chart' },
  ];

  return (
    <div className="min-h-screen">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button onClick={exitRunDetail} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <Icon name="arrow_back" size={16} /> 返回实验中心
        </button>
        <div className="text-gray-300">|</div>
        <span className="text-sm font-medium text-gray-700">实验详情</span>
        {report && <span className="ml-auto text-xs text-gray-400 font-mono">{selectedRunId}</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm"><Icon name="hourglass_empty" size={20} className="mr-2" />加载中…</div>
      ) : !report ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">报告不存在</div>
      ) : (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* 摘要卡片区 */}
          <DetailSummaryCards report={report} results={results} />

          {/* Tab 区 */}
          <div>
            <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-[#007AFF] text-[#007AFF]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <Icon name={tab.icon} size={14} /> {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && <DetailOverviewTab report={report} results={results} />}
            {activeTab === 'cases' && <DetailCasesTab report={report} results={results} />}
            {activeTab === 'stats' && <DetailStatsTab report={report} results={results} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──── 摘要卡片 ──── */

function DetailSummaryCards({ report, results }: { report: EvalReport; results: EvalResult[] }) {
  const passedCount = results.filter((r) => r.passed === true).length;
  const failedCount = results.filter((r) => r.passed === false).length;
  const scorePercent = Math.round(report.summary.overallScore * 100);
  const passRate = results.length > 0 ? Math.round((passedCount / results.length) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="综合得分" value={`${scorePercent}%`} icon="speed" color={scorePercent >= 80 ? '#34C759' : '#FF9500'} />
      <StatCard label="通过率" value={`${passRate}%`} icon="check_circle" color={passRate >= 80 ? '#34C759' : '#FF9500'} />
      <StatCard label="通过 / 失败" value={`${passedCount} / ${failedCount}`} icon="rule" color={failedCount > 0 ? '#FF9500' : '#34C759'} />
      <div className="px-4 py-3 rounded-xl bg-white border border-gray-200">
        <div className="text-[10px] text-gray-400 mb-1">判定</div>
        <span className={`inline-flex px-3 py-1 text-sm rounded-full font-semibold ${VERDICT_COLORS[report.summary.verdict] ?? 'bg-gray-100 text-gray-500'}`}>
          {report.summary.verdict}
        </span>
        {report.summary.delta != null && (
          <span className={`ml-2 text-xs font-semibold ${report.summary.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {report.summary.delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(report.summary.delta * 100))}% vs 基线
          </span>
        )}
      </div>
    </div>
  );
}

/* ──── 概览 Tab ──── */

function DetailOverviewTab({ report, results }: { report: EvalReport; results: EvalResult[] }) {
  const resultsByStatus = {
    passed: results.filter((r) => r.passed === true).length,
    failed: results.filter((r) => r.passed === false).length,
    error: results.filter((r) => r.status === 'error').length,
    pending: results.filter((r) => r.status === 'pending' || r.status === 'running').length,
  };

  const avgDuration = results.reduce((s, r) => s + (r.durationMs ?? 0), 0) / (results.length || 1);
  const totalTokens = results.reduce((s, r) => s + (r.tokenUsage ?? 0), 0);

  const failedWithReason = report.failures.map((f) => {
    const d = results.find((r) => r.caseId === f.caseId);
    return { ...f, failureReason: d?.failureReason ?? '低于阈值', actualOutput: d?.actualOutput };
  });

  return (
    <div className="space-y-6">
      {/* 维度得分 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">维度得分</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(report.dimensions).map(([key, dim]) => {
            const score = Math.round(dim.score * 100);
            const baseline = dim.baseline != null ? Math.round(dim.baseline * 100) : null;
            const delta = dim.delta != null ? Math.round(dim.delta * 100) : null;
            return (
              <div key={key} className="px-4 py-3 rounded-xl bg-white border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{DIM_LABELS[key] ?? key}</span>
                  <span className="text-sm font-semibold text-gray-800">{score}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#007AFF] transition-all" style={{ width: `${score}%` }} />
                </div>
                {baseline != null && (
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>基线 {baseline}%</span>
                    {delta != null && (
                      <span className={delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 快速统计 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="px-4 py-3 rounded-xl bg-white border border-gray-200">
          <div className="text-[10px] text-gray-400">平均耗时</div>
          <div className="text-lg font-semibold text-gray-700 mt-0.5">{avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : '—'}</div>
        </div>
        <div className="px-4 py-3 rounded-xl bg-white border border-gray-200">
          <div className="text-[10px] text-gray-400">Token 消耗</div>
          <div className="text-lg font-semibold text-gray-700 mt-0.5">{totalTokens > 0 ? totalTokens.toLocaleString() : '—'}</div>
        </div>
        <div className="px-4 py-3 rounded-xl bg-white border border-gray-200">
          <div className="text-[10px] text-gray-400">用例状态</div>
          <div className="text-sm text-gray-700 mt-0.5 space-x-3">
            <span className="text-green-600">{resultsByStatus.passed} 通过</span>
            <span className="text-red-600">{resultsByStatus.failed} 失败</span>
            {resultsByStatus.error > 0 && <span className="text-orange-600">{resultsByStatus.error} 错误</span>}
            {resultsByStatus.pending > 0 && <span className="text-gray-400">{resultsByStatus.pending} 进行中</span>}
          </div>
        </div>
      </div>

      {/* 改进用例 */}
      {report.improvements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-600 mb-2">改进用例 ({report.improvements.length})</h3>
          <div className="space-y-1.5">
            {report.improvements.map((imp) => (
              <div key={imp.caseId} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-green-100 bg-white text-xs">
                <span className="font-mono text-green-600 font-semibold">{imp.caseKey}</span>
                <span className="text-gray-400">{Math.round(imp.scoreBefore * 100)}%</span>
                <Icon name="arrow_forward" size={12} className="text-green-500" />
                <span className="text-green-600 font-semibold">{Math.round(imp.scoreAfter * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 失败用例摘要 */}
      {failedWithReason.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-2">失败用例 ({failedWithReason.length})</h3>
          <div className="space-y-1.5">
            {failedWithReason.slice(0, 10).map((f) => (
              <div key={f.caseId} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-100 bg-white text-xs">
                <span className="font-mono text-red-600 font-semibold">{f.caseKey}</span>
                <span className="text-gray-500">{f.category}</span>
                {f.regression && <span className="px-1 py-0 rounded text-[9px] bg-orange-50 text-orange-600 font-semibold">退化</span>}
                <span className="ml-auto font-bold text-red-600">{Math.round(f.score * 100)}%</span>
                <span className="text-gray-400 max-w-[200px] truncate" title={f.failureReason}>{f.failureReason}</span>
              </div>
            ))}
            {failedWithReason.length > 10 && (
              <div className="text-xs text-gray-400 text-center py-1">还有 {failedWithReason.length - 10} 条失败用例，切换到「用例详情」查看</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──── 用例详情 Tab — 行内展开（参考调用追踪页 Fragment + colSpan 模式） ──── */

function DetailCasesTab({ report, results }: { report: EvalReport; results: EvalResult[] }) {
  const [filterPass, setFilterPass] = useState<'all' | 'passed' | 'failed'>('all');
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);

  const filteredResults = results.filter((r) => {
    if (filterPass === 'passed') return r.passed === true;
    if (filterPass === 'failed') return r.passed === false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 筛选 */}
      <div className="flex items-center gap-2">
        {([{ key: 'all', label: '全部' }, { key: 'passed', label: '✅ 通过' }, { key: 'failed', label: '❌ 失败' }] as const).map((f) => (
          <button key={f.key} onClick={() => setFilterPass(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPass === f.key ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
        <span className="text-[10px] text-gray-400 ml-auto">{filteredResults.length} / {results.length} 条</span>
      </div>

      {/* 用例列表 — 行内展开详情 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/60">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-8" />
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Case ID</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">得分</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">结果</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">耗时</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Token</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredResults.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">无匹配用例</td></tr>
            ) : filteredResults.map((r) => {
              const failure = report.failures.find((f) => f.caseId === r.caseId);
              const isExpanded = expandedCaseId === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    className={`cursor-pointer transition-colors ${isExpanded ? 'bg-[#007AFF]/5' : 'hover:bg-gray-50/50'}`}
                    onClick={() => setExpandedCaseId(isExpanded ? null : r.id)}
                  >
                    <td className="px-3 py-2.5">
                      <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size={16} className="text-gray-400" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[#007AFF] text-xs">{failure?.caseKey ?? r.caseId.slice(0, 12)}</td>
                    <td className="px-4 py-2.5">
                      {r.score != null ? (
                        <span className={`font-semibold text-sm ${r.score >= 0.8 ? 'text-green-600' : r.score >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {Math.round(r.score * 100)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.passed != null ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {r.passed ? 'PASS' : 'FAIL'}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.tokenUsage ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${r.status === 'completed' ? 'text-green-600' : r.status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                        {r.status === 'completed' ? '完成' : r.status === 'error' ? '错误' : r.status}
                      </span>
                    </td>
                  </tr>
                  {/* 行内展开详情 — 在当前行下方挤入 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50/50">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-mono font-semibold text-[#007AFF]">{failure?.caseKey ?? r.caseId}</span>
                            {failure && <span className="text-gray-500 text-xs">{failure.category}</span>}
                            {r.passed != null && <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.passed ? 'PASS' : 'FAIL'}</span>}
                            <span className="ml-auto text-gray-400 text-xs">耗时 {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'} · Token {r.tokenUsage ?? '—'}</span>
                          </div>
                          <CaseTracePanel
                            toolCallsLog={r.toolCallsLog as import('../../../../application/services/adminApi').ToolCallEntry[] | undefined}
                            judgeResponse={r.judgeResponse as Record<string, unknown> | undefined}
                            dimensionScores={r.dimensionScores}
                            score={r.score ?? null}
                            failure={failure ? { expected: failure.expected, actual: failure.actual } : null}
                            actualOutput={r.actualOutput ?? null}
                            failureReason={r.failureReason ?? null}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──── 统计分析 Tab ──── */

function DetailStatsTab({ report, results }: { report: EvalReport; results: EvalResult[] }) {
  const scoreDistribution = (() => {
    const bins = [
      { range: '0-20%', min: 0, max: 0.2, count: 0, color: 'bg-red-500' },
      { range: '20-40%', min: 0.2, max: 0.4, count: 0, color: 'bg-orange-500' },
      { range: '40-60%', min: 0.4, max: 0.6, count: 0, color: 'bg-yellow-500' },
      { range: '60-80%', min: 0.6, max: 0.8, count: 0, color: 'bg-blue-400' },
      { range: '80-100%', min: 0.8, max: 1.01, count: 0, color: 'bg-green-500' },
    ];
    for (const r of results) {
      if (r.score == null) continue;
      for (const bin of bins) {
        if (r.score >= bin.min && r.score < bin.max) { bin.count++; break; }
      }
    }
    return bins;
  })();

  const failedWithReason = report.failures.map((f) => {
    const d = results.find((r) => r.caseId === f.caseId);
    return { ...f, failureReason: d?.failureReason ?? '低于阈值' };
  });

  return (
    <div className="space-y-6">
      {/* 得分分布 */}
      <div className="p-5 rounded-xl bg-white border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">得分分布</h3>
        <div className="space-y-2">
          {scoreDistribution.map((bin) => (
            <div key={bin.range} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 text-right">{bin.range}</span>
              <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${bin.color} rounded transition-all`} style={{ width: `${results.length > 0 ? (bin.count / results.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-8">{bin.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 按失败分类统计 */}
      {failedWithReason.length > 0 && (
        <div className="p-5 rounded-xl bg-white border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">失败用例分类</h3>
          <div className="space-y-2">
            {(() => {
              const catMap = new Map<string, number>();
              for (const f of failedWithReason) { catMap.set(f.category, (catMap.get(f.category) ?? 0) + 1); }
              return [...catMap.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 truncate">{cat}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full bg-red-400 rounded" style={{ width: `${(count / failedWithReason.length) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{count}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* 建议 */}
      {report.recommendations.length > 0 && (
        <div className="p-5 rounded-xl bg-white border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">优化建议</h3>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-gray-50 text-sm">
                <span className={`px-1.5 py-0 rounded text-[10px] font-semibold ${SEV[rec.priority]?.cls ?? 'bg-gray-100 text-gray-500'}`}>{SEV[rec.priority]?.label ?? rec.priority}</span>
                <span className="text-gray-700">{rec.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 热力图占位 */}
      <div className="p-5 rounded-xl bg-white border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Category 热力图</h3>
        <div className="text-xs text-gray-400 text-center py-6">按场景分类的通过率热力图（待接入 /dashboard/heatmap/:runId）</div>
      </div>
    </div>
  );
}
