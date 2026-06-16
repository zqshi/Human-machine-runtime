import { useState, useEffect, useCallback, Fragment } from 'react';
import { aiGatewayApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { Icon } from '../../components/ui/Icon';
import { SpanWaterfall, SpanDetailPanel, type SpanItem } from '../../components/trace/SpanWaterfall';
import { fmtDuration, fmtTime, stageColor } from '../../components/trace/format';

interface ChainStage {
  nodeId?: string;
  kind?: string;
  stage: string;
  title?: string | null;
  status: string;
  summary?: string | null;
  durationMs: number;
  model?: string | null;
  createdAt?: string;
  inputPayload?: unknown;
  outputPayload?: unknown;
}

interface RiskHit {
  ruleId?: string;
  ruleName: string;
  severity: string;
  action: string;
  matchSummary: string;
  createdAt?: string;
}

interface TraceRecord {
  traceId?: string;
  id?: string | number;
  requestId?: string;
  sessionId?: string;
  taskId?: string | null;
  taskName?: string | null;
  instruction?: string | null;
  employeeName?: string | null;
  status?: string;
  requestedModel?: string;
  actualModel?: string | null;
  providerType?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCost?: number;
  inputCost?: number;
  outputCost?: number;
  userId?: string | null;
  instanceId?: string | null;
  apiKeyHash?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  riskHits?: RiskHit[];
  chain?: ChainStage[];
  spanList?: SpanItem[];
  spans?: SpanItem[];
  distTraceId?: string | null;
  distRiskHits?: RiskHit[];
  [key: string]: unknown;
}

interface TraceAnalysis {
  rootCause?: ChainStage | null;
  criticalPath: ChainStage[];
  warnings: string[];
}

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-green-50 text-green-700 border-green-100',
  completed: 'bg-green-50 text-green-700 border-green-100',
  blocked: 'bg-red-50 text-red-600 border-red-100',
  failed: 'bg-orange-50 text-orange-600 border-orange-100',
  error: 'bg-red-50 text-red-600 border-red-100',
};

function fmtCost(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `¥${n.toFixed(4)}` : '—';
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function traceIdOf(t: TraceRecord): string {
  return String(t.traceId || t.id || '');
}

function statusBadge(status: unknown): string {
  return STATUS_BADGE[String(status)] || 'bg-gray-100 text-gray-500 border-gray-200';
}

function analyzeTrace(trace: TraceRecord): TraceAnalysis {
  const chain = trace.chain || [];
  const rootCause =
    chain.find((s) => ['error', 'failed', 'blocked'].includes(String(s.status))) ||
    (['error', 'failed', 'blocked'].includes(String(trace.status)) ? chain[0] : null);
  const criticalPath = [...chain].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0)).slice(0, 5);
  const warnings: string[] = [];
  if (chain.length === 0) warnings.push('缺少 ai_flow_nodes 链路节点，当前只能基于调用摘要分析，不能伪造成全链路。');
  if (!trace.taskId) warnings.push('缺少 metadata.task_id，任务级追踪会退化为用户/数字员工维度。');
  if (!trace.userId && !trace.instanceId) warnings.push('缺少 userId / instanceId，无法准确判断调用者与影响范围。');
  return { rootCause, criticalPath, warnings };
}

