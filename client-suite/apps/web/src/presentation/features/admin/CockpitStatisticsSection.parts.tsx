import { LineChart } from '../../components/ui/SVGChart';
import { Icon } from '../../components/ui/Icon';
import {
  type TrendData,
  type LatencyData,
  type SpendUser,
  type ModalPanel,
  fmtTk,
  trendPts,
  modalConfig,
} from './CockpitStatisticsSection.helpers';

export function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 0
      ? 'bg-yellow-100 text-yellow-700'
      : rank === 1
        ? 'bg-gray-200 text-gray-600'
        : rank === 2
          ? 'bg-orange-100 text-orange-600'
          : 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-medium shrink-0 ${cls}`}
    >
      {rank + 1}
    </span>
  );
}

/* ──── Card with expand button ──── */

export function ChartCard({
  icon,
  title,
  onExpand,
  children,
}: {
  icon: string;
  title: string;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white group">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs text-gray-400 flex items-center gap-1">
          <Icon name={icon} size={14} className="align-[-2px]" />
          {title}
        </h3>
        <button
          onClick={onExpand}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 rounded hover:bg-gray-100"
          title="展开查看"
        >
          <Icon name="open_in_full" size={14} className="text-gray-400 hover:text-[#007AFF]" />
        </button>
      </div>
      {children}
    </div>
  );
}

/* ──── Mini Rank cards (page inline, compact) ──── */

export function MiniDeptRank({ items }: { items: Record<string, unknown>[] }) {
  const typed = items as { name?: string; dept?: string; tokens: number }[];
  const maxT = Math.max(...typed.map((x) => x.tokens), 1);

  if (!typed.length)
    return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-400">暂无数据</div>
    );

  return (
    <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
      {typed.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <RankBadge rank={i} />
          <span className="text-gray-700 w-20 truncate shrink-0">{d.name || d.dept}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#007AFF] rounded-full"
              style={{ width: `${(d.tokens / maxT) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 w-12 text-right tabular-nums shrink-0">
            {fmtTk(d.tokens)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MiniUserRank({ items }: { items: Record<string, unknown>[] }) {
  const typed = items as { name: string; messages: number; tokens: number }[];
  if (!typed.length)
    return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-400">暂无数据</div>
    );

  return (
    <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
      {typed.map((u, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <RankBadge rank={i} />
            <span className="text-xs text-gray-700 font-medium truncate max-w-[80px]">
              {u.name}
            </span>
          </div>
          <div className="text-[11px] text-gray-400 shrink-0">
            <span>{u.messages} 消息</span>
            <span className="ml-1">{fmtTk(u.tokens)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniSpendRank({ items }: { items: SpendUser[] }) {
  const maxCost = Math.max(...items.map((x) => x.estimatedCost), 0.01);
  if (!items.length)
    return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-400">暂无数据</div>
    );

  return (
    <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
      {items.map((u, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <RankBadge rank={i} />
          <span className="text-gray-700 w-20 truncate shrink-0">{u.userId}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF9500] rounded-full"
              style={{ width: `${(u.estimatedCost / maxCost) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 w-14 text-right tabular-nums shrink-0">
            ¥{u.estimatedCost.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ──── Modal Tables ──── */

export function DeptTable({ items }: { items: Record<string, unknown>[] }) {
  const typed = items as { name?: string; dept?: string; tokens: number }[];
  const total = typed.reduce((s, d) => s + d.tokens, 0) || 1;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-gray-400 text-xs">
          <th className="text-left py-2 w-12">#</th>
          <th className="text-left py-2">部门</th>
          <th className="text-right py-2">Token 消耗</th>
          <th className="text-right py-2 w-24">占比</th>
          <th className="text-left py-2 pl-4 w-[40%]">分布</th>
        </tr>
      </thead>
      <tbody>
        {typed.map((d, i) => {
          const pct = ((d.tokens / total) * 100).toFixed(1);
          return (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
              <td className="py-2.5">
                <RankBadge rank={i} />
              </td>
              <td className="py-2.5 text-gray-700 font-medium">{d.name || d.dept}</td>
              <td className="py-2.5 text-right text-gray-600 tabular-nums">{fmtTk(d.tokens)}</td>
              <td className="py-2.5 text-right text-gray-400 tabular-nums">{pct}%</td>
              <td className="py-2.5 pl-4">
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#007AFF] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-gray-200 text-xs text-gray-400 font-medium">
          <td className="py-2" colSpan={2}>
            合计
          </td>
          <td className="py-2 text-right tabular-nums">{fmtTk(total)}</td>
          <td className="py-2 text-right">100%</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

export function UsersTable({ items }: { items: Record<string, unknown>[] }) {
  const typed = items as { name: string; messages: number; tokens: number }[];
  const maxMsg = Math.max(...typed.map((u) => u.messages), 1);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-gray-400 text-xs">
          <th className="text-left py-2 w-12">#</th>
          <th className="text-left py-2">用户</th>
          <th className="text-right py-2">消息数</th>
          <th className="text-right py-2">Token 消耗</th>
          <th className="text-left py-2 pl-4 w-[35%]">活跃度</th>
        </tr>
      </thead>
      <tbody>
        {typed.map((u, i) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <td className="py-2.5">
              <RankBadge rank={i} />
            </td>
            <td className="py-2.5 text-gray-700 font-medium">{u.name}</td>
            <td className="py-2.5 text-right text-gray-600 tabular-nums">{u.messages}</td>
            <td className="py-2.5 text-right text-gray-600 tabular-nums">{fmtTk(u.tokens)}</td>
            <td className="py-2.5 pl-4">
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#34C759] rounded-full"
                  style={{ width: `${(u.messages / maxMsg) * 100}%` }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SpendTable({ items }: { items: SpendUser[] }) {
  const maxCost = Math.max(...items.map((u) => u.estimatedCost), 0.01);
  const totalCost = items.reduce((s, u) => s + u.estimatedCost, 0);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-gray-400 text-xs">
          <th className="text-left py-2 w-12">#</th>
          <th className="text-left py-2">用户</th>
          <th className="text-right py-2">调用次数</th>
          <th className="text-right py-2">Token</th>
          <th className="text-right py-2">花费 (¥)</th>
          <th className="text-left py-2 pl-4 w-[30%]">花费分布</th>
        </tr>
      </thead>
      <tbody>
        {items.map((u, i) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <td className="py-2.5">
              <RankBadge rank={i} />
            </td>
            <td className="py-2.5 text-gray-700 font-medium">{u.userId}</td>
            <td className="py-2.5 text-right text-gray-600 tabular-nums">{u.count}</td>
            <td className="py-2.5 text-right text-gray-600 tabular-nums">{fmtTk(u.totalTokens)}</td>
            <td className="py-2.5 text-right text-gray-600 tabular-nums font-medium">
              {u.estimatedCost.toFixed(2)}
            </td>
            <td className="py-2.5 pl-4">
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF9500] rounded-full"
                  style={{ width: `${(u.estimatedCost / maxCost) * 100}%` }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-gray-200 text-xs text-gray-400 font-medium">
          <td className="py-2" colSpan={4}>
            合计
          </td>
          <td className="py-2 text-right tabular-nums">¥{totalCost.toFixed(2)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/* ──── Modal ──── */

function buildSummaryCards(props: {
  panel: NonNullable<ModalPanel>;
  dau: TrendData;
  messages: TrendData;
  retention: TrendData;
  tokens: TrendData;
  latency: LatencyData;
  errorRate: TrendData;
  deptTokens: Record<string, unknown>[];
  topUsers: Record<string, unknown>[];
  topSpend: SpendUser[];
}): { label: string; value: string; sub?: string }[] {
  switch (props.panel) {
    case 'dau': {
      const v = props.dau.values;
      const avg = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
      const peak = Math.max(...v, 0);
      const peakDay = props.dau.days[v.indexOf(peak)] || '';
      const trend = v.length >= 2 ? v[v.length - 1] - v[v.length - 2] : 0;
      return [
        { label: '日均 DAU', value: String(avg) },
        { label: '峰值', value: String(peak), sub: peakDay },
        { label: '今日', value: String(v[v.length - 1] || 0) },
        {
          label: '日环比',
          value: `${trend >= 0 ? '+' : ''}${trend}`,
          sub: trend > 0 ? '↑ 增长' : trend < 0 ? '↓ 下降' : '持平',
        },
      ];
    }
    case 'messages': {
      const v = props.messages.values;
      const total = v.reduce((a, b) => a + b, 0);
      const avg = v.length ? Math.round(total / v.length) : 0;
      const peak = Math.max(...v, 0);
      const peakDay = props.messages.days[v.indexOf(peak)] || '';
      return [
        { label: '总消息数', value: fmtTk(total) },
        { label: '日均', value: fmtTk(avg) },
        { label: '峰值', value: fmtTk(peak), sub: peakDay },
        { label: '今日', value: fmtTk(v[v.length - 1] || 0) },
      ];
    }
    case 'retention': {
      const v = props.retention.values;
      const avg = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
      const peak = Math.max(...v, 0);
      const low = Math.min(...v.filter((x) => x > 0), 100);
      return [
        { label: '平均留存', value: `${avg}%` },
        { label: '最高', value: `${peak}%` },
        { label: '最低', value: `${low}%` },
        { label: '今日', value: `${v[v.length - 1] || 0}%` },
      ];
    }
    case 'tokens': {
      const v = props.tokens.values;
      const total = v.reduce((a, b) => a + b, 0);
      const avg = v.length ? Math.round(total / v.length) : 0;
      const peak = Math.max(...v, 0);
      const peakDay = props.tokens.days[v.indexOf(peak)] || '';
      return [
        { label: '总 Token', value: fmtTk(total) },
        { label: '日均', value: fmtTk(avg) },
        { label: '峰值', value: fmtTk(peak), sub: peakDay },
        { label: '今日', value: fmtTk(v[v.length - 1] || 0) },
      ];
    }
    case 'latency': {
      const p50 = props.latency.p50;
      const p95 = props.latency.p95;
      const avgP50 = p50.length ? Math.round(p50.reduce((a, b) => a + b, 0) / p50.length) : 0;
      const avgP95 = p95.length ? Math.round(p95.reduce((a, b) => a + b, 0) / p95.length) : 0;
      const peakP95 = Math.max(...p95, 0);
      return [
        { label: '平均 P50', value: `${avgP50}ms` },
        { label: '平均 P95', value: `${avgP95}ms` },
        { label: 'P95 峰值', value: `${peakP95}ms` },
        { label: '今日 P50', value: `${p50[p50.length - 1] || 0}ms` },
      ];
    }
    case 'error': {
      const v = props.errorRate.values;
      const avg = v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '0';
      const peak = Math.max(...v, 0);
      const peakDay = props.errorRate.days[v.indexOf(peak)] || '';
      return [
        { label: '平均错误率', value: `${avg}%` },
        { label: '峰值', value: `${peak.toFixed(2)}%`, sub: peakDay },
        { label: '今日', value: `${(v[v.length - 1] || 0).toFixed(2)}%` },
        { label: '无错误天数', value: `${v.filter((x) => x === 0).length} 天` },
      ];
    }
    case 'dept': {
      const typed = props.deptTokens as { name?: string; tokens: number }[];
      const total = typed.reduce((s, d) => s + d.tokens, 0);
      const top1 = typed[0];
      const top1Pct = total > 0 && top1 ? ((top1.tokens / total) * 100).toFixed(1) : '0';
      return [
        { label: '部门数', value: String(typed.length) },
        { label: '总 Token', value: fmtTk(total) },
        { label: '头部占比', value: `${top1Pct}%`, sub: top1?.name || '' },
        { label: '人均 Token', value: fmtTk(typed.length ? Math.round(total / typed.length) : 0) },
      ];
    }
    case 'users': {
      const typed = props.topUsers as { name: string; messages: number; tokens: number }[];
      const totalMsg = typed.reduce((s, u) => s + u.messages, 0);
      const totalTk = typed.reduce((s, u) => s + u.tokens, 0);
      const avgMsg = typed.length ? Math.round(totalMsg / typed.length) : 0;
      return [
        { label: '用户数', value: String(typed.length) },
        { label: '总消息', value: fmtTk(totalMsg) },
        { label: '人均消息', value: String(avgMsg) },
        { label: '总 Token', value: fmtTk(totalTk) },
      ];
    }
    case 'spend': {
      const totalCost = props.topSpend.reduce((s, u) => s + u.estimatedCost, 0);
      const top1 = props.topSpend[0];
      const top1Pct =
        totalCost > 0 && top1 ? ((top1.estimatedCost / totalCost) * 100).toFixed(1) : '0';
      const avgCost = props.topSpend.length ? totalCost / props.topSpend.length : 0;
      return [
        { label: '用户数', value: String(props.topSpend.length) },
        { label: '总花费', value: `¥${totalCost.toFixed(2)}` },
        { label: '人均花费', value: `¥${avgCost.toFixed(2)}` },
        { label: '头部占比', value: `${top1Pct}%`, sub: top1?.userId || '' },
      ];
    }
  }
}

function ModalSummary(props: {
  panel: NonNullable<ModalPanel>;
  dau: TrendData;
  messages: TrendData;
  retention: TrendData;
  tokens: TrendData;
  latency: LatencyData;
  errorRate: TrendData;
  deptTokens: Record<string, unknown>[];
  topUsers: Record<string, unknown>[];
  topSpend: SpendUser[];
}) {
  const cards = buildSummaryCards(props);
  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
          <div className="text-[11px] text-gray-400 mb-1">{c.label}</div>
          <div className="text-lg font-semibold text-gray-800 tabular-nums">{c.value}</div>
          {c.sub && <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function ModalBody(props: {
  panel: NonNullable<ModalPanel>;
  dau: TrendData;
  messages: TrendData;
  retention: TrendData;
  tokens: TrendData;
  latency: LatencyData;
  errorRate: TrendData;
  deptTokens: Record<string, unknown>[];
  topUsers: Record<string, unknown>[];
  topSpend: SpendUser[];
}) {
  switch (props.panel) {
    case 'dau':
      return <LineChart data={trendPts(props.dau)} height={320} color="#007AFF" />;
    case 'messages':
      return <LineChart data={trendPts(props.messages)} height={320} color="#34C759" />;
    case 'retention':
      return <LineChart data={trendPts(props.retention)} height={320} color="#AF52DE" />;
    case 'tokens':
      return <LineChart data={trendPts(props.tokens)} height={320} color="#FF9500" />;
    case 'error':
      return <LineChart data={trendPts(props.errorRate)} height={320} color="#FF3B30" />;
    case 'latency':
      return (
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs text-gray-400 mb-2 font-medium">P50 延迟 (ms)</div>
            <LineChart
              data={props.latency.days.map((d, i) => ({
                label: d,
                value: props.latency.p50[i] || 0,
              }))}
              height={280}
              color="#007AFF"
            />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-2 font-medium">P95 延迟 (ms)</div>
            <LineChart
              data={props.latency.days.map((d, i) => ({
                label: d,
                value: props.latency.p95[i] || 0,
              }))}
              height={280}
              color="#FF9500"
            />
          </div>
        </div>
      );
    case 'dept':
      return <DeptTable items={props.deptTokens} />;
    case 'users':
      return <UsersTable items={props.topUsers} />;
    case 'spend':
      return <SpendTable items={props.topSpend} />;
  }
}

function ModalContent(props: {
  panel: NonNullable<ModalPanel>;
  dau: TrendData;
  messages: TrendData;
  retention: TrendData;
  tokens: TrendData;
  latency: LatencyData;
  errorRate: TrendData;
  deptTokens: Record<string, unknown>[];
  topUsers: Record<string, unknown>[];
  topSpend: SpendUser[];
}) {
  return (
    <div className="space-y-5">
      <ModalSummary {...props} />
      <ModalBody {...props} />
    </div>
  );
}

export function DataModal({
  panel,
  onClose,
  dau,
  messages,
  retention,
  tokens,
  latency,
  errorRate,
  deptTokens,
  topUsers,
  topSpend,
}: {
  panel: NonNullable<ModalPanel>;
  onClose: () => void;
  dau: TrendData;
  messages: TrendData;
  retention: TrendData;
  tokens: TrendData;
  latency: LatencyData;
  errorRate: TrendData;
  deptTokens: Record<string, unknown>[];
  topUsers: Record<string, unknown>[];
  topSpend: SpendUser[];
}) {
  const cfg = modalConfig(panel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[960px] max-h-[85vh] flex flex-col animate-[scaleIn_150ms_ease-out]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Icon name={cfg.icon} size={18} className="text-gray-400" />
            {cfg.title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Icon name="close" size={18} className="text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <ModalContent
            panel={panel}
            dau={dau}
            messages={messages}
            retention={retention}
            tokens={tokens}
            latency={latency}
            errorRate={errorRate}
            deptTokens={deptTokens}
            topUsers={topUsers}
            topSpend={topSpend}
          />
        </div>
      </div>
    </div>
  );
}
