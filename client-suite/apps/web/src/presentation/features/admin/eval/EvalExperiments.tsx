import { useState, useEffect, useCallback } from 'react';
import { evalApi, employeeApi } from '../../../../application/services/adminApi';
import { useAdminStore } from '../../../../application/stores/adminStore';
import type {
  DashboardMetrics,
  EvalSuite,
  EvalEvaluator,
  EvalAlertRule,
  Employee,
} from '../../../../application/services/adminApi';
import { StatCard } from '../../../components/ui/StatCard';
import { Icon } from '../../../components/ui/Icon';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';

/* ──── 常量 ──── */

const VERDICT_COLORS: Record<string, string> = {
  PASS: 'bg-green-50 text-green-700',
  WARNING: 'bg-yellow-50 text-yellow-700',
  FAIL: 'bg-red-50 text-red-700',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-gray-300',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

const SEV: Record<string, { label: string; cls: string }> = {
  critical: { label: '严重', cls: 'bg-red-50 text-red-600' },
  high: { label: '高', cls: 'bg-orange-50 text-orange-600' },
  medium: { label: '中', cls: 'bg-yellow-50 text-yellow-700' },
  low: { label: '低', cls: 'bg-gray-100 text-gray-500' },
};

const ALERT_TEMPLATES = [
  { name: '正确性下降', conditionExpr: 'correctness < 0.85', severity: 'high' },
  { name: '安全异常', conditionExpr: 'safety < 0.95', severity: 'critical' },
  { name: '综合分回归', conditionExpr: 'overall_score_delta < -0.03', severity: 'high' },
  { name: '评测失败', conditionExpr: 'verdict == FAIL', severity: 'critical' },
];

/* ──── 主组件 ──── */

export function EvalExperiments() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluators, setEvaluators] = useState<EvalEvaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewExperiment, setShowNewExperiment] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const navigateToRunDetail = useAdminStore((s) => s.navigateToRunDetail);

  const loadData = useCallback(() => {
    Promise.all([evalApi.getDashboardMetrics(), evalApi.listSuites(), employeeApi.list(), evalApi.listEvaluators()])
      .then(([m, s, emps, evs]) => { setMetrics(m); setSuites(s.suites); setEmployees(emps); setEvaluators(evs.evaluators); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 轮询
  useEffect(() => {
    const hasRunning = metrics?.recentRuns.some((r) => r.verdict == null) ?? false;
    if (!hasRunning) return;
    const t = setInterval(() => loadData(), 5000);
    return () => clearInterval(t);
  }, [metrics, loadData]);

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-gray-400"><Icon name="hourglass_empty" size={20} /><span className="ml-2">加载中…</span></div>;

  const m = metrics ?? { latestScore: null, latestVerdict: null, avgScore10Runs: null, recentRuns: [], totalCases: 0, totalRuns: 0, totalSuites: 0 };
  const scorePercent = m.latestScore != null ? Math.round(m.latestScore * 100) : null;
  const passRate = m.recentRuns.length > 0 ? Math.round((m.recentRuns.filter((r) => r.verdict === 'PASS').length / m.recentRuns.length) * 100) : null;

  return (
    <div className="p-6 space-y-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">实验中心</h2>
          <p className="text-xs text-gray-400 mt-0.5">启动评测实验、追踪得分趋势与告警规则</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Icon name="settings" size={14} className="mr-1 align-[-2px]" /> 设置
          </button>
          <button onClick={() => setShowNewExperiment(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors flex items-center gap-1">
            <Icon name="play_arrow" size={16} /> 新建实验
          </button>
          <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新"><Icon name="refresh" size={16} /></button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="最新得分" value={scorePercent != null ? `${scorePercent}%` : '—'} icon="speed" color={scorePercent != null && scorePercent >= 80 ? '#34C759' : '#FF9500'} />
        <StatCard label="通过率" value={passRate != null ? `${passRate}%` : '—'} icon="check_circle" color={passRate != null && passRate >= 80 ? '#34C759' : '#FF9500'} />
      </div>

      {/* 趋势图 */}
      <ScoreTrendChart />

      {/* 设置 */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* 新建实验 */}
      {showNewExperiment && (
        <NewExperimentPanel
          suites={suites} employees={employees} evaluators={evaluators}
          onStarted={() => { setShowNewExperiment(false); setTimeout(loadData, 1000); }}
          onCancel={() => setShowNewExperiment(false)}
        />
      )}

      {/* 实验列表 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-6" />
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">评测集</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">评估器</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">被测对象</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">得分</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">判定</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">时间</th>
            </tr>
          </thead>
          <tbody>
            {m.recentRuns.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center">
                <Icon name="science" size={28} className="mx-auto mb-2 text-gray-300" />
                <div className="text-sm text-gray-500">暂无实验记录</div>
                <div className="text-xs text-gray-400 mt-1">点击「新建实验」开始第一次评测</div>
              </td></tr>
            ) : m.recentRuns.map((run) => {
              const suite = suites.find((s) => s.id === run.suiteId);
              const employee = run.employeeId ? employees.find((e) => e.id === run.employeeId) : null;
              const runEvaluators = (run.evaluatorIds as string[] | undefined)?.map((id) => evaluators.find((e) => e.id === id)).filter(Boolean) as EvalEvaluator[] ?? [];
              return (
                <tr key={run.id} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigateToRunDetail(run.id)}>
                  <td className="px-4 py-2.5"><div className={`w-2 h-2 rounded-full ${STATUS_DOT[run.status] ?? 'bg-gray-300'}`} /></td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{suite?.name ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {runEvaluators.length > 0 ? runEvaluators.map((ev) => (
                      <span key={ev.id} className="inline-flex px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] mr-1">{ev.name}</span>
                    )) : <span className="text-gray-300 text-xs">未指定</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {employee ? <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{employee.displayName || employee.name}</span> : <span className="text-gray-300">全局</span>}
                    {run.configVersion && <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded font-mono">{run.configVersion}</span>}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-700">{run.overallScore != null ? `${Math.round(run.overallScore * 100)}%` : '—'}</td>
                  <td className="px-4 py-2.5">{run.verdict ? <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${VERDICT_COLORS[run.verdict] ?? ''}`}>{run.verdict}</span> : <span className="text-gray-300 text-xs">运行中</span>}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(run.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──── 新建实验 ──── */

function NewExperimentPanel({ suites, employees, evaluators, onStarted, onCancel }: {
  suites: EvalSuite[]; employees: Employee[]; evaluators: EvalEvaluator[];
  onStarted: () => void; onCancel: () => void;
}) {
  const [suiteId, setSuiteId] = useState('');
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [configVersion, setConfigVersion] = useState('');
  const [modelId, setModelId] = useState('');
  const [employeeVersions, setEmployeeVersions] = useState<Array<{ version: string; status: string }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [starting, setStarting] = useState(false);

  const models = Array.from(new Set(employees.map((e) => e.model).filter(Boolean)));

  // 选择被测对象后联动加载版本列表
  useEffect(() => {
    if (!employeeId) {
      setEmployeeVersions([]);
      setConfigVersion('');
      return;
    }
    setLoadingVersions(true);
    employeeApi.get(employeeId)
      .then((emp) => {
        const raw = emp as Record<string, unknown>;
        const settings = (raw.settings || {}) as Record<string, unknown>;
        const rawVersions = Array.isArray(settings.versions)
          ? settings.versions
          : Array.isArray(raw.versions)
            ? raw.versions
            : [];
        const versions = (rawVersions as Record<string, unknown>[]).map((v) => ({
          version: String(v.version || '-'),
          status: String(v.status || 'draft'),
        }));
        setEmployeeVersions(versions);
        // 优先选中最新已发布版本，否则选中最新版本
        const published = versions.filter((v) => v.status === 'published');
        if (published.length > 0) {
          setConfigVersion(published[published.length - 1].version);
        } else if (versions.length > 0) {
          setConfigVersion(versions[versions.length - 1].version);
        } else {
          setConfigVersion('');
        }
      })
      .catch(() => {
        setEmployeeVersions([]);
        setConfigVersion('');
      })
      .finally(() => setLoadingVersions(false));
  }, [employeeId]);

  const canStart = suiteId && employeeId && configVersion && selectedEvaluatorIds.length > 0;

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      await evalApi.startRun({
        suiteId,
        employeeId,
        configVersion,
        ...(modelId ? { modelId } : {}),
        evaluatorIds: selectedEvaluatorIds,
      });
      onStarted();
    } catch { /* 实验启动失败，忽略以继续 */ } finally { setStarting(false); }
  };

  return (
    <div className="border border-[#007AFF]/30 rounded-xl bg-[#007AFF]/5 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">新建实验</h3>

      {/* 第一行：评测集 + 被测对象 + 配置版本 */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">评测集 * <span className="text-gray-400">（测什么）</span></label>
          <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]">
            <option value="">选择…</option>
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.totalCases})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">被测对象 * <span className="text-gray-400">（评谁）</span></label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]">
            <option value="">选择…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.displayName || e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">配置版本 * <span className="text-gray-400">（Agent 版本）</span></label>
          <select value={configVersion} onChange={(e) => setConfigVersion(e.target.value)} disabled={!employeeId || loadingVersions} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">{loadingVersions ? '加载中…' : !employeeId ? '先选被测对象' : employeeVersions.length === 0 ? '暂无版本' : '选择…'}</option>
            {employeeVersions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version}{v.status === 'published' ? ' · 已发布' : v.status === 'review' ? ' · 审核中' : ' · 草稿'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 第二行：评估器选择 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">评估器 * <span className="text-gray-400">（怎么评，至少选一个）</span></label>
        {evaluators.length === 0 ? (
          <div className="px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-700">请先在「评估器」页面创建至少一个评估器</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {evaluators.map((ev) => {
              const sel = selectedEvaluatorIds.includes(ev.id);
              return <button key={ev.id} onClick={() => setSelectedEvaluatorIds(sel ? selectedEvaluatorIds.filter((id) => id !== ev.id) : [...selectedEvaluatorIds, ev.id])} className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${sel ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF] font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{ev.name}</button>;
            })}
          </div>
        )}
      </div>

      {/* 第三行：覆盖模型 + 操作 */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">覆盖模型 <span className="text-gray-400">（可选，A/B 测试）</span></label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]">
            <option value="">使用默认模型</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleStart} disabled={!canStart || starting} className="px-4 py-2 bg-[#007AFF] text-white text-sm rounded-lg hover:bg-[#0066DD] disabled:opacity-50">{starting ? '启动中…' : '启动实验'}</button>
        </div>
      </div>
    </div>
  );
}

/* ──── 设置面板 ──── */

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<EvalAlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { evalApi.listAlertRules().then((r) => setRules(r.rules)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const addRule = async (tpl: typeof ALERT_TEMPLATES[0]) => {
    await evalApi.createAlertRule({ name: tpl.name, conditionExpr: tpl.conditionExpr, severity: tpl.severity as 'critical', actionType: tpl.severity === 'critical' ? 'pause_agent' : 'notify' });
    setRules((await evalApi.listAlertRules()).rules);
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">告警规则</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="close" size={16} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALERT_TEMPLATES.map((tpl) => {
          const exists = rules.some((r) => r.conditionExpr === tpl.conditionExpr);
          return <button key={tpl.conditionExpr} onClick={() => !exists && addRule(tpl)} disabled={exists} className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${exists ? 'border-gray-100 text-gray-300 bg-gray-50' : 'border-gray-200 text-gray-600 hover:border-[#007AFF] hover:text-[#007AFF] bg-white'}`}>{tpl.name}</button>;
        })}
      </div>
      {loading ? <div className="text-xs text-gray-400">加载中…</div> : rules.length === 0 ? <div className="text-xs text-gray-400">暂无规则，从上方添加</div> : (
        <div className="space-y-1.5">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100">
              <ToggleSwitch checked={rule.enabled} onChange={async (v) => { await evalApi.updateAlertRule(rule.id, { enabled: v }); setRules((await evalApi.listAlertRules()).rules); }} />
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEV[rule.severity]?.cls ?? ''}`}>{SEV[rule.severity]?.label}</span>
              <span className="text-xs text-gray-700 flex-1">{rule.name}</span>
              <span className="text-[10px] text-gray-400 font-mono">{rule.conditionExpr}</span>
              <button onClick={async () => { await evalApi.deleteAlertRule(rule.id); setRules((r) => r.filter((x) => x.id !== rule.id)); }} className="text-gray-300 hover:text-red-500"><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──── 趋势图 ──── */

function ScoreTrendChart() {
  const [trends, setTrends] = useState<Array<{ id: string; overallScore: number; verdict: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { evalApi.getDashboardTrends(30).then((r) => setTrends(r.trends)).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading || trends.length < 2) return null;

  const w = 500; const h = 120; const padX = 28; const padY = 14;
  const chartW = w - padX * 2; const chartH = h - padY * 2;
  const scores = trends.map((t) => t.overallScore);
  const minS = Math.max(0, Math.min(...scores) - 0.1); const maxS = Math.min(1, Math.max(...scores) + 0.1); const rangeS = maxS - minS || 1;
  const points = trends.map((t, i) => ({ x: padX + (i / (trends.length - 1)) * chartW, y: padY + chartH - ((t.overallScore - minS) / rangeS) * chartH, ...t }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + chartH} L ${points[0].x} ${padY + chartH} Z`;

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4">
      <div className="text-[11px] font-medium text-gray-500 mb-2"><Icon name="show_chart" size={13} className="mr-1 align-[-2px]" />得分趋势（近 30 次）</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <line x1={padX} y1={padY + chartH - ((0.8 - minS) / rangeS) * chartH} x2={w - padX} y2={padY + chartH - ((0.8 - minS) / rangeS) * chartH} stroke="#34C759" strokeDasharray="4 2" opacity={0.4} />
        <path d={areaPath} fill="#007AFF" opacity={0.06} />
        <path d={linePath} fill="none" stroke="#007AFF" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={p.verdict === 'PASS' ? '#34C759' : p.verdict === 'FAIL' ? '#FF3B30' : '#FF9500'} />)}
      </svg>
    </div>
  );
}