function StatusPill({ status }: { status: unknown }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(status)}`}>{String(status || '—')}</span>;
}

function ChainTimeline({ chain }: { chain: ChainStage[] }) {
  if (chain.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        未读取到真实链路节点。需要上游写入 ai_flow_nodes 后，才能在列表展开区展示阶段级 Trace。
      </div>
    );
  }
  const totalMs = Math.max(chain.reduce((s, c) => s + (c.durationMs || 0), 0), 1);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 h-5 rounded-full overflow-hidden bg-gray-100">
        {chain.map((c, i) => {
          const pct = ((c.durationMs || 0) / totalMs) * 100;
          return (
            <div
              key={c.nodeId || i}
              className={`h-full ${stageColor(c.status)}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
              title={`${c.stage}: ${fmtDuration(c.durationMs)} (${c.status})`}
            />
          );
        })}
      </div>
      <div className="space-y-1.5">
        {chain.map((c, i) => (
          <div key={c.nodeId || i} className="grid grid-cols-[180px_1fr_70px] items-center gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full ${stageColor(c.status)}`} />
              <span className="font-medium text-gray-800 truncate">{c.stage}</span>
            </div>
            <div className="text-gray-500 truncate">{c.summary || c.kind || c.model || '—'}</div>
            <div className="font-mono text-right text-gray-600">{fmtDuration(c.durationMs)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Span 瀑布图（分布式追踪可观测性） ──


function TraceDiagnosis({ trace }: { trace: TraceRecord }) {
  const analysis = analyzeTrace(trace);
  const hits = trace.riskHits || [];
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-[10px] text-gray-400 mb-1">诊断结论</div>
        <div className={analysis.rootCause ? 'text-sm font-medium text-red-700' : 'text-sm text-gray-700'}>
          根因：{analysis.rootCause?.stage || '未识别失败节点'}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          影响范围：{trace.taskId ? `任务 ${trace.taskId}` : trace.instanceId || trace.userId || '身份字段缺失'}
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-[10px] text-gray-400 mb-1">关键路径</div>
        {analysis.criticalPath.length > 0 ? (
          <div className="space-y-1">
            {analysis.criticalPath.slice(0, 3).map((s) => (
              <div key={s.nodeId || s.stage} className="flex justify-between gap-2 text-xs">
                <span className="truncate text-gray-700">{s.stage}</span>
                <span className="font-mono text-gray-500">{fmtDuration(s.durationMs)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400">缺少阶段耗时数据</div>
        )}
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-[10px] text-gray-400 mb-1">风险与建议</div>
        <div className="text-xs text-gray-700">风险命中：{hits.length}</div>
        <div className="mt-1 text-xs text-gray-500">
          {analysis.rootCause ? `优先排查 ${analysis.rootCause.stage}` : '先补齐链路节点与调用者 metadata'}
        </div>
      </div>
      {analysis.warnings.length > 0 && (
        <div className="xl:col-span-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1">
          {analysis.warnings.map((w) => <div key={w}>• {w}</div>)}
        </div>
      )}
    </div>
  );
}

function TraceExpandedDetail({ trace }: { trace: TraceRecord }) {
  const hits = trace.riskHits || [];
  const chain = trace.chain || [];
  const spanList = trace.spanList || [];
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const selectedSpan = selectedSpanId ? spanList.find((s) => s.spanId === selectedSpanId) ?? null : null;

  const hasSpanData = spanList.length > 0;

  return (
    <div className="space-y-3">
      <TraceDiagnosis trace={trace} />

      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-[10px] text-gray-400 mb-2">
          {hasSpanData ? '分布式追踪瀑布图' : '真实链路时间线'}
        </div>
        {hasSpanData ? (
          <SpanWaterfall
            spans={spanList}
            selectedSpanId={selectedSpanId}
            onSelectSpan={setSelectedSpanId}
          />
        ) : (
          <ChainTimeline chain={chain} />
        )}
      </div>

      {selectedSpan && <SpanDetailPanel span={selectedSpan} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 mb-1">调用上下文</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="用户" value={trace.userId || '未标识'} />
            <Info label="数字员工" value={trace.instanceId || trace.employeeName || '—'} />
            <Info label="Session" value={trace.sessionId || '—'} mono />
            <Info label="Request ID" value={trace.requestId || '—'} mono />
            <Info label="任务" value={trace.taskId || '—'} mono />
            <Info label="Provider" value={trace.providerType || '—'} />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 mb-1">成本与模型</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="请求模型" value={trace.requestedModel || '—'} />
            <Info label="实际模型" value={trace.actualModel || '—'} />
            <Info label="输入 Tokens" value={trace.promptTokens ?? 0} mono />
            <Info label="输出 Tokens" value={trace.completionTokens ?? 0} mono />
            <Info label="输入成本" value={fmtCost(trace.inputCost)} mono />
            <Info label="输出成本" value={fmtCost(trace.outputCost)} mono />
          </div>
        </div>
      </div>

      {trace.instruction && (
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 mb-1">用户指令</div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap">{trace.instruction}</div>
        </div>
      )}

      {hits.length > 0 && (
        <div className="bg-red-50/50 border border-red-100 rounded-lg p-3">
          <div className="text-xs text-red-600 font-medium mb-1">风险命中 ({hits.length})</div>
          {hits.map((h, i) => (
            <div key={h.ruleId || i} className="text-xs text-red-700 py-0.5">
              <span className="font-medium">{h.ruleName}</span> — {h.matchSummary} [{h.severity}/{h.action}]
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-[10px] text-gray-400 mb-1">Metadata</div>
        <pre className="max-h-44 overflow-auto text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(trace.metadata || {}, null, 2)}</pre>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-gray-400">{label}: </span>
      <span className={`${mono ? 'font-mono' : 'font-medium'} text-gray-700 break-all`}>{String(value)}</span>
    </div>
  );
}

function DetailView({
  traces,
  page,
  setPage,
  total,
  onLoadDetail,
  loadingDetailId,
  detailErrors,
}: {
  traces: TraceRecord[];
  page: number;
  setPage: (fn: (p: number) => number) => void;
  total: number;
  onLoadDetail: (trace: TraceRecord) => void;
  loadingDetailId: string | null;
  detailErrors: Record<string, string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const expand = (trace: TraceRecord) => {
    const tid = traceIdOf(trace);
    const next = expandedId === tid ? null : tid;
    setExpandedId(next);
    if (next) onLoadDetail(trace);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white flex-1 min-h-0">
        <div className="h-full overflow-auto">
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
            <tr className="border-b border-gray-100">
              <th className="w-8" />
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Trace ID</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">调用者</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">状态</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">根因/链路</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">模型</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Tokens</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">成本</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">延迟</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">时间</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => {
              const tid = traceIdOf(t);
              const isExpanded = expandedId === tid;
              const analysis = analyzeTrace(t);
              return (
                <Fragment key={tid}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => expand(t)}>
                    <td className="pl-3">
                      <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size={16} className="text-gray-400" />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#0057D8]">{tid.slice(0, 16)}</td>
                    <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" title={t.instanceId || t.userId || '未知'}>
                      {t.instanceId || t.employeeName || t.userId || <span className="text-gray-300 italic">default</span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusPill status={t.status} /></td>
                    <td className="px-3 py-2.5 text-xs max-w-[180px] truncate">
                      <span className={analysis.rootCause ? 'text-red-700 font-medium' : 'text-gray-500'}>
                        {analysis.rootCause?.stage || (t.chain?.length ? '无失败节点' : '链路待补齐')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{String(t.actualModel || t.requestedModel || '—')}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">{t.promptTokens ?? 0} / {t.completionTokens ?? 0}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-800">{fmtCost(t.estimatedCost)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{fmtDuration(t.latencyMs)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{fmtTime(t.createdAt)}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${tid}-detail`}>
                      <td colSpan={10} className="px-6 py-4 bg-gray-50/50">
                        {loadingDetailId === tid ? (
                          <div className="py-8 text-center text-sm text-gray-400">正在加载真实 Trace 详情...</div>
                        ) : detailErrors[tid] ? (
                          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                            详情加载失败：{detailErrors[tid]}。列表摘要仍可用，但无法展示真实链路节点。
                          </div>
                        ) : (
                          <TraceExpandedDetail trace={t} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {traces.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">暂无调用记录</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm shrink-0">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40">上一页</button>
          <span className="text-gray-500">{page} / {totalPages}（共 {total} 条）</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}

export function TracesTab() {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [filters, setFilters] = useState({ search: '', status: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const limit = 20;

  const load = useCallback(() => {
    aiGatewayApi
      .listTraces({
        search: filters.search,
        status: filters.status,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page,
        limit,
      })
      .then((r) => {
        setTraces((r.items || r.traces || []) as TraceRecord[]);
        setTotal(r.total || 0);
      })
      .catch(() => {
        setTraces([]);
        setTotal(0);
      });
    aiGatewayApi.getTraceStats().then(setStats).catch(() => setStats({}));
  }, [filters, page]);

  useEffect(load, [load]);

  const loadDetail = useCallback((trace: TraceRecord) => {
    const tid = traceIdOf(trace);
    if (!tid || trace.chain || trace.riskHits || trace.spanList) return;
    setLoadingDetailId(tid);
    aiGatewayApi
      .getTraceDetail(tid)
      .then((r) => {
        const detail = r.trace as TraceRecord;
        // 如果该 Span 关联了分布式 Trace，拉取完整 Span 树
        if (detail.distTraceId) {
          aiGatewayApi
            .getDistTraceDetail(String(detail.distTraceId))
            .then((dr) => {
              const distDetail = dr.trace as Record<string, unknown>;
              const spanList = distDetail.spanList as SpanItem[] | undefined;
              const distRiskHits = distDetail.riskHits as RiskHit[] | undefined;
              setDetailErrors((prev) => { const next = { ...prev }; delete next[tid]; return next; });
              setTraces((items) =>
                items.map((item) =>
                  traceIdOf(item) === tid ? { ...item, ...detail, spanList, distRiskHits } : item
                )
              );
            })
            .catch(() => {
              // 分布式 Trace 拉取失败，仍展示单 Span 详情
              setDetailErrors((prev) => { const next = { ...prev }; delete next[tid]; return next; });
              setTraces((items) => items.map((item) => (traceIdOf(item) === tid ? { ...item, ...detail } : item)));
            });
        } else {
          setDetailErrors((current) => {
            const next = { ...current };
            delete next[tid];
            return next;
          });
          setTraces((items) => items.map((item) => (traceIdOf(item) === tid ? { ...item, ...detail } : item)));
        }
      })
      .catch((error: unknown) => {
        setDetailErrors((current) => ({
          ...current,
          [tid]: error instanceof Error ? error.message : '请求失败',
        }));
      })
      .finally(() => setLoadingDetailId(null));
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
        <StatCard label="总调用" value={fmtNum(Number(stats.totalCalls) || 0)} icon="hub" color="#007AFF" />
        <StatCard label="已完成" value={fmtNum(Number(stats.completed) || 0)} icon="check_circle" color="#34C759" />
        <StatCard label="失败/错误" value={fmtNum(Number(stats.failed) || 0)} icon="error_outline" color="#FF3B30" />
        <StatCard label="总 Token" value={fmtNum(Number(stats.totalTokens) || 0)} icon="token" color="#AF52DE" />
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <input value={filters.search} onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }} placeholder="搜索 traceId / requestId / 模型 / 数字员工 / 用户 / metadata" className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full sm:w-[360px]" />
          <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">全部状态</option>
            <option value="success">成功</option>
            <option value="error">错误</option>
            <option value="failed">失败</option>
            <option value="blocked">已拦截</option>
          </select>
          <div className="flex items-center gap-1">
            <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg w-36" title="开始日期" />
            <span className="text-gray-400 text-xs">至</span>
            <input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg w-36" title="结束日期" />
          </div>
          <button onClick={() => { setFilters({ search: '', status: '', dateFrom: '', dateTo: '' }); setPage(1); }} className="px-2 py-1.5 text-xs text-gray-500 hover:text-[#007AFF]" title="清空筛选">清空</button>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新"><Icon name="refresh" size={16} /></button>
        </div>
      </div>

      <DetailView
        traces={traces}
        page={page}
        setPage={setPage}
        total={total}
        onLoadDetail={loadDetail}
        loadingDetailId={loadingDetailId}
        detailErrors={detailErrors}
      />
    </div>
  );
}
